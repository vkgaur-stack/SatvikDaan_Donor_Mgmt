import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectedRoute, validateRequestBody } from '@/lib/auth';
import { successResponse, errorResponse, createAuditLog } from '@/lib/helpers';
import {
  ProcessSyncRequest,
  ProcessSyncResponse,
  AuthUser,
  ApiError,
  ErrorCode,
} from '@/types';
import {
  syncBeneficiary,
  syncAidDelivery,
  syncAttendance,
  syncCaseNote,
} from '@/lib/sync-queue';

export const GET = protectedRoute(
  async (request: NextRequest, user: AuthUser) => {
    try {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get('status') || 'pending';

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

      for (const sync of body.syncs) {
        try {
          results.totalProcessed++;

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

          await prisma.offlineSyncQueue.delete({
            where: { id: sync.entityId || '' },
          });
        } catch (error) {
          results.failed++;

          const errorMessage = error instanceof Error ? error.message : String(error);

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
