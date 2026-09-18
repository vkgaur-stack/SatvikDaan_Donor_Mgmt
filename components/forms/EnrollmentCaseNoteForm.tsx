'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
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

// ==================== ENROLLMENT FORM ====================

const enrollmentSchema = z.object({
  beneficiaryId: z.string().min(1, 'Beneficiary is required'),
  programId: z.string().min(1, 'Program is required'),
  enrollmentDate: z.string().min(1, 'Enrollment date is required'),
  notes: z.string().optional(),
});

type EnrollmentFormData = z.infer<typeof enrollmentSchema>;

interface EnrollmentFormProps {
  beneficiaries: Array<{ id: string; label: string }>;
  programs: Array<{ id: string; label: string }>;
  onSubmit: (data: EnrollmentFormData) => Promise<void>;
  isLoading?: boolean;
}

export const EnrollmentForm = React.forwardRef<HTMLFormElement, EnrollmentFormProps>(
  ({ beneficiaries, programs, onSubmit, isLoading = false }, ref) => {
    const {
      control,
      register,
      handleSubmit,
      formState: { errors },
      reset,
    } = useForm<EnrollmentFormData>({
      resolver: zodResolver(enrollmentSchema),
      defaultValues: {
        beneficiaryId: '',
        programId: '',
        enrollmentDate: '',
        notes: '',
      },
    });

    const handleFormSubmit = async (data: EnrollmentFormData) => {
      try {
        await onSubmit(data);
        reset();
      } catch (error) {
        console.error('Form submission error:', error);
      }
    };

    // FIX: Map beneficiaries array to SelectOption format
    const beneficiaryOptions: SelectOption[] = beneficiaries.map((b) => ({
      value: b.id,
      label: b.label,
    }));

    // FIX: Map programs array to SelectOption format
    const programOptions: SelectOption[] = programs.map((p) => ({
      value: p.id,
      label: p.label,
    }));

    return (
      <form ref={ref} onSubmit={handleSubmit(handleFormSubmit)}>
        <FormSection title="New Enrollment">
          <FormField label="Beneficiary" error={errors.beneficiaryId?.message}>
            <Select
              {...register('beneficiaryId')}
              options={beneficiaryOptions}
              placeholder="Select a beneficiary"
            />
          </FormField>

          <FormField label="Program" error={errors.programId?.message}>
            <Select
              {...register('programId')}
              options={programOptions}
              placeholder="Select a program"
            />
          </FormField>

          <FormField label="Enrollment Date" error={errors.enrollmentDate?.message}>
            <TextInput
              type="date"
              {...register('enrollmentDate')}
            />
          </FormField>

          <FormField label="Notes" error={errors.notes?.message}>
            <TextArea
              {...register('notes')}
              placeholder="Optional enrollment notes"
            />
          </FormField>

          <FormButton
            type="submit"
            variant="primary"
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : 'Enroll Beneficiary'}
          </FormButton>
        </FormSection>
      </form>
    );
  }
);

EnrollmentForm.displayName = 'EnrollmentForm';

// ==================== CASE NOTE FORM ====================

const caseNoteSchema = z.object({
  beneficiaryId: z.string().min(1, 'Beneficiary is required'),
  noteText: z.string().min(10, 'Note must be at least 10 characters'),
  isConfidential: z.boolean().optional(),
  followUpRequired: z.boolean().optional(),
  followUpDate: z.string().optional(),
});

type CaseNoteFormData = z.infer<typeof caseNoteSchema>;

interface CaseNoteFormProps {
  beneficiaries: Array<{ id: string; label: string }>;
  programs?: Array<{ id: string; label: string }>;
  onSubmit: (data: CaseNoteFormData) => Promise<void>;
  isLoading?: boolean;
  syncStatus?: {
    status: 'idle' | 'syncing' | 'success' | 'error';
    message?: string;
  };
}

export const CaseNoteForm = React.forwardRef<HTMLFormElement, CaseNoteFormProps>(
  ({ beneficiaries, programs = [], onSubmit, isLoading = false, syncStatus }, ref) => {
    const [showFollowUpDate, setShowFollowUpDate] = useState(false);
    const {
      control,
      register,
      handleSubmit,
      watch,
      formState: { errors },
      reset,
    } = useForm<CaseNoteFormData>({
      resolver: zodResolver(caseNoteSchema),
      defaultValues: {
        beneficiaryId: '',
        noteText: '',
        isConfidential: false,
        followUpRequired: false,
        followUpDate: '',
      },
    });

    const followUpRequired = watch('followUpRequired');

    useEffect(() => {
      setShowFollowUpDate(followUpRequired);
    }, [followUpRequired]);

    const handleFormSubmit = async (data: CaseNoteFormData) => {
      try {
        await onSubmit(data);
        reset();
        setShowFollowUpDate(false);
      } catch (error) {
        console.error('Form submission error:', error);
      }
    };

    // FIX: Map beneficiaries array to SelectOption format
    const beneficiaryOptions: SelectOption[] = beneficiaries.map((b) => ({
      value: b.id,
      label: b.label,
    }));

    return (
      <form ref={ref} onSubmit={handleSubmit(handleFormSubmit)}>
        <FormSection title="Add Case Note">
          {syncStatus && (
            <SyncStatus
              status={syncStatus.status}
              message={syncStatus.message}
            />
          )}

          <FormField label="Beneficiary" error={errors.beneficiaryId?.message}>
            <Select
              {...register('beneficiaryId')}
              options={beneficiaryOptions}
              placeholder="Select a beneficiary"
            />
          </FormField>

          <FormField label="Case Note" error={errors.noteText?.message}>
            <TextArea
              {...register('noteText')}
              placeholder="Enter case note details..."
              rows={6}
            />
          </FormField>

          <FormField>
            <Checkbox
              {...register('isConfidential')}
              label="Mark as Confidential"
            />
          </FormField>

          <FormField>
            <Checkbox
              {...register('followUpRequired')}
              label="Follow-up Required"
            />
          </FormField>

          {showFollowUpDate && (
            <FormField label="Follow-up Date" error={errors.followUpDate?.message}>
              <TextInput
                type="date"
                {...register('followUpDate')}
              />
            </FormField>
          )}

          <FormButton
            type="submit"
            variant="primary"
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : 'Save Case Note'}
          </FormButton>
        </FormSection>
      </form>
    );
  }
);

CaseNoteForm.displayName = 'CaseNoteForm';

// ==================== RECENT CASE NOTES DISPLAY ====================

interface CaseNote {
  id: string;
  noteText: string;
  createdAt: Date | string;
  createdBy?: string;
  isConfidential?: boolean;
}

interface RecentCaseNotesProps {
  notes: CaseNote[];
  isLoading?: boolean;
}

export const RecentCaseNotes: React.FC<RecentCaseNotesProps> = ({
  notes,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <FormSection title="Recent Case Notes">
        <Alert type="info">Loading case notes...</Alert>
      </FormSection>
    );
  }

  if (notes.length === 0) {
    return (
      <FormSection title="Recent Case Notes">
        <Alert type="info">No case notes yet</Alert>
      </FormSection>
    );
  }

  return (
    <FormSection title="Recent Case Notes">
      <div className="space-y-4">
        {notes.map((note) => (
          <div
            key={note.id}
            className="border rounded-lg p-4 bg-gray-50"
          >
            <div className="flex justify-between items-start mb-2">
              <p className="text-sm text-gray-600">
                {typeof note.createdAt === 'string'
                  ? new Date(note.createdAt).toLocaleDateString()
                  : note.createdAt.toLocaleDateString()}
              </p>
              {note.isConfidential && (
                <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                  Confidential
                </span>
              )}
            </div>
            <p className="text-gray-700">{note.noteText}</p>
            {note.createdBy && (
              <p className="text-xs text-gray-500 mt-2">
                By: {note.createdBy}
              </p>
            )}
          </div>
        ))}
      </div>
    </FormSection>
  );
};

export default { EnrollmentForm, CaseNoteForm, RecentCaseNotes };
