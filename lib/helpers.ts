// utils/helpers.ts - Validation, error handling, and audit logging

import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import {
  ApiResponse,
  ApiError,
  AuthUser,
  ErrorCode,
  AuditLogResponse,
} from '@/types';
import { decryptField } from './crypto';

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

/**
 * Send successful API response
 */
export function successResponse<T>(
  data: T,
  statusCode: number = 200,
  message?: string
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      message,
      statusCode,
      timestamp: new Date().toISOString(),
    },
    { status: statusCode }
  );
}

/**
 * Send error API response
 */
export function errorResponse(
  error: ApiError | Error | string,
  statusCode: number = 500
): NextResponse<ApiResponse> {
  let message = 'Internal Server Error';
  let code = ErrorCode.INTERNAL_ERROR;

  if (error instanceof ApiError) {
    message = error.message;
    code = error.code || ErrorCode.INTERNAL_ERROR;
    statusCode = error.statusCode;
  } else if (error instanceof Error) {
    message = error.message;
  } else {
    message = String(error);
  }

  console.error(`[API Error] ${code}: ${message}`);

  return NextResponse.json(
    {
      success: false,
      error: message,
      statusCode,
      timestamp: new Date().toISOString(),
    },
    { status: statusCode }
  );
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhone(phone: string): boolean {
  // Indian phone number: 10 digits starting with 6-9
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone.replace(/\D/g, ''));
}

export function validateAadhar(aadhar: string): boolean {
  // Aadhar: 12 digits
  return /^\d{12}$/.test(aadhar.replace(/\D/g, ''));
}

export function validatePAN(pan: string): boolean {
  // PAN format: AAAAP5055K
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(pan);
}

export function validateAmount(amount: number): boolean {
  return amount > 0 && amount <= 10000000; // Max 1 crore
}

export function validatePagination(
  page?: number,
  pageSize?: number
): { page: number; pageSize: number } {
  const p = page || 1;
  const ps = pageSize || 20;

  if (p < 1) throw new ApiError(400, 'Page must be >= 1', ErrorCode.INVALID_INPUT);
  if (ps < 1 || ps > 100)
    throw new ApiError(400, 'Page size must be 1-100', ErrorCode.INVALID_INPUT);

  return { page: p, pageSize: ps };
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

export async function createAuditLog(
  organizationId: string,
  userId: string,
  action: 'create' | 'read' | 'update' | 'delete' | 'export' | 'view',
  resourceType: string,
  resourceId: string | null,
  request: NextRequest,
  beforeValue?: any,
  afterValue?: any
): Promise<void> {
  try {
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action,
        resourceType,
        resourceId: resourceId || undefined,
        beforeValue: beforeValue ? JSON.stringify(beforeValue) : undefined,
        afterValue: afterValue ? JSON.stringify(afterValue) : undefined,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    // Don't fail the request if audit logging fails
    console.error('Audit log creation failed:', error);
  }
}

/**
 * Get audit logs for compliance reporting
 */
export async function getAuditLogs(
  organizationId: string,
  filters?: {
    userId?: string;
    action?: string;
    resourceType?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    pageSize?: number;
  }
): Promise<{
  data: AuditLogResponse[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const { page = 1, pageSize = 50 } = validatePagination(
    filters?.page,
    filters?.pageSize
  );

  const where: any = { organizationId };

  if (filters?.userId) where.userId = filters.userId;
  if (filters?.action) where.action = filters.action;
  if (filters?.resourceType) where.resourceType = filters.resourceType;

  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = filters.startDate;
    if (filters.endDate) where.createdAt.lte = filters.endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    data: logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      userName: log.user.name,
      action: log.action as any,
      resourceType: log.resourceType,
      resourceId: log.resourceId || undefined,
      beforeValue: log.beforeValue ? JSON.parse(log.beforeValue) : undefined,
      afterValue: log.afterValue ? JSON.parse(log.afterValue) : undefined,
      ipAddress: log.ipAddress || undefined,
      createdAt: log.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  };
}

// ============================================================================
// DATA MASKING FOR AUDITORS
// ============================================================================

/**
 * Mask sensitive beneficiary data for auditors
 */
export function maskBeneficiaryForAudit(beneficiary: any) {
  return {
    id: beneficiary.id.substring(0, 8) + 'XXXX', // Partial ID
    programIds: beneficiary.programIds,
    status: beneficiary.status,
    createdAt: beneficiary.createdAt,
    // Hide: name, phone, email, address, medical details
  };
}

/**
 * Mask sensitive donor data for auditors
 */
export function maskDonorForAudit(donor: any) {
  return {
    id: donor.id.substring(0, 8) + 'XXXX',
    tier: donor.tier,
    lifetimeValue: donor.lifetimeValue,
    donationCount: donor.donationCount,
    lastGiftDate: donor.lastGiftDate,
    // Hide: name, email, phone, address, PAN
  };
}

/**
 * Mask donation details for auditors
 */
export function maskDonationForAudit(donation: any) {
  return {
    id: donation.id,
    amount: donation.amount,
    currency: donation.currency,
    donationDate: donation.donationDate,
    programId: donation.programId,
    frequency: donation.frequency,
    status: donation.status,
    taxReceiptStatus: donation.taxReceiptStatus,
    // Hide: donorId, razorpay details
  };
}

// ============================================================================
// DATABASE HELPERS
// ============================================================================

/**
 * Check if beneficiary exists and belongs to organization
 */
export async function getBeneficiaryOrThrow(
  beneficiaryId: string,
  organizationId: string
) {
  const beneficiary = await prisma.beneficiary.findFirst({
    where: { id: beneficiaryId, organizationId, deletedAt: null },
  });

  if (!beneficiary) {
    throw new ApiError(404, 'Beneficiary not found', ErrorCode.NOT_FOUND);
  }

  return beneficiary;
}

/**
 * Check if donor exists
 */
export async function getDonorOrThrow(donorId: string, organizationId: string) {
  const donor = await prisma.donor.findFirst({
    where: { id: donorId, organizationId, deletedAt: null },
  });

  if (!donor) {
    throw new ApiError(404, 'Donor not found', ErrorCode.NOT_FOUND);
  }

  return donor;
}

/**
 * Check if program exists
 */
export async function getProgramOrThrow(
  programId: string,
  organizationId: string
) {
  const program = await prisma.program.findFirst({
    where: { id: programId, organizationId, deletedAt: null },
  });

  if (!program) {
    throw new ApiError(404, 'Program not found', ErrorCode.NOT_FOUND);
  }

  return program;
}

/**
 * Check if enrollment exists
 */
export async function getEnrollmentOrThrow(
  enrollmentId: string,
  organizationId: string
) {
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      id: enrollmentId,
      beneficiary: { organizationId },
    },
    include: { beneficiary: true },
  });

  if (!enrollment) {
    throw new ApiError(404, 'Enrollment not found', ErrorCode.NOT_FOUND);
  }

  return enrollment;
}

// ============================================================================
// NOTIFICATION HELPERS
// ============================================================================

/**
 * Send thank-you email to donor
 */
export async function sendDonationThankYouEmail(
  donorEmail: string,
  donorName: string,
  amount: number,
  organizationName: string
): Promise<void> {
  try {
    const htmlContent = `
      <h2>Thank You for Your Generosity!</h2>
      <p>Dear ${donorName},</p>
      <p>We are grateful for your donation of <strong>₹${amount}</strong> to ${organizationName}.</p>
      <p>Your support makes a real difference in the lives of our beneficiaries.</p>
      <p>A tax receipt has been generated and will be sent separately.</p>
      <p>With gratitude,<br/>The ${organizationName} Team</p>
    `;

    // TODO: Integrate with SendGrid/Email service
    console.log(`[Email] Thank you email to ${donorEmail} for ₹${amount}`);

    // await sendgrid.send({
    //   to: donorEmail,
    //   from: 'noreply@satvikdaan.org',
    //   subject: `Thank you for your donation to ${organizationName}`,
    //   html: htmlContent,
    // });
  } catch (error) {
    console.error('Failed to send thank-you email:', error);
    // Don't throw - email failure shouldn't fail donation creation
  }
}

/**
 * Send WhatsApp notification to beneficiary
 */
export async function sendBeneficiaryNotification(
  phone: string,
  message: string
): Promise<void> {
  try {
    // Decrypt phone if encrypted
    const decryptedPhone = phone.includes(':')
      ? decryptField(phone)
      : phone;

    // TODO: Integrate with Twilio/Gupshup WhatsApp API
    console.log(`[WhatsApp] To ${decryptedPhone}: ${message}`);

    // await twilio.messages.create({
    //   body: message,
    //   from: 'whatsapp:+14155552671',
    //   to: `whatsapp:+91${decryptedPhone}`,
    // });
  } catch (error) {
    console.error('Failed to send WhatsApp notification:', error);
  }
}

// ============================================================================
// RAZORPAY HELPERS
// ============================================================================

/**
 * Generate receipt number
 */
export function generateReceiptNumber(donationId: string): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();

  return `REC-${year}-${month}-${random}`;
}

/**
 * Format amount for Razorpay (convert to smallest currency unit)
 */
export function formatAmountForRazorpay(amountInRupees: number): number {
  // Razorpay expects amount in paise (smallest unit)
  return Math.round(amountInRupees * 100);
}

/**
 * Format amount from Razorpay (convert from smallest currency unit)
 */
export function formatAmountFromRazorpay(amountInPaise: number): number {
  return amountInPaise / 100;
}
