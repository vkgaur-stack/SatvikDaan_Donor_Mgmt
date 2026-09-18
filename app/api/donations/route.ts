// app/api/donations/route.ts - Donation management with Razorpay

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectedRoute, validateRequestBody } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/helpers';
import { encryptField, decryptField } from '@/lib/crypto';
import {
  successResponse,
  errorResponse,
  validateAmount,
  validatePagination,
  createAuditLog,
  getDonorOrThrow,
  sendDonationThankYouEmail,
  generateReceiptNumber,
  formatAmountForRazorpay,
} from '@/lib/helpers';
import { verifyRazorpaySignature, decryptField } from '@/lib/crypto';
import {
  CreateDonationRequest,
  RazorpayDonationRequest,
  DonationResponse,
  AuthUser,
  ApiError,
  ErrorCode,
} from '@/types';
import Razorpay from 'razorpay';

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// ============================================================================
// GET /api/donations - List donations
// ============================================================================

export const GET = protectedRoute(
  async (request: NextRequest, user: AuthUser) => {
    try {
      const { searchParams } = new URL(request.url);
      const page = parseInt(searchParams.get('page') || '1');
      const pageSize = parseInt(searchParams.get('pageSize') || '20');
      const donorId = searchParams.get('donorId');
      const status = searchParams.get('status');
      const programId = searchParams.get('programId');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      const { page: p, pageSize: ps } = validatePagination(page, pageSize);

      const where: any = { organizationId: user.organizationId };

      if (donorId) where.donorId = donorId;
      if (status) where.status = status;
      if (programId) where.programId = programId;

      if (startDate || endDate) {
        where.donationDate = {};
        if (startDate)
          where.donationDate.gte = new Date(startDate);
        if (endDate)
          where.donationDate.lte = new Date(endDate);
      }

      const [donations, total] = await Promise.all([
        prisma.donation.findMany({
          where,
          include: {
            donor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                tier: true,
              },
            },
            program: { select: { id: true, name: true } },
          },
          orderBy: { donationDate: 'desc' },
          skip: (p - 1) * ps,
          take: ps,
        }),
        prisma.donation.count({ where }),
      ]);

      await createAuditLog(
        user.organizationId,
        user.id,
        'view',
        'donation',
        null,
        request
      );

      const response = donations.map((d) => ({
        ...d,
        donor: {
          ...d.donor,
          email: decryptField(d.donor.email),
        },
      }));

      return successResponse(
        {
          data: response,
          pagination: { page: p, pageSize: ps, total },
        },
        200
      );
    } catch (error) {
      return errorResponse(error);
    }
  },
  ['admin', 'program_manager']
);

// ============================================================================
// POST /api/donations - Create donation (for non-Razorpay)
// ============================================================================

export const POST = protectedRoute(
  async (request: NextRequest, user: AuthUser) => {
    try {
      const body = await validateRequestBody<CreateDonationRequest>(request);

      // Validate
      if (!body.donorId || !body.amount) {
        throw new ApiError(400, 'Donor ID and amount are required', ErrorCode.INVALID_INPUT);
      }

      validateAmount(body.amount);

      // Verify donor exists
      const donor = await getDonorOrThrow(body.donorId, user.organizationId);

      // Verify program if provided
      if (body.programId) {
        const program = await prisma.program.findFirst({
          where: {
            id: body.programId,
            organizationId: user.organizationId,
            deletedAt: null,
          },
        });
        if (!program) {
          throw new ApiError(404, 'Program not found', ErrorCode.NOT_FOUND);
        }
      }

      // Create donation
      const donation = await prisma.donation.create({
        data: {
          organizationId: user.organizationId,
          donorId: body.donorId,
          amount: body.amount,
          currency: 'INR',
          donationDate: new Date(),
          paymentMethod: body.paymentMethod,
          frequency: body.frequency || 'one_off',
          campaignTag: body.campaignTag,
          status: 'completed',
          programId: body.programId,
          taxReceiptStatus: 'pending',
        },
        include: { donor: true },
      });

      // Update donor lifetime value
      await prisma.donor.update({
        where: { id: body.donorId },
        data: {
          lifetimeValue: {
            increment: body.amount,
          },
          lastGiftDate: new Date(),
        },
      });

      // Send thank you email
      await sendDonationThankYouEmail(
        decryptField(donor.email),
        `${donor.firstName} ${donor.lastName || ''}`.trim(),
        body.amount,
        'Satvikdaan'
      );

      await createAuditLog(
        user.organizationId,
        user.id,
        'create',
        'donation',
        donation.id,
        request,
        null,
        donation
      );

      const response: DonationResponse = {
        id: donation.id,
        donorId: donation.donorId,
        amount: donation.amount,
        currency: donation.currency,
        donationDate: donation.donationDate.toISOString(),
        paymentMethod: donation.paymentMethod,
        status: donation.status,
        taxReceiptStatus: donation.taxReceiptStatus,
        acknowledgmentSent: donation.acknowledgmentSent,
        createdAt: donation.createdAt.toISOString(),
      };

      return successResponse(response, 201, 'Donation recorded successfully');
    } catch (error) {
      return errorResponse(error);
    }
  },
  ['admin', 'program_manager']
);

// ============================================================================
// POST /api/donations/razorpay/orders - Create Razorpay order
// ============================================================================

export async function createRazorpayOrder(
  request: NextRequest,
  user: AuthUser
) {
  try {
    const body = await validateRequestBody<{
      donorId: string;
      amount: number;
      programId?: string;
      campaignTag?: string;
    }>(request);

    validateAmount(body.amount);

    // Verify donor
    await getDonorOrThrow(body.donorId, user.organizationId);

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: formatAmountForRazorpay(body.amount),
      currency: 'INR',
      receipt: `donation-${Date.now()}`,
      notes: {
        organizationId: user.organizationId,
        donorId: body.donorId,
        programId: body.programId || 'general',
        campaignTag: body.campaignTag || 'general',
      },
    });

    return successResponse(
      {
        orderId: order.id,
        amount: body.amount,
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID,
      },
      201,
      'Order created successfully'
    );
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    return errorResponse(
      new ApiError(
        500,
        'Failed to create Razorpay order',
        ErrorCode.RAZORPAY_ERROR
      )
    );
  }
}

// ============================================================================
// POST /api/donations/razorpay/verify - Verify & process payment
// ============================================================================

export async function verifyRazorpayPayment(
  request: NextRequest,
  user: AuthUser
) {
  try {
    const body = await validateRequestBody<{
      orderId: string;
      paymentId: string;
      signature: string;
      donorId: string;
      amount: number;
      programId?: string;
      campaignTag?: string;
    }>(request);

    // Verify signature
    const hmac = require('crypto').createHmac(
      'sha256',
      process.env.RAZORPAY_KEY_SECRET!
    );
    hmac.update(`${body.orderId}|${body.paymentId}`);
    const calculatedSignature = hmac.digest('hex');

    if (calculatedSignature !== body.signature) {
      throw new ApiError(
        400,
        'Invalid payment signature',
        ErrorCode.INVALID_INPUT
      );
    }

    // Verify donor
    await getDonorOrThrow(body.donorId, user.organizationId);

    // Create donation record
    const donation = await prisma.donation.create({
      data: {
        organizationId: user.organizationId,
        donorId: body.donorId,
        amount: body.amount,
        currency: 'INR',
        donationDate: new Date(),
        paymentMethod: 'online',
        frequency: 'one_off',
        campaignTag: body.campaignTag,
        status: 'completed',
        programId: body.programId,
        razorpayOrderId: body.orderId,
        razorpayPaymentId: body.paymentId,
        taxReceiptStatus: 'pending',
        acknowledgmentSent: false,
      },
      include: { donor: true },
    });

    // Update donor lifetime value & last gift date
    await prisma.donor.update({
      where: { id: body.donorId },
      data: {
        lifetimeValue: { increment: body.amount },
        lastGiftDate: new Date(),
        status: 'active',
      },
    });

    // Send thank you email
    const donor = donation.donor;
    await sendDonationThankYouEmail(
      decryptField(donor.email),
      `${donor.firstName} ${donor.lastName || ''}`.trim(),
      body.amount,
      'Satvikdaan'
    );

    // Update donation to mark acknowledgment sent
    await prisma.donation.update({
      where: { id: donation.id },
      data: { acknowledgmentSent: true, acknowledgmentDate: new Date() },
    });

    await createAuditLog(
      user.organizationId,
      user.id,
      'create',
      'donation',
      donation.id,
      request,
      null,
      donation
    );

    const response: DonationResponse = {
      id: donation.id,
      donorId: donation.donorId,
      amount: donation.amount,
      currency: donation.currency,
      donationDate: donation.donationDate.toISOString(),
      paymentMethod: donation.paymentMethod,
      status: donation.status,
      taxReceiptStatus: donation.taxReceiptStatus,
      acknowledgmentSent: true,
      createdAt: donation.createdAt.toISOString(),
    };

    return successResponse(response, 201, 'Payment verified and recorded');
  } catch (error) {
    return errorResponse(error);
  }
}

// ============================================================================
// POST /api/donations/[id]/receipt - Generate tax receipt
// ============================================================================

export async function generateTaxReceipt(
  request: NextRequest,
  donationId: string,
  user: AuthUser
) {
  try {
    const donation = await prisma.donation.findFirst({
      where: {
        id: donationId,
        organizationId: user.organizationId,
      },
      include: { donor: true, organization: true },
    });

    if (!donation) {
      throw new ApiError(404, 'Donation not found', ErrorCode.NOT_FOUND);
    }

    if (donation.taxReceiptStatus === 'issued') {
      throw new ApiError(
        400,
        'Tax receipt already issued',
        ErrorCode.INVALID_INPUT
      );
    }

    // Generate receipt number
    const receiptNo = generateReceiptNumber(donationId);

    // Update donation with receipt details
    const updated = await prisma.donation.update({
      where: { id: donationId },
      data: {
        taxReceiptNo: receiptNo,
        taxReceiptDate: new Date(),
        taxReceiptStatus: 'issued',
      },
      include: { donor: true },
    });

    // TODO: Generate PDF receipt and send email
    // For now, return receipt data
    const receiptData = {
      receiptNo,
      donorName: `${updated.donor.firstName} ${updated.donor.lastName || ''}`.trim(),
      donorEmail: decryptField(updated.donor.email),
      donorPAN: updated.donor.panNumber,
      amount: updated.amount,
      donationDate: updated.donationDate.toISOString().split('T')[0],
      organizationName: updated.organization.name,
      organizationTaxId: updated.organization.taxId,
      receiptDate: new Date().toISOString().split('T')[0],
    };

    await createAuditLog(
      user.organizationId,
      user.id,
      'create',
      'tax_receipt',
      donationId,
      request,
      null,
      receiptData
    );

    return successResponse(
      receiptData,
      201,
      'Tax receipt generated successfully'
    );
  } catch (error) {
    return errorResponse(error);
  }
}
