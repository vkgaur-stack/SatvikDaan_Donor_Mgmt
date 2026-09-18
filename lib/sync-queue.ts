import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateRequestBody } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/helpers';
import { encryptField } from '@/lib/crypto';
import {
  AuthUser,
  ApiError,
  ErrorCode,
  OfflineSyncQueueItem,
} from '@/types';

/**
 * Sync beneficiary (create/update)
 */
export async function syncBeneficiary(
  sync: OfflineSyncQueueItem,
  user: AuthUser
): Promise<void> {
  const data = sync.payload;

  if (!data.firstName) {
    throw new ApiError(400, 'First name is required', ErrorCode.INVALID_INPUT);
  }

  if (sync.action === 'create') {
    const duplicate = await prisma.beneficiary.findFirst({
      where: {
        organizationId: user.organizationId,
        firstName: data.firstName,
        phone: data.phone ? encryptField(data.phone) : undefined,
        deletedAt: null,
      },
    });

    if (duplicate) {
      throw new ApiError(
        409,
        'Beneficiary with similar details already exists',
        ErrorCode.DUPLICATE_ENTRY
      );
    }

    await prisma.beneficiary.create({
      data: {
        organizationId: user.organizationId,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone ? encryptField(data.phone) : null,
        email: data.email ? encryptField(data.email) : null,
        gender: data.gender,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        address: data.address ? encryptField(data.address) : null,
        latitude: data.latitude,
        longitude: data.longitude,
        uniqueId: data.uniqueId ? encryptField(data.uniqueId) : null,
        uniqueIdType: data.uniqueIdType,
        status: data.status || 'registered',
      },
    });
  } else if (sync.action === 'update' && sync.entityId) {
    await prisma.beneficiary.update({
      where: { id: sync.entityId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone ? encryptField(data.phone) : undefined,
        email: data.email ? encryptField(data.email) : undefined,
        gender: data.gender,
        status: data.status,
      },
    });
  }
}

/**
 * Sync aid delivery
 */
export async function syncAidDelivery(
  sync: OfflineSyncQueueItem,
  user: AuthUser
): Promise<void> {
  const data = sync.payload;

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      id: data.enrollmentId,
      beneficiary: { organizationId: user.organizationId },
    },
  });

  if (!enrollment) {
    throw new ApiError(404, 'Enrollment not found', ErrorCode.NOT_FOUND);
  }

  if (sync.action === 'create') {
    await prisma.aidDelivery.create({
      data: {
        beneficiaryId: data.beneficiaryId,
        programId: data.programId,
        enrollmentId: data.enrollmentId,
        deliveryType: data.deliveryType,
        amount: data.amount,
        currency: 'INR',
        description: data.description,
        deliveryDate: new Date(data.deliveryDate),
        status: data.status || 'pending',
        proofOfDelivery: data.proofOfDelivery,
        signature: data.signature,
      },
    });
  } else if (sync.action === 'update' && sync.entityId) {
    await prisma.aidDelivery.update({
      where: { id: sync.entityId },
      data: {
        status: data.status,
        proofOfDelivery: data.proofOfDelivery,
        signature: data.signature,
      },
    });
  }
}

/**
 * Sync attendance
 */
export async function syncAttendance(
  sync: OfflineSyncQueueItem,
  user: AuthUser
): Promise<void> {
  const data = sync.payload;

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      id: data.enrollmentId,
      beneficiary: { organizationId: user.organizationId },
    },
  });

  if (!enrollment) {
    throw new ApiError(404, 'Enrollment not found', ErrorCode.NOT_FOUND);
  }

  if (sync.action === 'create') {
    const existing = await prisma.attendance.findFirst({
      where: {
        enrollmentId: data.enrollmentId,
        sessionDate: new Date(data.sessionDate),
      },
    });

    if (existing) {
      throw new ApiError(
        409,
        'Attendance already recorded for this date',
        ErrorCode.DUPLICATE_ENTRY
      );
    }

    await prisma.attendance.create({
      data: {
        enrollmentId: data.enrollmentId,
        sessionDate: new Date(data.sessionDate),
        status: data.status,
        notes: data.notes,
      },
    });
  } else if (sync.action === 'update' && sync.entityId) {
    await prisma.attendance.update({
      where: { id: sync.entityId },
      data: {
        status: data.status,
        notes: data.notes,
      },
    });
  }
}

/**
 * Sync case note
 */
export async function syncCaseNote(
  sync: OfflineSyncQueueItem,
  user: AuthUser
): Promise<void> {
  const data = sync.payload;

  const beneficiary = await prisma.beneficiary.findFirst({
    where: {
      id: data.beneficiaryId,
      organizationId: user.organizationId,
      deletedAt: null,
    },
  });

  if (!beneficiary) {
    throw new ApiError(404, 'Beneficiary not found', ErrorCode.NOT_FOUND);
  }

  if (sync.action === 'create') {
    await prisma.caseNote.create({
      data: {
        beneficiaryId: data.beneficiaryId,
        createdById: user.id,
        noteType: data.noteType,
        content: data.content,
        actionItems: data.actionItems,
      },
    });
  } else if (sync.action === 'update' && sync.entityId) {
    await prisma.caseNote.update({
      where: { id: sync.entityId },
      data: {
        content: data.content,
        actionItems: data.actionItems,
        isResolved: data.isResolved,
      },
    });
  }
}

/**
 * Add item to sync queue for offline operation
 */
export async function addToSyncQueue(
  request: NextRequest,
  user: AuthUser
): Promise<NextResponse> {
  try {
    const body = await validateRequestBody<OfflineSyncQueueItem>(request);

    const queueItem = await prisma.offlineSyncQueue.create({
      data: {
        userId: user.id,
        entity: body.entity,
        entityId: body.entityId,
        action: body.action,
        payload: JSON.stringify(body.payload),
        status: 'pending',
      },
    });

    return successResponse(
      {
        queueId: queueItem.id,
        status: 'queued',
        message: 'Operation queued for sync when connectivity is available',
      },
      202
    );
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Get sync conflicts
 */
export async function getSyncConflicts(
  request: NextRequest,
  user: AuthUser
): Promise<NextResponse> {
  try {
    const conflicts = await prisma.offlineSyncQueue.findMany({
      where: {
        userId: user.id,
        status: 'conflict',
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(
      {
        count: conflicts.length,
        conflicts: conflicts.map((c) => ({
          id: c.id,
          entity: c.entity,
          entityId: c.entityId,
          action: c.action,
          errorMessage: c.errorMessage,
          payload: JSON.parse(c.payload),
          createdAt: c.createdAt.toISOString(),
        })),
      },
      200
    );
  } catch (error) {
    return errorResponse(error);
  }
}
