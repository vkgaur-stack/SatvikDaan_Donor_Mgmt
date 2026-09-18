import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateRequestBody } from '@/lib/auth';
import {
  successResponse,
  errorResponse,
  validateAmount,
  getDonorOrThrow,
  sendDonationThankYouEmail,
  generateReceiptNumber,
  formatAmountForRazorpay,
  createAuditLog,
} from '@/lib/helpers';
import { decryptField } from '@/lib/crypto';
import {
  DonationResponse,
  AuthUser,
  ApiError,
  ErrorCode,
} from '@/types';
import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

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
