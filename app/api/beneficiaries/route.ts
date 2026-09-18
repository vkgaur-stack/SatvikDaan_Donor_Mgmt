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

export async function GET(request: NextRequest) {
  return protectedRoute(
    async (req: NextRequest, user: AuthUser) => {
      try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const skip = (page - 1) * limit;

        const [beneficiaries, total] = await Promise.all([
          prisma.beneficiary.findMany({
            where: { organizationId: user.organizationId, deletedAt: null },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
              gender: true,
              dateOfBirth: true,
              address: true,
              createdAt: true,
            },
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
          }),
          prisma.beneficiary.count({
            where: { organizationId: user.organizationId, deletedAt: null },
          }),
        ]);

        const decryptedBeneficiaries = beneficiaries.map(b => ({
          ...b,
          phone: decryptField(b.phone || ''),
          email: decryptField(b.email || ''),
          address: decryptField(b.address || ''),
        }));

        await createAuditLog(
          user.organizationId,
          user.id,
          'view',
          'beneficiaries',
          '',
          req
        );

        return successResponse(
          {
            data: decryptedBeneficiaries,
            pagination: {
              page,
              limit,
              total,
              pages: Math.ceil(total / limit),
            },
          },
          200
        );
      } catch (error) {
        return errorResponse(error);
      }
    },
    ['admin', 'program_manager', 'field_worker']
  )(request);
}

export async function POST(request: NextRequest) {
  return protectedRoute(
    async (req: NextRequest, user: AuthUser) => {
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
  )(request);
}
