// middleware/auth.ts - Authentication and Authorization

import { jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import { AuthUser, ApiError, ErrorCode, UserRole } from '@/types';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-min-32-chars-long'
);

// ============================================================================
// EXTRACT TOKEN
// ============================================================================

/**
 * Extract JWT token from Authorization header
 */
export function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

// ============================================================================
// VERIFY TOKEN
// ============================================================================

/**
 * Verify and decode JWT token
 */
export async function verifyToken(token: string): Promise<AuthUser> {
  try {
    const verified = await jwtVerify(token, JWT_SECRET);
    const payload = verified.payload as any;

    return {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      organizationId: payload.organizationId,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch (error) {
    throw new ApiError(401, 'Invalid or expired token', ErrorCode.INVALID_TOKEN);
  }
}

// ============================================================================
// MIDDLEWARE: GET AUTHENTICATED USER
// ============================================================================

/**
 * Get authenticated user from request
 * Throws error if not authenticated
 */
export async function getAuthUser(request: NextRequest): Promise<AuthUser> {
  const token = extractToken(request);

  if (!token) {
    throw new ApiError(401, 'Missing authentication token', ErrorCode.UNAUTHORIZED);
  }

  return await verifyToken(token);
}

// ============================================================================
// MIDDLEWARE: CHECK AUTHORIZATION
// ============================================================================

/**
 * Check if user has required role(s)
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return async (request: NextRequest) => {
    try {
      const user = await getAuthUser(request);

      if (!allowedRoles.includes(user.role)) {
        throw new ApiError(
          403,
          'Insufficient permissions for this action',
          ErrorCode.FORBIDDEN
        );
      }

      return user;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(401, 'Authentication failed', ErrorCode.UNAUTHORIZED);
    }
  };
}

// ============================================================================
// MIDDLEWARE: REQUEST BODY VALIDATION
// ============================================================================

/**
 * Validate JSON request body
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  schema?: (data: any) => T
): Promise<T> {
  try {
    const body = await request.json();

    if (schema) {
      // If schema provided, validate using it
      return schema(body);
    }

    return body as T;
  } catch (error) {
    throw new ApiError(
      400,
      'Invalid or malformed request body',
      ErrorCode.INVALID_INPUT
    );
  }
}

// ============================================================================
// MIDDLEWARE: ORGANIZATION ISOLATION
// ============================================================================

/**
 * Ensure user can access requested organization
 */
export function requireOrgAccess(requestOrgId?: string) {
  return async (request: NextRequest) => {
    const user = await getAuthUser(request);

    // Admin can access any org, others must match
    if (user.role !== 'admin' && requestOrgId && requestOrgId !== user.organizationId) {
      throw new ApiError(
        403,
        'You do not have access to this organization',
        ErrorCode.FORBIDDEN
      );
    }

    return user;
  };
}

// ============================================================================
// WRAPPER: PROTECTED API ROUTE
// ============================================================================

/**
 * Wrap API route handler with authentication
 * Usage:
 *   export const GET = protectedRoute(async (req, user) => { ... })
 */
export function protectedRoute(
  handler: (
    request: NextRequest,
    user: AuthUser
  ) => Promise<Response> | Response,
  allowedRoles?: UserRole[]
) {
  return async (request: NextRequest, context?: any) => {
    try {
      const user = await getAuthUser(request);

      if (allowedRoles && !allowedRoles.includes(user.role)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Insufficient permissions for this action',
            statusCode: 403,
            timestamp: new Date().toISOString(),
          },
          { status: 403 }
        );
      }

      return await handler(request, user);
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
            statusCode: error.statusCode,
            timestamp: new Date().toISOString(),
          },
          { status: error.statusCode }
        );
      }

      console.error('Unhandled error in protected route:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }
  };
}

// ============================================================================
// SCHEMAS: SIMPLE VALIDATION
// ============================================================================

/**
 * Simple schema validators for common patterns
 */
export const schemas = {
  /**
   * Validate string field
   */
  string: (value: any, fieldName: string, minLength = 1, maxLength = 255) => {
    if (typeof value !== 'string' || value.trim().length < minLength) {
      throw new ApiError(
        400,
        `${fieldName} must be a string with at least ${minLength} characters`,
        ErrorCode.INVALID_INPUT
      );
    }
    if (value.length > maxLength) {
      throw new ApiError(
        400,
        `${fieldName} must be less than ${maxLength} characters`,
        ErrorCode.INVALID_INPUT
      );
    }
    return value.trim();
  },

  /**
   * Validate number field
   */
  number: (value: any, fieldName: string, min = 0, max = Infinity) => {
    if (typeof value !== 'number' || value < min || value > max) {
      throw new ApiError(
        400,
        `${fieldName} must be a number between ${min} and ${max}`,
        ErrorCode.INVALID_INPUT
      );
    }
    return value;
  },

  /**
   * Validate enum field
   */
  enum: (value: any, fieldName: string, allowedValues: string[]) => {
    if (!allowedValues.includes(value)) {
      throw new ApiError(
        400,
        `${fieldName} must be one of: ${allowedValues.join(', ')}`,
        ErrorCode.INVALID_INPUT
      );
    }
    return value;
  },

  /**
   * Validate email field
   */
  email: (value: any, fieldName: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof value !== 'string' || !emailRegex.test(value)) {
      throw new ApiError(400, `${fieldName} is not a valid email`, ErrorCode.INVALID_INPUT);
    }
    return value.toLowerCase();
  },

  /**
   * Validate optional field
   */
  optional: (value: any) => value ?? undefined,
};

// ============================================================================
// RATE LIMITING (Simple in-memory, use Redis for production)
// ============================================================================

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate limit middleware
 */
export function rateLimit(
  requestsPerMinute: number = 100
) {
  return (request: NextRequest) => {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const key = `${ip}:${request.nextUrl.pathname}`;

    const record = rateLimitStore.get(key);

    if (record && now < record.resetTime) {
      if (record.count >= requestsPerMinute) {
        return NextResponse.json(
          {
            success: false,
            error: 'Rate limit exceeded',
            statusCode: 429,
            timestamp: new Date().toISOString(),
          },
          { status: 429 }
        );
      }
      record.count++;
    } else {
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + 60 * 1000, // Reset after 1 minute
      });
    }

    return null; // Allow request
  };
}
