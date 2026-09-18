import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectedRoute, validateRequestBody } from '@/lib/auth';
import {
  successResponse,
  errorResponse,
  validateAmount,
  validatePagination,
  createAuditLog,
  getDonorOrThrow,
  sendDonationThankYouEmail,
} from '@/lib/helpers';
import { decryptField } from '@/lib/crypto';
import {
  CreateDonationRequest,
  DonationResponse,
  AuthUser,
  ApiError,
  ErrorCode,
} from '@/types';

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
  return errorResponse(error instanceof Error ? error : new Error(String(error)));
}
  },
  ['admin', 'program_manager']
);

export const POST = protectedRoute(
  async (request: NextRequest, user: AuthUser) => {
    try {
      const body = await validateRequestBody<CreateDonationRequest>(request);

      if (!body.donorId || !body.amount) {
        throw new ApiError(400, 'Donor ID and amount are required', ErrorCode.INVALID_INPUT);
      }

      validateAmount(body.amount);

      const donor = await getDonorOrThrow(body.donorId, user.organizationId);

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

      await prisma.donor.update({
        where: { id: body.donorId },
        data: {
          lifetimeValue: {
            increment: body.amount,
          },
          lastGiftDate: new Date(),
        },
      });

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
        amount: Number(donation.amount),
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
  return errorResponse(error instanceof Error ? error : new Error(String(error)));
}
  },
  ['admin', 'program_manager']
);
