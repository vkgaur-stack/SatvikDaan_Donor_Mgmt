// hooks/useApi.ts - Custom React hooks for API integration with offline support

import { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';

// ============================================================================
// GENERIC API HOOK
// ============================================================================

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  success: boolean;
}

interface UseApiOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

export const useApi = <T = any,>(options: UseApiOptions = {}) => {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
    success: false,
  });

  const execute = useCallback(
    async (endpoint: string, method: string = 'GET', payload?: any) => {
      setState({ data: null, loading: true, error: null, success: false });

      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          throw new Error('No authentication token found');
        }

        const response = await fetch(endpoint, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: payload ? JSON.stringify(payload) : undefined,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'API request failed');
        }

        const result = await response.json();
        setState({ data: result.data, loading: false, error: null, success: true });
        options.onSuccess?.(result.data);
        return result.data;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState({ data: null, loading: false, error: errorMessage, success: false });
        options.onError?.(errorMessage);
        throw error;
      }
    },
    [options]
  );

  return { ...state, execute };
};

// ============================================================================
// BENEFICIARY HOOKS
// ============================================================================

export interface CreateBeneficiaryInput {
  firstName: string;
  lastName?: string;
  phone: string;
  email?: string;
  gender: 'male' | 'female' | 'other';
  dateOfBirth?: string;
  address?: string;
  uniqueId?: string;
  uniqueIdType?: string;
  latitude?: number;
  longitude?: number;
  status?: string;
  household?: {
    householdHead: string;
    membersCount: number;
    monthlyIncome?: number;
    hasRationCard?: boolean;
  };
  programIds?: string[];
}

export const useCreateBeneficiary = (options?: UseApiOptions) => {
  const api = useApi<any>(options);

  const create = useCallback(
    async (data: CreateBeneficiaryInput) => {
      // First check offline queue
      const offlineQueue = localStorage.getItem('offlineQueue') || '[]';
      const queue = JSON.parse(offlineQueue);

      if (!navigator.onLine) {
        // Queue for later sync
        const queueItem = {
          id: `offline-${Date.now()}`,
          entity: 'beneficiary',
          action: 'create',
          payload: data,
          timestamp: new Date().toISOString(),
          status: 'pending',
        };
        queue.push(queueItem);
        localStorage.setItem('offlineQueue', JSON.stringify(queue));
        return { queued: true, data: queueItem };
      }

      return api.execute('/api/beneficiaries', 'POST', data);
    },
    [api]
  );

  return { ...api, create };
};

// ============================================================================
// DONATION HOOKS
// ============================================================================

export interface CreateDonationInput {
  donorId: string;
  donorName: string;
  donorEmail: string;
  amount: number;
  paymentMethod: 'cash' | 'cheque' | 'bank_transfer' | 'online';
  programId?: string;
  campaignTag?: string;
  acknowledgeReceipt?: boolean;
  notes?: string;
}

export interface RazorpayDonationInput {
  donorId: string;
  amount: number;
  programId?: string;
  currency?: string;
}

export const useDonation = (options?: UseApiOptions) => {
  const api = useApi<any>(options);
  const [razorpayOrderId, setRazorpayOrderId] = useState<string | null>(null);

  const createDonation = useCallback(
    async (data: CreateDonationInput) => {
      return api.execute('/api/donations', 'POST', data);
    },
    [api]
  );

  const createRazorpayOrder = useCallback(
    async (data: RazorpayDonationInput) => {
      const result = await api.execute('/api/donations/razorpay/orders', 'POST', data);
      if (result?.orderId) {
        setRazorpayOrderId(result.orderId);
      }
      return result;
    },
    [api]
  );

  const verifyRazorpayPayment = useCallback(
    async (paymentId: string, signature: string) => {
      return api.execute('/api/donations/razorpay/verify', 'POST', {
        paymentId,
        signature,
        orderId: razorpayOrderId,
      });
    },
    [api, razorpayOrderId]
  );

  return {
    ...api,
    createDonation,
    createRazorpayOrder,
    verifyRazorpayPayment,
    razorpayOrderId,
  };
};

// ============================================================================
// ENROLLMENT HOOKS
// ============================================================================

export interface CreateEnrollmentInput {
  beneficiaryId: string;
  programId: string;
  enrollmentDate?: string;
  status?: string;
}

export const useEnrollment = (options?: UseApiOptions) => {
  const api = useApi<any>(options);

  const enroll = useCallback(
    async (data: CreateEnrollmentInput) => {
      return api.execute('/api/enrollments', 'POST', data);
    },
    [api]
  );

  return { ...api, enroll };
};

// ============================================================================
// CASE NOTE HOOKS
// ============================================================================

export interface CreateCaseNoteInput {
  beneficiaryId: string;
  noteType: string;
  content: string;
  actionItems?: string[];
}

export const useCaseNote = (options?: UseApiOptions) => {
  const api = useApi<any>(options);

  const create = useCallback(
    async (data: CreateCaseNoteInput) => {
      // Queue for offline if needed
      if (!navigator.onLine) {
        const offlineQueue = localStorage.getItem('offlineQueue') || '[]';
        const queue = JSON.parse(offlineQueue);
        const queueItem = {
          id: `offline-${Date.now()}`,
          entity: 'case_note',
          action: 'create',
          payload: data,
          timestamp: new Date().toISOString(),
          status: 'pending',
        };
        queue.push(queueItem);
        localStorage.setItem('offlineQueue', JSON.stringify(queue));
        return { queued: true, data: queueItem };
      }

      return api.execute('/api/beneficiaries/case-notes', 'POST', data);
    },
    [api]
  );

  return { ...api, create };
};

// ============================================================================
// OFFLINE SYNC HOOK
// ============================================================================

export const useOfflineSync = (options?: UseApiOptions) => {
  const api = useApi<any>(options);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'syncing' | 'error'>(
    'synced'
  );
  const [pendingCount, setPendingCount] = useState(0);

  // Check for pending offline operations
  useEffect(() => {
    const checkPending = () => {
      const queue = localStorage.getItem('offlineQueue');
      if (queue) {
        const items = JSON.parse(queue);
        setPendingCount(items.length);
        setSyncStatus(items.length > 0 ? 'pending' : 'synced');
      }
    };

    checkPending();
    const interval = setInterval(checkPending, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const processSync = useCallback(async () => {
    if (!navigator.onLine) {
      setSyncStatus('error');
      throw new Error('No internet connection');
    }

    setSyncStatus('syncing');

    try {
      const queue = localStorage.getItem('offlineQueue');
      if (!queue) {
        setSyncStatus('synced');
        return;
      }

      const syncs = JSON.parse(queue);
      if (syncs.length === 0) {
        setSyncStatus('synced');
        return;
      }

      const response = await api.execute('/api/sync/offline', 'POST', { syncs });

      // Clear successfully synced items
      const remaining = syncs.filter((item: any) =>
        response.conflicts?.some((c: any) => c.queueId === item.id)
      );

      if (remaining.length > 0) {
        localStorage.setItem('offlineQueue', JSON.stringify(remaining));
        setSyncStatus('error');
      } else {
        localStorage.removeItem('offlineQueue');
        setSyncStatus('synced');
      }

      setPendingCount(remaining.length);
      return response;
    } catch (error) {
      setSyncStatus('error');
      throw error;
    }
  }, [api]);

  // Auto-sync when online
  useEffect(() => {
    const handleOnline = () => {
      const queue = localStorage.getItem('offlineQueue');
      if (queue && JSON.parse(queue).length > 0) {
        processSync();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [processSync]);

  return {
    ...api,
    syncStatus,
    pendingCount,
    processSync,
  };
};

// ============================================================================
// AUTH HOOK
// ============================================================================

export interface LoginInput {
  email: string;
  password: string;
}

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem('authToken')
  );
  const [user, setUser] = useState<any>(null);
  const api = useApi();

  const login = useCallback(
    async (credentials: LoginInput) => {
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials),
        });

        if (!response.ok) throw new Error('Login failed');

        const data = await response.json();
        localStorage.setItem('authToken', data.data.token);
        setUser(data.data.user);
        setIsAuthenticated(true);
        return data.data;
      } catch (error) {
        throw error;
      }
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('offlineQueue');
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  return { isAuthenticated, user, login, logout };
};
