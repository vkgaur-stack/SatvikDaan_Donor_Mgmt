'use client';

import React, { useState, useCallback } from 'react';
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
  SyncStatus,
  SelectOption,
} from './base-components';
import { useCreateBeneficiary, CreateBeneficiaryInput } from '@/hooks/useApi';

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const BeneficiarySchema = z.object({
  firstName: z.string().min(2, 'First name required'),
  lastName: z.string().optional(),
  phone: z.string().regex(/^\d{10}$/, 'Valid 10-digit phone required'),
  email: z.string().email('Valid email required').optional().or(z.literal('')),
  gender: z.enum(['male', 'female', 'other'], { required_error: 'Gender required' }),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  uniqueId: z.string().optional(),
  uniqueIdType: z.enum(['aadhar', 'pan', 'voter_id', 'driving_license']).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  status: z.enum(['registered', 'active', 'inactive']).default('registered'),
  householdHead: z.string().optional(),
  membersCount: z.string().optional(),
  monthlyIncome: z.string().optional(),
  hasRationCard: z.boolean().default(false),
  programIds: z.array(z.string()).optional(),
});

type BeneficiaryFormData = z.infer<typeof BeneficiarySchema>;

interface BeneficiaryRegistrationFormProps {
  onSuccess?: (beneficiary: any) => void;
  onError?: (error: string) => void;
  programs?: Array<{ id: string; label: string }>;
  initialData?: Partial<BeneficiaryFormData>;
}

// ============================================================================
// FORM COMPONENT
// ============================================================================

export const BeneficiaryRegistrationForm: React.FC<BeneficiaryRegistrationFormProps> = ({
  onSuccess,
  onError,
  programs = [],
  initialData,
}) => {
  const [step, setStep] = useState(1);
  const [useDeviceLocation, setUseDeviceLocation] = useState(false);
  const { create, loading, error, success, data } = useCreateBeneficiary({
    onSuccess,
    onError,
  });

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    trigger,
    setValue,
  } = useForm<BeneficiaryFormData>({
    resolver: zodResolver(BeneficiarySchema),
    mode: 'onBlur',
    defaultValues: initialData || {
      status: 'registered',
      hasRationCard: false,
    },
  });

  // Get location if enabled
  const handleGetLocation = useCallback(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setValue('latitude', position.coords.latitude);
        setValue('longitude', position.coords.longitude);
      });
    }
  }, [setValue]);

  // Step 1: Personal Info
  const renderPersonalInfo = () => (
    <FormSection title="Personal Information" description="Basic details of the beneficiary">
      <Controller
        name="firstName"
        control={control}
        render={({ field }) => (
          <FormField label="First Name" error={errors.firstName?.message} required>
            <TextInput
              {...field}
              placeholder="Enter first name"
            />
          </FormField>
        )}
      />

      <Controller
        name="lastName"
        control={control}
        render={({ field }) => (
          <FormField label="Last Name" error={errors.lastName?.message}>
            <TextInput
              {...field}
              placeholder="Enter last name"
            />
          </FormField>
        )}
      />

      <Controller
        name="phone"
        control={control}
        render={({ field }) => (
          <FormField label="Phone Number" error={errors.phone?.message} required>
            <TextInput
              {...field}
              placeholder="10-digit mobile number"
            />
          </FormField>
        )}
      />

      <Controller
        name="email"
        control={control}
        render={({ field }) => (
          <FormField label="Email (Optional)" error={errors.email?.message}>
            <TextInput
              {...field}
              type="email"
              placeholder="email@example.com"
            />
          </FormField>
        )}
      />

      <Controller
        name="gender"
        control={control}
        render={({ field }) => (
          <FormField label="Gender" error={errors.gender?.message} required>
            <Select
              {...field}
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'other', label: 'Other' },
              ]}
              placeholder="Select gender"
            />
          </FormField>
        )}
      />

      <Controller
        name="dateOfBirth"
        control={control}
        render={({ field }) => (
          <FormField label="Date of Birth (Optional)" error={errors.dateOfBirth?.message}>
            <TextInput
              {...field}
              type="date"
            />
          </FormField>
        )}
      />
    </FormSection>
  );

  // Step 2: Address & ID
  const renderAddressAndId = () => (
    <FormSection title="Address & Identification" description="Residential and ID details">
      <Controller
        name="address"
        control={control}
        render={({ field }) => (
          <FormField label="Address (Optional)" error={errors.address?.message}>
            <TextArea
              {...field}
              placeholder="Full residential address"
              rows={4}
            />
          </FormField>
        )}
      />

      <FormField>
        <Checkbox
          checked={useDeviceLocation}
          onChange={(e) => {
            setUseDeviceLocation(e.target.checked);
            if (e.target.checked) handleGetLocation();
          }}
          label="Capture GPS Location"
        />
      </FormField>

      <Controller
        name="uniqueIdType"
        control={control}
        render={({ field }) => (
          <FormField label="ID Type (Optional)" error={errors.uniqueIdType?.message}>
            <Select
              {...field}
              options={[
                { value: 'aadhar', label: 'Aadhar' },
                { value: 'pan', label: 'PAN' },
                { value: 'voter_id', label: 'Voter ID' },
                { value: 'driving_license', label: 'Driving License' },
              ]}
              placeholder="Select ID type"
            />
          </FormField>
        )}
      />

      <Controller
        name="uniqueId"
        control={control}
        render={({ field }) => (
          <FormField label="ID Number (Optional)" error={errors.uniqueId?.message}>
            <TextInput
              {...field}
              placeholder="ID number"
            />
          </FormField>
        )}
      />
    </FormSection>
  );

  // Step 3: Household & Programs
  const renderHouseholdAndPrograms = () => (
    <FormSection title="Household Information" description="Family and program enrollment details">
      <Controller
        name="householdHead"
        control={control}
        render={({ field }) => (
          <FormField label="Household Head (Optional)" error={errors.householdHead?.message}>
            <TextInput
              {...field}
              placeholder="Name of head"
            />
          </FormField>
        )}
      />

      <Controller
        name="membersCount"
        control={control}
        render={({ field }) => (
          <FormField label="Household Members (Optional)" error={errors.membersCount?.message}>
            <TextInput
              {...field}
              type="number"
              placeholder="Number of members"
            />
          </FormField>
        )}
      />

      <Controller
        name="monthlyIncome"
        control={control}
        render={({ field }) => (
          <FormField label="Monthly Income (Optional)" error={errors.monthlyIncome?.message}>
            <TextInput
              {...field}
              type="number"
              placeholder="In rupees"
            />
          </FormField>
        )}
      />

      <FormField>
        <Controller
          name="hasRationCard"
          control={control}
          render={({ field }) => (
            <Checkbox
              {...field}
              label="Has Ration Card"
            />
          )}
        />
      </FormField>

      {programs.length > 0 && (
        <FormField label="Enroll in Programs (Optional)">
          <div className="space-y-2">
            {programs.map((prog) => (
              <Controller
                key={prog.id}
                name="programIds"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    checked={(field.value || []).includes(prog.id)}
                    onChange={(e) => {
                      const current = field.value || [];
                      if (e.target.checked) {
                        field.onChange([...current, prog.id]);
                      } else {
                        field.onChange(current.filter((id) => id !== prog.id));
                      }
                    }}
                    label={prog.label}
                  />
                )}
              />
            ))}
          </div>
        </FormField>
      )}
    </FormSection>
  );

  const onSubmit = async (formData: BeneficiaryFormData) => {
    try {
      const payload: CreateBeneficiaryInput = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        email: formData.email,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,
        address: formData.address,
        uniqueId: formData.uniqueId,
        uniqueIdType: formData.uniqueIdType,
        latitude: formData.latitude,
        longitude: formData.longitude,
        status: formData.status,
        household:
          formData.householdHead || formData.membersCount
            ? {
                householdHead: formData.householdHead || '',
                membersCount: parseInt(formData.membersCount || '1', 10),
                monthlyIncome: formData.monthlyIncome
                  ? parseInt(formData.monthlyIncome, 10)
                  : undefined,
                hasRationCard: formData.hasRationCard,
              }
            : undefined,
        programIds: formData.programIds,
      };

      await create(payload);
    } catch (err) {
      console.error('Form submission error:', err);
    }
  };

  // Handle next step
  const handleNextStep = async () => {
    const fieldsToValidate =
      step === 1
        ? ['firstName', 'phone', 'gender']
        : ['uniqueIdType', 'address'];

    const isValid = await trigger(fieldsToValidate as any);
    if (isValid) {
      setStep(step + 1);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Beneficiary Registration
        </h2>
        <p className="text-gray-600">Step {step} of 3</p>
        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <Alert
          type="error"
        >
          {error}
        </Alert>
      )}
      {success && (
        <Alert
          type="success"
        >
          Beneficiary registered successfully!
        </Alert>
      )}

      {/* Sync Status */}
      {typeof navigator !== 'undefined' && !navigator.onLine && (
        <div className="mb-4">
          <SyncStatus
            status="syncing"
            message="Working offline - data will sync when online"
          />
        </div>
      )}

      {/* Form Steps */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {step === 1 && renderPersonalInfo()}
        {step === 2 && renderAddressAndId()}
        {step === 3 && renderHouseholdAndPrograms()}

        {/* Navigation Buttons */}
        <div className="flex justify-between gap-4 pt-6">
          {step > 1 && (
            <FormButton
              type="button"
              onClick={() => setStep(step - 1)}
              variant="secondary"
              disabled={isSubmitting || loading}
            >
              Previous
            </FormButton>
          )}

          {step < 3 ? (
            <FormButton
              type="button"
              onClick={handleNextStep}
              disabled={isSubmitting || loading}
              className="ml-auto"
            >
              Next
            </FormButton>
          ) : (
            <FormButton
              type="submit"
              disabled={isSubmitting || loading}
              className="ml-auto"
            >
              {loading || isSubmitting ? 'Registering...' : 'Register Beneficiary'}
            </FormButton>
          )}
        </div>
      </form>

      {/* Success State */}
      {success && data && (
        <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
          <p className="text-green-800 font-medium">
            ✓ Beneficiary #{data.id} registered successfully
          </p>
          {typeof navigator !== 'undefined' && !navigator.onLine && (
            <p className="text-sm text-green-700 mt-2">
              Data saved locally and will sync when connection is restored
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default BeneficiaryRegistrationForm;
