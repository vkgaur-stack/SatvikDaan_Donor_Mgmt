// app/api/sync/offline/route.ts - Offline data sync & conflict resolution

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectedRoute, validateRequestBody } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/helpers';
import { encryptField, decryptField } from '@/lib/crypto';
import {
  successResponse,
  errorResponse,
  createAuditLog,
} from '@/utils/helpers';
import { encryptField } from '@/utils/crypto';
import {
  ProcessSyncRequest,
  ProcessSyncResponse,
  AuthUser,
  ApiError,
  ErrorCode,
  OfflineSyncQueueItem,
} from '@/types';

// ============================================================================
// GET /api/sync/offline - Get pending sync queue
// ============================================================================

export const GET = protectedRoute(
  async (request: NextRequest, user: AuthUser) => {
    try {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get('status') || 'pending';

      // Fetch pending syncs for the user
      const pendingSyncs = await prisma.offlineSyncQueue.findMany({
        where: {
          userId: user.id,
          status: status as any,
        },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });

      return successResponse(
        {
          count: pendingSyncs.length,
          syncs: pendingSyncs.map((s) => ({
            id: s.id,
            entity: s.entity,
            entityId: s.entityId,
            action: s.action,
            status: s.status,
            errorMessage: s.errorMessage,
            syncAttempts: s.syncAttempts,
            createdAt: s.createdAt.toISOString(),
          })),
        },
        200
      );
    } catch (error) {
      return errorResponse(error);
    }
  },
  ['field_worker', 'program_manager']
);

// ============================================================================
// POST /api/sync/offline - Process sync queue
// ============================================================================

export const POST = protectedRoute(
  async (request: NextRequest, user: AuthUser) => {
    try {
      const body = await validateRequestBody<ProcessSyncRequest>(request);

      if (!body.syncs || body.syncs.length === 0) {
        throw new ApiError(400, 'No syncs to process', ErrorCode.INVALID_INPUT);
      }

      const results: ProcessSyncResponse = {
        totalProcessed: 0,
        successful: 0,
        failed: 0,
        conflicts: [],
      };

      // Process each sync item
      for (const sync of body.syncs) {
        try {
          results.totalProcessed++;

          // Route based on entity type
          switch (sync.entity) {
            case 'beneficiary':
              await syncBeneficiary(sync, user);
              results.successful++;
              break;

            case 'aid_delivery':
              await syncAidDelivery(sync, user);
              results.successful++;
              break;

            case 'attendance':
              await syncAttendance(sync, user);
              results.successful++;
              break;

            case 'case_note':
              await syncCaseNote(sync, user);
              results.successful++;
              break;

            default:
              throw new ApiError(
                400,
                `Unknown entity type: ${sync.entity}`,
                ErrorCode.INVALID_INPUT
              );
          }

          // Remove from queue on success
          await prisma.offlineSyncQueue.delete({
            where: { id: sync.entityId || '' },
          });
        } catch (error) {
          results.failed++;

          const errorMessage = error instanceof Error ? error.message : String(error);

          // Log to queue for retry
          await prisma.offlineSyncQueue.create({
            data: {
              userId: user.id,
              entity: sync.entity,
              entityId: sync.entityId,
              action: sync.action,
              payload: JSON.stringify(sync.payload),
              status: 'failed',
              errorMessage,
              syncAttempts: 1,
            },
          });

          results.conflicts.push({
            queueId: sync.entityId || '',
            entity: sync.entity,
            error: errorMessage,
          });
        }
      }

      await createAuditLog(
        user.organizationId,
        user.id,
        'create',
        'sync_batch',
        null,
        request,
        null,
        results
      );

      return successResponse(results, 200, 'Sync processing completed');
    } catch (error) {
      return errorResponse(error);
    }
  },
  ['field_worker']
);

// ============================================================================
// SYNC HANDLERS
// ============================================================================

/**
 * Sync beneficiary (create/update)
 */
async function syncBeneficiary(
  sync: OfflineSyncQueueItem,
  user: AuthUser
): Promise<void> {
  const data = sync.payload;

  // Validate required fields
  if (!data.firstName) {
    throw new ApiError(400, 'First name is required', ErrorCode.INVALID_INPUT);
  }

  if (sync.action === 'create') {
    // Check for duplicates before creating
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

    // Create beneficiary
    await prisma.beneficiary.create({
      data: {
        organizationId: user.organizationId,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone ? encryptField(data.phone) : null,
        email: data.email ? encryptField(data.email) : null,
        gender: data.gender,
        dateOfBirth: data.dateOfBirth
          ? new Date(data.dateOfBirth)
          : undefined,
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
async function syncAidDelivery(
  sync: OfflineSyncQueueItem,
  user: AuthUser
): Promise<void> {
  const data = sync.payload;

  // Verify enrollment exists
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
async function syncAttendance(
  sync: OfflineSyncQueueItem,
  user: AuthUser
): Promise<void> {
  const data = sync.payload;

  // Verify enrollment exists
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
    // Check for duplicate attendance on same date
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
async function syncCaseNote(
  sync: OfflineSyncQueueItem,
  user: AuthUser
): Promise<void> {
  const data = sync.payload;

  // Verify beneficiary exists
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
        content: data.content, // Should be encrypted at app layer
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

// ============================================================================
// POST /api/sync/offline/queue - Add to sync queue (offline operation)
// ============================================================================

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

// ============================================================================
// GET /api/sync/offline/conflicts - Get sync conflicts
// ============================================================================

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
