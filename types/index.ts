// types.ts - Type definitions for Satvikdaan API

export type UserRole = 'admin' | 'program_manager' | 'field_worker' | 'donor' | 'auditor';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string;
  iat?: number;
  exp?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  statusCode: number;
  timestamp: string;
}

// ============================================================================
// BENEFICIARY TYPES
// ============================================================================

export interface CreateBeneficiaryRequest {
  firstName: string;
  lastName?: string;
  phone?: string;
  email?: string;
  gender?: 'male' | 'female' | 'other';
  dateOfBirth?: string; // ISO date
  address?: string;
  latitude?: number;
  longitude?: number;
  uniqueId?: string; // Aadhar/ID
  uniqueIdType?: 'aadhar' | 'voter_id' | 'pan' | 'driving_license';
  profilePhoto?: string; // Base64
  household?: {
    householdHead: string;
    membersCount: number;
    monthlyIncome?: number;
    incomeCategory?: 'low' | 'medium' | 'high';
    address?: string;
  };
  programIds?: string[];
}

export interface UpdateBeneficiaryRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  gender?: 'male' | 'female' | 'other';
  dateOfBirth?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  status?: 'registered' | 'verified' | 'active' | 'inactive' | 'graduated';
}

export interface BeneficiaryResponse {
  id: string;
  organizationId: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  email?: string;
  gender?: string;
  dateOfBirth?: string;
  address?: string;
  status: string;
  household?: {
    id: string;
    householdHead: string;
    membersCount: number;
    monthlyIncome?: number;
  };
  enrollments?: Array<{
    id: string;
    programId: string;
    status: string;
    enrollmentDate: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface ListBeneficiariesQuery {
  organizationId: string;
  page?: number;
  pageSize?: number;
  status?: string;
  gender?: string;
  programId?: string;
  search?: string; // Search by name or phone
}

// ============================================================================
// ENROLLMENT TYPES
// ============================================================================

export interface CreateEnrollmentRequest {
  beneficiaryId: string;
  programId: string;
  notes?: string;
}

export interface EnrollmentResponse {
  id: string;
  beneficiaryId: string;
  programId: string;
  enrollmentDate: string;
  status: string;
  eligibilityScore?: number;
}

// ============================================================================
// DONATION TYPES
// ============================================================================

export interface CreateDonationRequest {
  donorId: string;
  amount: number; // In INR
  paymentMethod: 'online' | 'cheque' | 'cash' | 'bank_transfer';
  programId?: string;
  campaignTag?: string;
  frequency?: 'one_off' | 'monthly' | 'annual' | 'recurring';
  notes?: string;
}

export interface RazorpayDonationRequest extends CreateDonationRequest {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface DonationResponse {
  id: string;
  donorId: string;
  amount: number;
  currency: string;
  donationDate: string;
  paymentMethod: string;
  status: string;
  taxReceiptStatus: string;
  taxReceiptNo?: string;
  acknowledgmentSent: boolean;
  createdAt: string;
}

export interface TaxReceiptData {
  donationId: string;
  donorName: string;
  donorEmail: string;
  donorPAN?: string;
  amount: number;
  donationDate: string;
  organizationName: string;
  organizationTaxId: string;
  receiptNo: string;
  receiptDate: string;
}

// ============================================================================
// AID DELIVERY TYPES
// ============================================================================

export interface CreateAidDeliveryRequest {
  beneficiaryId: string;
  programId: string;
  enrollmentId: string;
  deliveryType: 'cash' | 'in_kind' | 'service';
  amount?: number;
  description: string;
  proofOfDelivery?: string; // Base64 photo
  signature?: string; // Digital signature
}

export interface AidDeliveryResponse {
  id: string;
  beneficiaryId: string;
  programId: string;
  deliveryType: string;
  amount?: number;
  status: string;
  deliveryDate: string;
  proofOfDelivery?: string;
  createdAt: string;
}

// ============================================================================
// OFFLINE SYNC TYPES
// ============================================================================

export interface OfflineSyncQueueItem {
  entity: 'beneficiary' | 'aid_delivery' | 'attendance' | 'case_note';
  entityId?: string;
  action: 'create' | 'update' | 'delete';
  payload: Record<string, any>;
}

export interface ProcessSyncRequest {
  userId: string;
  syncs: OfflineSyncQueueItem[];
}

export interface ProcessSyncResponse {
  totalProcessed: number;
  successful: number;
  failed: number;
  conflicts: Array<{
    queueId: string;
    entity: string;
    entityId?: string;
    error: string;
  }>;
}

// ============================================================================
// AUDIT LOG TYPES
// ============================================================================

export interface AuditLogQuery {
  organizationId: string;
  action?: 'view' | 'create' | 'update' | 'delete' | 'export';
  resourceType?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogResponse {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  beforeValue?: any;
  afterValue?: any;
  ipAddress?: string;
  createdAt: string;
}

// ============================================================================
// DONOR TYPES
// ============================================================================

export interface CreateDonorRequest {
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  address?: string;
  panNumber?: string;
  companyName?: string;
  donorType?: 'individual' | 'corporate';
  tier?: 'bronze' | 'silver' | 'gold' | 'major';
  preferredContact?: 'email' | 'phone' | 'sms';
}

export interface DonorResponse {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  tier: string;
  status: string;
  lifetimeValue: number;
  lastGiftDate?: string;
  donationCount?: number;
  createdAt: string;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export enum ErrorCode {
  // Authentication
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',

  // Validation
  INVALID_INPUT = 'INVALID_INPUT',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  NOT_FOUND = 'NOT_FOUND',

  // Business Logic
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  INVALID_ENROLLMENT = 'INVALID_ENROLLMENT',
  INVALID_DONATION = 'INVALID_DONATION',
  SYNC_CONFLICT = 'SYNC_CONFLICT',

  // External Services
  RAZORPAY_ERROR = 'RAZORPAY_ERROR',
  EMAIL_SERVICE_ERROR = 'EMAIL_SERVICE_ERROR',

  // Server
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
