// components/forms/EnrollmentForm.tsx & CaseNoteForm.tsx
// Forms for program enrollment and case notes

import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  FormField,
  TextInput,
  TextArea,
  Select,
  FormButton,
  FormSection,
  Alert,
} from './base-components';
import { useEnrollment, useCaseNote } from '@/hooks/useApi';

// ============================================================================
// ENROLLMENT FORM
// ============================================================================

const EnrollmentSchema = z.object({
  beneficiaryId: z.string().min(1, 'Beneficiary required'),
  programId: z.string().min(1, 'Program required'),
  enrollmentDate: z.string().optional(),
  status: z.enum(['enrolled', 'in_progress', 'completed', 'dropped_out']).default('enrolled'),
});

type EnrollmentFormData = z.infer<typeof EnrollmentSchema>;

interface EnrollmentFormProps {
  onSuccess?: (enrollment: any) => void;
  onError?: (error: string) => void;
  beneficiaries?: Array<{ id: string; label: string }>;
  programs?: Array<{ id: string; label: string }>;
  beneficiaryId?: string; // Pre-fill if known
  programId?: string;
  isQuickEnroll?: boolean; // Show minimal fields
}

export const EnrollmentForm: React.FC<EnrollmentFormProps> = ({
  onSuccess,
  onError,
  beneficiaries = [],
  programs = [],
  beneficiaryId,
  programId,
  isQuickEnroll = false,
}) => {
  const { enroll, loading, error, success, data } = useEnrollment({
    onSuccess,
    onError,
  });

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EnrollmentFormData>({
    resolver: zodResolver(EnrollmentSchema),
    defaultValues: {
      beneficiaryId,
      programId,
      enrollmentDate: new Date().toISOString().split('T')[0],
      status: 'enrolled',
    },
  });

  const onSubmit = async (formData: EnrollmentFormData) => {
    try {
      await enroll({
        beneficiaryId: formData.beneficiaryId,
        programId: formData.programId,
        enrollmentDate: formData.enrollmentDate,
        status: formData.status,
      });
    } catch (err) {
      console.error('Enrollment error:', err);
    }
  };

  if (isQuickEnroll && beneficiaryId && programId) {
    return (
      <div className="bg-white rounded-lg shadow p-4 max-w-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Enroll in Program</h3>

        {error && (
          <Alert
            type="error"
            message={error}
            onDismiss={() => {
              /* Clear */
            }}
          />
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Controller
            name="enrollmentDate"
            control={control}
            render={({ field }) => (
              <TextInput
                {...field}
                label="Enrollment Date"
                type="date"
                error={errors.enrollmentDate}
              />
            )}
          />

          <FormButton
            type="submit"
            loading={loading || isSubmitting}
            disabled={isSubmitting || loading}
            className="w-full"
          >
            Enroll Beneficiary
          </FormButton>
        </form>

        {success && (
          <Alert
            type="success"
            message="Enrollment successful!"
            onDismiss={() => {
              /* Clear */
            }}
          />
        )}
      </div>
    );
  }

  // Full form
  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Enroll in Program</h2>
      <p className="text-gray-600 mb-6">Register beneficiary for a program</p>

      {error && (
        <Alert
          type="error"
          message={error}
          onDismiss={() => {
            /* Clear */
          }}
        />
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <FormSection
          title="Enrollment Details"
          description="Link beneficiary to program"
        >
          <Controller
            name="beneficiaryId"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                label="Beneficiary"
                required
                error={errors.beneficiaryId}
                options={beneficiaries.map(b => ({ value: b.id, label: b.label }))}
                placeholder="Select beneficiary"
                disabled={!!beneficiaryId}
              />
            )}
          />

          <Controller
            name="programId"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                label="Program"
                required
                error={errors.programId}
                options={programs}
                placeholder="Select program"
                disabled={!!programId}
              />
            )}
          />

          <Controller
            name="enrollmentDate"
            control={control}
            render={({ field }) => (
              <TextInput
                {...field}
                label="Enrollment Date"
                type="date"
                error={errors.enrollmentDate}
              />
            )}
          />

          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                label="Status"
                options={[
                  { value: 'enrolled', label: 'Enrolled' },
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'dropped_out', label: 'Dropped Out' },
                ]}
                error={errors.status}
              />
            )}
          />
        </FormSection>

        <div className="flex justify-end">
          <FormButton
            type="submit"
            loading={loading || isSubmitting}
            disabled={isSubmitting || loading}
          >
            Confirm Enrollment
          </FormButton>
        </div>
      </form>

      {success && data && (
        <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
          <p className="text-green-800 font-medium">
            ✓ Beneficiary enrolled successfully
          </p>
          <p className="text-sm text-green-700 mt-2">
            Enrollment ID: {data.id}
          </p>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// CASE NOTE FORM
// ============================================================================

const CaseNoteSchema = z.object({
  beneficiaryId: z.string().min(1, 'Beneficiary required'),
  noteType: z.enum(['assessment', 'progress', 'issue', 'followup', 'referral'], {
    required_error: 'Note type required',
  }),
  content: z.string().min(10, 'Description must be at least 10 characters'),
  actionItems: z.string().optional(),
});

type CaseNoteFormData = z.infer<typeof CaseNoteSchema>;

interface CaseNoteFormProps {
  onSuccess?: (caseNote: any) => void;
  onError?: (error: string) => void;
  beneficiaries?: Array<{ id: string; label: string }>;
  beneficiaryId?: string; // Pre-fill if known
  isQuickNote?: boolean; // Minimal form for sidebar
}

export const CaseNoteForm: React.FC<CaseNoteFormProps> = ({
  onSuccess,
  onError,
  beneficiaries = [],
  beneficiaryId,
  isQuickNote = false,
}) => {
  const { create, loading, error, success, data } = useCaseNote({
    onSuccess,
    onError,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CaseNoteFormData>({
    resolver: zodResolver(CaseNoteSchema),
    defaultValues: {
      beneficiaryId,
      noteType: 'progress',
    },
  });

  const onSubmit = async (formData: CaseNoteFormData) => {
    try {
      const actionItems = formData.actionItems
        ? formData.actionItems.split('\n').filter((item) => item.trim())
        : [];

      await create({
        beneficiaryId: formData.beneficiaryId,
        noteType: formData.noteType,
        content: formData.content,
        actionItems,
      });

      reset();
    } catch (err) {
      console.error('Case note error:', err);
    }
  };

  if (isQuickNote && beneficiaryId) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Add Case Note</h3>

        {error && (
          <Alert
            type="error"
            message={error}
            onDismiss={() => {
              /* Clear */
            }}
          />
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Controller
            name="noteType"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                label="Type"
                options={[
                  { value: 'assessment', label: 'Assessment' },
                  { value: 'progress', label: 'Progress' },
                  { value: 'issue', label: 'Issue' },
                  { value: 'followup', label: 'Follow-up' },
                  { value: 'referral', label: 'Referral' },
                ]}
                error={errors.noteType}
              />
            )}
          />

          <Controller
            name="content"
            control={control}
            render={({ field }) => (
              <TextArea
                {...field}
                label="Note"
                placeholder="Write your case note..."
                error={errors.content}
              />
            )}
          />

          <FormButton
            type="submit"
            loading={loading || isSubmitting}
            disabled={isSubmitting || loading}
            className="w-full"
            size="sm"
          >
            Save Note
          </FormButton>
        </form>

        {success && (
          <div className="mt-3 p-2 bg-green-50 rounded border border-green-200">
            <p className="text-sm text-green-800">✓ Case note saved</p>
          </div>
        )}
      </div>
    );
  }

  // Full form
  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Add Case Note</h2>
      <p className="text-gray-600 mb-6">
        Document assessment, progress, issues, or follow-up actions
      </p>

      {error && (
        <Alert
          type="error"
          message={error}
          onDismiss={() => {
            /* Clear */
          }}
        />
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <FormSection title="Case Note Information" description="Details about the interaction">
          {!beneficiaryId && (
            <Controller
              name="beneficiaryId"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  label="Beneficiary"
                  required
                  error={errors.beneficiaryId}
                  options={beneficiaries}
                  placeholder="Select beneficiary"
                />
              )}
            />
          )}

          <Controller
            name="noteType"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                label="Note Type"
                required
                error={errors.noteType}
                options={[
                  { value: 'assessment', label: 'Assessment' },
                  { value: 'progress', label: 'Progress Update' },
                  { value: 'issue', label: 'Issue / Problem' },
                  { value: 'followup', label: 'Follow-up Required' },
                  { value: 'referral', label: 'Referral to Service' },
                ]}
                placeholder="Select type"
              />
            )}
          />

          <Controller
            name="content"
            control={control}
            render={({ field }) => (
              <TextArea
                {...field}
                label="Description"
                placeholder="Write detailed notes about the interaction, observations, and findings"
                error={errors.content}
                helperText="Be specific and objective. Include dates and names where relevant."
              />
            )}
          />

          <Controller
            name="actionItems"
            control={control}
            render={({ field }) => (
              <TextArea
                {...field}
                label="Action Items (Optional)"
                placeholder="One action per line&#10;- Follow up with health worker&#10;- Arrange vocational training&#10;- Schedule home visit"
                error={errors.actionItems}
                helperText="Enter action items one per line"
              />
            )}
          />
        </FormSection>

        <div className="flex justify-end">
          <FormButton
            type="submit"
            loading={loading || isSubmitting}
            disabled={isSubmitting || loading}
          >
            Save Case Note
          </FormButton>
        </div>
      </form>

      {success && data && (
        <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
          <p className="text-green-800 font-medium">✓ Case note saved successfully</p>
          <p className="text-sm text-green-700 mt-2">
            {!navigator.onLine && 'Data saved locally and will sync when online.'}
          </p>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// RECENT CASE NOTES LIST
// ============================================================================

interface RecentCaseNotesProps {
  beneficiaryId: string;
  notes?: Array<{
    id: string;
    noteType: string;
    content: string;
    createdAt: string;
    createdBy: string;
  }>;
}

export const RecentCaseNotes: React.FC<RecentCaseNotesProps> = ({
  beneficiaryId,
  notes = [],
}) => {
  const getNoteTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      assessment: 'bg-blue-100 text-blue-800',
      progress: 'bg-green-100 text-green-800',
      issue: 'bg-red-100 text-red-800',
      followup: 'bg-yellow-100 text-yellow-800',
      referral: 'bg-purple-100 text-purple-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (notes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No case notes yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notes.map((note) => (
        <div key={note.id} className="border rounded-lg p-4">
          <div className="flex items-start justify-between mb-2">
            <span
              className={`inline-block px-2 py-1 rounded text-sm font-medium ${getNoteTypeColor(
                note.noteType
              )}`}
            >
              {note.noteType.charAt(0).toUpperCase() + note.noteType.slice(1)}
            </span>
            <span className="text-xs text-gray-500">
              {new Date(note.createdAt).toLocaleDateString()}
            </span>
          </div>
          <p className="text-gray-700 text-sm mb-2">{note.content}</p>
          <p className="text-xs text-gray-500">By {note.createdBy}</p>
        </div>
      ))}
    </div>
  );
};
