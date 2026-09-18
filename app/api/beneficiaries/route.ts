import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectedRoute } from '@/lib/auth';
import { successResponse, errorResponse, createAuditLog, getBeneficiaryOrThrow } from '@/lib/helpers';
import { decryptField } from '@/lib/crypto';
import { AuthUser } from '@/types';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return protectedRoute(
    async (req: NextRequest, user: AuthUser) => {
      try {
        const beneficiaryId = params.id;

        const beneficiary = await getBeneficiaryOrThrow(
          beneficiaryId,
          user.organizationId
        );

        // Fetch related data
        const [household, enrollments, documents, caseNotes] = await Promise.all([
          prisma.household.findUnique({ where: { beneficiaryId } }),
          prisma.enrollment.findMany({
            where: { beneficiaryId, deletedAt: null },
            include: {
              program: { select: { id: true, name: true, category: true } },
              aidDeliveries: { take: 5 },
            },
          }),
          prisma.document.findMany({
            where: { beneficiaryId, deletedAt: null },
            select: {
              id: true,
              documentType: true,
              fileName: true,
              isVerified: true,
              uploadedAt: true,
            },
          }),
          prisma.caseNote.findMany({
            where: { beneficiaryId },
            orderBy: { createdAt: 'desc' },
            take: 5,
          }),
        ]);

        await createAuditLog(
          user.organizationId,
          user.id,
          'view',
          'beneficiary',
          beneficiaryId,
          req
        );

        const response = {
          ...beneficiary,
          phone: decryptField(beneficiary.phone || ''),
          email: decryptField(beneficiary.email || ''),
          address: decryptField(beneficiary.address || ''),
          household,
          enrollments,
          documents,
          recentCaseNotes: caseNotes,
          createdAt: beneficiary.createdAt.toISOString(),
          updatedAt: beneficiary.updatedAt.toISOString(),
        };

        return successResponse(response, 200);
      } catch (error) {
        return errorResponse(error);
      }
    },
    ['admin', 'program_manager', 'field_worker']
  )(request);
}
