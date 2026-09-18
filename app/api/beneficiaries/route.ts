// app/api/beneficiaries/route.ts - Beneficiary CRUD operations

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectedRoute, validateRequestBody } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/helpers';
import { encryptField, decryptField } from '@/lib/crypto';
import {
  protectedRoute,
  validateRequestBody,
  requireRole,
} from '@/middleware/auth';
import {
  successResponse,
  errorResponse,
  validatePagination,
  createAuditLog,
  getBeneficiaryOrThrow,
  sendBeneficiaryNotification,
} from '@/utils/helpers';
import { encryptField, decryptField } from '@/utils/crypto';
import {
  CreateBeneficiaryRequest,
  UpdateBeneficiaryRequest,
  BeneficiaryResponse,
  AuthUser,
  ApiError,
  ErrorCode,
} from '@/types';

// ============================================================================
// GET /api/beneficiaries - List all beneficiaries
// ============================================================================

export const GET = protectedRoute(
  async (request: NextRequest, user: AuthUser) => {
    try {
      const { searchParams } = new URL(request.url);
      const page = parseInt(searchParams.get('page') || '1');
      const pageSize = parseInt(searchParams.get('pageSize') || '20');
      const status = searchParams.get('status');
      const gender = searchParams.get('gender');
      const programId = searchParams.get('programId');
      const search = searchParams.get('search'); // Search by name

      const { page: p, pageSize: ps } = validatePagination(page, pageSize);

      // Build where clause
      const where: any = {
        organizationId: user.organizationId,
        deletedAt: null,
      };

      if (status) where.status = status;
      if (gender) where.gender = gender;
      if (programId) {
        where.enrollments = {
          some: { programId, deletedAt: null },
        };
      }

      // Search by name (encrypted in DB, so search is limited)
      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Fetch data
      const [beneficiaries, total] = await Promise.all([
        prisma.beneficiary.findMany({
          where,
          include: {
            household: { select: { membersCount: true, monthlyIncome: true } },
            enrollments: { select: { id: true, programId: true, status: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (p - 1) * ps,
          take: ps,
        }),
        prisma.beneficiary.count({ where }),
      ]);

      // Decrypt sensitive fields for authorized roles
      const decrypted = beneficiaries.map((b) => ({
        ...b,
        phone: user.role !== 'auditor' ? decryptField(b.phone || '') : undefined,
        email: user.role !== 'auditor' ? decryptField(b.email || '') : undefined,
      }));

      await createAuditLog(
        user.organizationId,
        user.id,
        'view',
        'beneficiary',
        null,
        request
      );

      return successResponse(
        {
          data: decrypted,
          pagination: { page: p, pageSize: ps, total },
        },
        200
      );
    } catch (error) {
      return errorResponse(error);
    }
  },
  ['admin', 'program_manager', 'field_worker']
);

// ============================================================================
// POST /api/beneficiaries - Create new beneficiary
// ============================================================================

export const POST = protectedRoute(
  async (request: NextRequest, user: AuthUser) => {
    try {
      const body = await validateRequestBody<CreateBeneficiaryRequest>(request);

      // Validation
      if (!body.firstName || body.firstName.trim().length < 2) {
        throw new ApiError(400, 'First name is required', ErrorCode.INVALID_INPUT);
      }

      // Check for potential duplicates before creating
      const duplicateCheck = await prisma.beneficiary.findFirst({
        where: {
          organizationId: user.organizationId,
          firstName: { contains: body.firstName, mode: 'insensitive' },
          phone: body.phone ? encryptField(body.phone) : undefined,
          deletedAt: null,
        },
      });

      if (duplicateCheck) {
        console.warn(
          `Potential duplicate detected for ${body.firstName} (${body.phone})`
        );
        // Don't fail, but log for manual review
      }

      // Create beneficiary with encrypted sensitive fields
      const beneficiary = await prisma.beneficiary.create({
        data: {
          organizationId: user.organizationId,
          firstName: body.firstName,
          lastName: body.lastName,
          phone: body.phone ? encryptField(body.phone) : null,
          email: body.email ? encryptField(body.email) : null,
          gender: body.gender,
          dateOfBirth: body.dateOfBirth
            ? new Date(body.dateOfBirth)
            : undefined,
          address: body.address ? encryptField(body.address) : null,
          latitude: body.latitude,
          longitude: body.longitude,
          uniqueId: body.uniqueId ? encryptField(body.uniqueId) : null,
          uniqueIdType: body.uniqueIdType,
          profilePhoto: body.profilePhoto, // Handle separately for storage
          status: 'registered',

          // Create household if provided
          ...(body.household && {
            household: {
              create: {
                householdHead: body.household.householdHead,
                membersCount: body.household.membersCount,
                monthlyIncome: body.household.monthlyIncome,
                incomeCategory: body.household.incomeCategory,
                address: body.household.address,
              },
            },
          }),

          // Create enrollments if provided
          ...(body.programIds && body.programIds.length > 0 && {
            enrollments: {
              createMany: {
                data: body.programIds.map((programId) => ({
                  programId,
                  status: 'enrolled',
                })),
                skipDuplicates: true,
              },
            },
          }),
        },
        include: {
          household: true,
          enrollments: true,
        },
      });

      // Create audit log
      await createAuditLog(
        user.organizationId,
        user.id,
        'create',
        'beneficiary',
        beneficiary.id,
        request,
        null,
        beneficiary
      );

      // Send welcome notification if phone available
      if (body.phone) {
        await sendBeneficiaryNotification(
          body.phone,
          `Welcome to Satvikdaan! Your registration is complete. Ref: ${beneficiary.id}`
        );
      }

      // Decrypt for response
      const response: BeneficiaryResponse = {
        ...beneficiary,
        phone: decryptField(beneficiary.phone || ''),
        email: decryptField(beneficiary.email || ''),
        dateOfBirth: beneficiary.dateOfBirth?.toISOString(),
        createdAt: beneficiary.createdAt.toISOString(),
        updatedAt: beneficiary.updatedAt.toISOString(),
      };

      return successResponse(response, 201, 'Beneficiary created successfully');
    } catch (error) {
      return errorResponse(error);
    }
  },
  ['admin', 'program_manager', 'field_worker']
);

// ============================================================================
// GET /api/beneficiaries/[id] - Get specific beneficiary
// ============================================================================

export async function GET_BY_ID(request: NextRequest, { params }: any) {
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

// ============================================================================
// PUT /api/beneficiaries/[id] - Update beneficiary
// ============================================================================

export async function PUT_BY_ID(request: NextRequest, { params }: any) {
  return protectedRoute(
    async (req: NextRequest, user: AuthUser) => {
      try {
        const beneficiaryId = params.id;
        const body = await validateRequestBody<UpdateBeneficiaryRequest>(req);

        // Check existence
        const existing = await getBeneficiaryOrThrow(
          beneficiaryId,
          user.organizationId
        );

        // Prepare update data
        const updateData: any = {};
        if (body.firstName !== undefined) updateData.firstName = body.firstName;
        if (body.lastName !== undefined) updateData.lastName = body.lastName;
        if (body.phone !== undefined)
          updateData.phone = body.phone ? encryptField(body.phone) : null;
        if (body.email !== undefined)
          updateData.email = body.email ? encryptField(body.email) : null;
        if (body.gender !== undefined) updateData.gender = body.gender;
        if (body.dateOfBirth !== undefined)
          updateData.dateOfBirth = body.dateOfBirth
            ? new Date(body.dateOfBirth)
            : null;
        if (body.address !== undefined)
          updateData.address = body.address
            ? encryptField(body.address)
            : null;
        if (body.latitude !== undefined) updateData.latitude = body.latitude;
        if (body.longitude !== undefined) updateData.longitude = body.longitude;
        if (body.status !== undefined) updateData.status = body.status;

        const updated = await prisma.beneficiary.update({
          where: { id: beneficiaryId },
          data: updateData,
          include: { household: true },
        });

        await createAuditLog(
          user.organizationId,
          user.id,
          'update',
          'beneficiary',
          beneficiaryId,
          req,
          existing,
          updated
        );

        const response: BeneficiaryResponse = {
          ...updated,
          phone: decryptField(updated.phone || ''),
          email: decryptField(updated.email || ''),
          dateOfBirth: updated.dateOfBirth?.toISOString(),
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        };

        return successResponse(response, 200, 'Beneficiary updated successfully');
      } catch (error) {
        return errorResponse(error);
      }
    },
    ['admin', 'program_manager']
  )(request);
}

// ============================================================================
// DELETE /api/beneficiaries/[id] - Soft delete beneficiary
// ============================================================================

export async function DELETE_BY_ID(request: NextRequest, { params }: any) {
  return protectedRoute(
    async (req: NextRequest, user: AuthUser) => {
      try {
        const beneficiaryId = params.id;

        await getBeneficiaryOrThrow(beneficiaryId, user.organizationId);

        const deleted = await prisma.beneficiary.update({
          where: { id: beneficiaryId },
          data: { deletedAt: new Date() },
        });

        await createAuditLog(
          user.organizationId,
          user.id,
          'delete',
          'beneficiary',
          beneficiaryId,
          req
        );

        return successResponse(null, 200, 'Beneficiary deleted successfully');
      } catch (error) {
        return errorResponse(error);
      }
    },
    ['admin']
  )(request);
}
