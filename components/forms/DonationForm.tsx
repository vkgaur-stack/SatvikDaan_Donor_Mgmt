// components/forms/DonationForm.tsx
// Donation form with Razorpay payment integration

import React, { useState, useCallback, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  FormField,
  TextInput,
  TextArea,
  Select,
  Checkbox,
  FormButton,
  FormSection,
  Alert,
} from './base-components';
import { useDonation, CreateDonationInput, RazorpayDonationInput } from '@/hooks/useApi';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const DonationSchema = z.object({
  donorName: z.string().min(2, 'Donor name required'),
  donorEmail: z.string().email('Valid email required'),
  amount: z.string().min(1, 'Amount required').transform((v) => parseFloat(v)),
  paymentMethod: z.enum(['cash', 'cheque', 'bank_transfer', 'online'], {
    required_error: 'Payment method required',
  }),
  programId: z.string().optional(),
  campaignTag: z.string().optional(),
  chequeNumber: z.string().optional(),
  bankName: z.string().optional(),
  acknowledgeReceipt: z.boolean().default(true),
  notes: z.string().optional(),
});

type DonationFormData = z.infer<typeof DonationSchema>;

interface DonationFormProps {
  onSuccess?: (donation: any) => void;
  onError?: (error: string) => void;
  programs?: Array<{ id: string; label: string }>;
  campaigns?: Array<{ id: string; label: string }>;
  razorpayKeyId?: string; // Public key from env
  isDonor?: boolean; // If true, donor is pre-filled
  donorId?: string;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

// ============================================================================
// DONATION FORM COMPONENT
// ============================================================================

export const DonationForm: React.FC<DonationFormProps> = ({
  onSuccess,
  onError,
  programs = [],
  campaigns = [],
  razorpayKeyId,
  isDonor = false,
  donorId,
}) => {
  const [showRazorpayForm, setShowRazorpayForm] = useState(false);
  const [razorpayLoading, setRazorpayLoading] = useState(false);
  const {
    createDonation,
    createRazorpayOrder,
    verifyRazorpayPayment,
    loading,
    error,
    success,
    data,
  } = useDonation({
    onSuccess,
    onError,
  });

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<DonationFormData>({
    resolver: zodResolver(DonationSchema),
    mode: 'onBlur',
    defaultValues: {
      paymentMethod: 'online',
      acknowledgeReceipt: true,
    },
  });

  const paymentMethod = watch('paymentMethod');
  const amount = watch('amount');

  // Load Razorpay script
  useEffect(() => {
    if (razorpayKeyId && !window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, [razorpayKeyId]);

  // Handle Razorpay payment
  const handleRazorpayPayment = useCallback(async () => {
    try {
      setRazorpayLoading(true);
      const formData = getValues();

      // Create Razorpay order
      const orderData: RazorpayDonationInput = {
        donorId: donorId || 'new-' + Date.now(),
        amount: formData.amount,
        programId: formData.programId,
        currency: 'INR',
      };

      const order = await createRazorpayOrder(orderData);

      if (!order?.orderId || !razorpayKeyId) {
        throw new Error('Failed to create Razorpay order');
      }

      // Open Razorpay modal
      const options = {
        key: razorpayKeyId,
        amount: formData.amount * 100, // Convert to paise
        currency: 'INR',
        name: 'Satvikdaan',
        description: `Donation to ${formData.programId ? 'Program' : 'General Fund'}`,
        order_id: order.orderId,
        prefill: {
          name: formData.donorName,
          email: formData.donorEmail,
        },
        handler: async (response: any) => {
          try {
            // Verify payment
            const verified = await verifyRazorpayPayment(
              response.razorpay_payment_id,
              response.razorpay_signature
            );

            if (verified) {
              onSuccess?.(verified);
              setShowRazorpayForm(false);
            }
          } catch (err) {
            onError?.(err instanceof Error ? err.message : 'Payment verification failed');
          } finally {
            setRazorpayLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setRazorpayLoading(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Payment failed';
      onError?.(errorMsg);
      setRazorpayLoading(false);
    }
  }, [getValues, createRazorpayOrder, verifyRazorpayPayment, razorpayKeyId, donorId, onSuccess, onError]);

  const onSubmit = async (formData: DonationFormData) => {
    try {
      if (formData.paymentMethod === 'online') {
        // Trigger Razorpay flow
        setShowRazorpayForm(true);
        await handleRazorpayPayment();
      } else {
        // Create regular donation
        const payload: CreateDonationInput = {
          donorId: donorId || 'donor-' + Date.now(),
          donorName: formData.donorName,
          donorEmail: formData.donorEmail,
          amount: formData.amount,
          paymentMethod: formData.paymentMethod,
          programId: formData.programId,
          campaignTag: formData.campaignTag,
          acknowledgeReceipt: formData.acknowledgeReceipt,
          notes: formData.notes,
        };

        await createDonation(payload);
      }
    } catch (err) {
      console.error('Form submission error:', err);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Record Donation</h2>
      <p className="text-gray-600 mb-6">
        {isDonor ? 'Add a new donation' : 'Register a donor and process donation'}
      </p>

      {/* Status Messages */}
      {error && (
        <Alert
          type="error"
          message={error}
          onDismiss={() => {
            /* Clear */
          }}
        />
      )}
      {success && (
        <Alert
          type="success"
          message="Donation recorded successfully!"
          onDismiss={() => {
            /* Clear */
          }}
        />
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Donor Information */}
        <FormSection title="Donor Information" description="Donor details for receipt and communication">
          <Controller
            name="donorName"
            control={control}
            render={({ field }) => (
              <TextInput
                {...field}
                label="Donor Name"
                placeholder="Full name"
                required
                error={errors.donorName}
              />
            )}
          />

          <Controller
            name="donorEmail"
            control={control}
            render={({ field }) => (
              <TextInput
                {...field}
                label="Email Address"
                type="email"
                placeholder="email@example.com"
                required
                error={errors.donorEmail}
                helperText="For receipt delivery"
              />
            )}
          />
        </FormSection>

        {/* Donation Details */}
        <FormSection
          title="Donation Details"
          description="Amount and payment information"
        >
          <Controller
            name="amount"
            control={control}
            render={({ field }) => (
              <TextInput
                {...field}
                label="Amount (₹)"
                type="number"
                placeholder="0.00"
                required
                error={errors.amount}
                helperText="Minimum ₹100"
                inputMode="numeric"
              />
            )}
          />

          <Controller
            name="paymentMethod"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                label="Payment Method"
                required
                error={errors.paymentMethod}
                options={[
                  { value: 'online', label: 'Online (Razorpay)' },
                  { value: 'cash', label: 'Cash' },
                  { value: 'cheque', label: 'Cheque' },
                  { value: 'bank_transfer', label: 'Bank Transfer' },
                ]}
                placeholder="Select payment method"
              />
            )}
          />

          {/* Cheque Details */}
          {paymentMethod === 'cheque' && (
            <>
              <Controller
                name="chequeNumber"
                control={control}
                render={({ field }) => (
                  <TextInput
                    {...field}
                    label="Cheque Number"
                    placeholder="Cheque number"
                    error={errors.chequeNumber}
                  />
                )}
              />

              <Controller
                name="bankName"
                control={control}
                render={({ field }) => (
                  <TextInput
                    {...field}
                    label="Bank Name"
                    placeholder="Bank name"
                    error={errors.bankName}
                  />
                )}
              />
            </>
          )}

          {programs.length > 0 && (
            <Controller
              name="programId"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  label="Program (Optional)"
                  options={programs}
                  placeholder="Select program"
                  error={errors.programId}
                />
              )}
            />
          )}

          {campaigns.length > 0 && (
            <Controller
              name="campaignTag"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  label="Campaign (Optional)"
                  options={campaigns}
                  placeholder="Select campaign"
                  error={errors.campaignTag}
                />
              )}
            />
          )}
        </FormSection>

        {/* Additional Options */}
        <FormSection title="Receipt & Communication" description="How to deliver receipt and gratitude">
          <Controller
            name="acknowledgeReceipt"
            control={control}
            render={({ field }) => (
              <Checkbox
                {...field}
                label="Send thank-you email with tax receipt"
              />
            )}
          />

          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <TextArea
                {...field}
                label="Internal Notes (Optional)"
                placeholder="Any special notes about this donation"
                error={errors.notes}
              />
            )}
          />
        </FormSection>

        {/* Amount Summary */}
        {amount && (
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-sm text-gray-600">
              Donation Amount:
            </p>
            <p className="text-3xl font-bold text-blue-600">
              ₹{parseFloat(amount || '0').toLocaleString('en-IN', {
                minimumFractionDigits: 2,
              })}
            </p>
            {paymentMethod === 'online' && (
              <p className="text-xs text-gray-500 mt-2">
                Transaction fee will be deducted by payment gateway
              </p>
            )}
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-4 pt-6">
          <FormButton
            type="submit"
            loading={loading || isSubmitting || razorpayLoading}
            disabled={isSubmitting || loading || razorpayLoading}
          >
            {paymentMethod === 'online' ? 'Proceed to Payment' : 'Record Donation'}
          </FormButton>
        </div>
      </form>

      {/* Success State */}
      {success && data && (
        <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
          <p className="text-green-800 font-medium">
            ✓ Donation #{data.receiptNumber || data.id} recorded successfully
          </p>
          {data.taxReceiptNo && (
            <p className="text-sm text-green-700 mt-2">
              Tax Receipt: {data.taxReceiptNo}
            </p>
          )}
          {data.acknowledgmentSent && (
            <p className="text-sm text-green-700">
              Thank-you email sent to {data.donor?.email}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// QUICK DONATION CARD (For Homepage/Dashboard)
// ============================================================================

interface QuickDonationCardProps {
  onDonate: (amount: number) => void;
  loading?: boolean;
}

export const QuickDonationCard: React.FC<QuickDonationCardProps> = ({
  onDonate,
  loading = false,
}) => {
  const presetAmounts = [100, 500, 1000, 5000, 10000];

  return (
    <div className="bg-white rounded-lg shadow p-6 max-w-sm">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Donation</h3>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {presetAmounts.map((amount) => (
          <button
            key={amount}
            onClick={() => onDonate(amount)}
            disabled={loading}
            className="px-3 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 disabled:opacity-50 font-medium text-sm"
          >
            ₹{amount}
          </button>
        ))}
      </div>
      <FormButton
        onClick={() => onDonate(0)}
        disabled={loading}
        className="w-full"
      >
        Custom Amount
      </FormButton>
    </div>
  );
};
