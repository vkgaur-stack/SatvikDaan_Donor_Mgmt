// components/forms/BeneficiaryRegistrationForm.tsx
// Multi-step beneficiary registration form with offline support

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
          <TextInput
            {...field}
            label="First Name"
            placeholder="Enter first name"
            required
            error={errors.firstName?.message}
          />
        )}
      />

      <Controller
        name="lastName"
        control={control}
        render={({ field }) => (
          <TextInput
            {...field}
            label="Last Name"
            placeholder="Enter last name"
            error={errors. lastName?.message}
          />
        )}
      />

      <Controller
        name="phone"
        control={control}
        render={({ field }) => (
          <TextInput
            {...field}
            label="Phone Number"
            placeholder="10-digit mobile number"
            required
            error={errors.phone}
            helperText="Without +91 prefix"
          />
        )}
      />

      <Controller
        name="email"
        control={control}
        render={({ field }) => (
          <TextInput
            {...field}
            label="Email (Optional)"
            type="email"
            placeholder="email@example.com"
            error={errors.email}
          />
        )}
      />

      <Controller
        name="gender"
        control={control}
        render={({ field }) => (
          <Select
            {...field}
            label="Gender"
            required
            error={errors.gender}
            options={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
              { value: 'other', label: 'Other' },
            ]}
            placeholder="Select gender"
          />
        )}
      />

      <Controller
        name="dateOfBirth"
        control={control}
        render={({ field }) => (
          <TextInput
            {...field}
            label="Date of Birth (Optional)"
            type="date"
            error={errors.dateOfBirth}
          />
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
          <TextArea
            {...field}
            label="Address (Optional)"
            placeholder="Full residential address"
            error={errors.address}
            helperText="Village, street, district details"
          />
        )}
      />

      <div className="col-span-2 flex items-center space-x-2">
        <Checkbox
          checked={useDeviceLocation}
          onChange={(e) => {
            setUseDeviceLocation(e.target.checked);
            if (e.target.checked) handleGetLocation();
          }}
          label="Capture GPS Location"
        />
      </div>

      <Controller
        name="uniqueIdType"
        control={control}
        render={({ field }) => (
          <Select
            {...field}
            label="ID Type (Optional)"
            options={[
              { value: 'aadhar', label: 'Aadhar' },
              { value: 'pan', label: 'PAN' },
              { value: 'voter_id', label: 'Voter ID' },
              { value: 'driving_license', label: 'Driving License' },
            ]}
            placeholder="Select ID type"
            error={errors.uniqueIdType}
          />
        )}
      />

      <Controller
        name="uniqueId"
        control={control}
        render={({ field }) => (
          <TextInput
            {...field}
            label="ID Number (Optional)"
            placeholder="ID number"
            error={errors.uniqueId}
            helperText="This will be encrypted for security"
          />
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
          <TextInput
            {...field}
            label="Household Head (Optional)"
            placeholder="Name of head"
            error={errors.householdHead}
          />
        )}
      />

      <Controller
        name="membersCount"
        control={control}
        render={({ field }) => (
          <TextInput
            {...field}
            label="Household Members (Optional)"
            type="number"
            placeholder="Number of members"
            error={errors.membersCount}
          />
        )}
      />

      <Controller
        name="monthlyIncome"
        control={control}
        render={({ field }) => (
          <TextInput
            {...field}
            label="Monthly Income (Optional)"
            type="number"
            placeholder="In rupees"
            error={errors.monthlyIncome}
          />
        )}
      />

      <div className="col-span-1">
        <Controller
          name="hasRationCard"
          control={control}
          render={({ field }) => (
            <Checkbox {...field} label="Has Ration Card" />
          )}
        />
      </div>

      {programs.length > 0 && (
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Enroll in Programs (Optional)
          </label>
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
        </div>
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
          message={error}
          onDismiss={() => {
            /* Clear error */
          }}
        />
      )}
      {success && (
        <Alert
          type="success"
          message="Beneficiary registered successfully!"
          onDismiss={() => {
            /* Clear success */
          }}
        />
      )}

      {/* Sync Status */}
      {!navigator.onLine && (
        <div className="mb-4">
          <SyncStatus status="pending" message="Working offline - data will sync when online" />
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
              loading={loading || isSubmitting}
              disabled={isSubmitting || loading}
              className="ml-auto"
            >
              Register Beneficiary
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
          {!navigator.onLine && (
            <p className="text-sm text-green-700 mt-2">
              Data saved locally and will sync when connection is restored
            </p>
          )}
        </div>
      )}
    </div>
  );
};
