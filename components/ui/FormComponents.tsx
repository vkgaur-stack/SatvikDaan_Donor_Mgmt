// components/forms/base-components.tsx
// Reusable form components with Tailwind CSS

import React from 'react';
import { FieldError } from 'react-hook-form';

// ============================================================================
// FORM FIELD WRAPPER
// ============================================================================

interface FormFieldProps {
  label: string;
  error?: FieldError;
  required?: boolean;
  helperText?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  required,
  helperText,
  children,
}) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
    {error && (
      <p className="text-red-500 text-xs mt-1">{error.message}</p>
    )}
    {helperText && !error && (
      <p className="text-gray-500 text-xs mt-1">{helperText}</p>
    )}
  </div>
);

// ============================================================================
// TEXT INPUT
// ============================================================================

interface TextInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: FieldError;
  helperText?: string;
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, error, helperText, className, ...props }, ref) => (
    <FormField label={label} error={error} helperText={helperText}>
      <input
        ref={ref}
        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error
            ? 'border-red-500 bg-red-50'
            : 'border-gray-300 bg-white'
        } ${className || ''}`}
        {...props}
      />
    </FormField>
  )
);

TextInput.displayName = 'TextInput';

// ============================================================================
// TEXTAREA
// ============================================================================

interface TextAreaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: FieldError;
  helperText?: string;
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, helperText, className, ...props }, ref) => (
    <FormField label={label} error={error} helperText={helperText}>
      <textarea
        ref={ref}
        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
          error
            ? 'border-red-500 bg-red-50'
            : 'border-gray-300 bg-white'
        } ${className || ''}`}
        {...props}
      />
    </FormField>
  )
);

TextArea.displayName = 'TextArea';

// ============================================================================
// SELECT
// ============================================================================

interface Option {
  value: string | number;
  label: string;
}

interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: Option[];
  error?: FieldError;
  helperText?: string;
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, helperText, placeholder, className, ...props }, ref) => (
    <FormField label={label} error={error} helperText={helperText}>
      <select
        ref={ref}
        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error
            ? 'border-red-500 bg-red-50'
            : 'border-gray-300 bg-white'
        } ${className || ''}`}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FormField>
  )
);

Select.displayName = 'Select';

// ============================================================================
// CHECKBOX
// ============================================================================

interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: FieldError;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="flex items-center mb-4">
      <input
        ref={ref}
        type="checkbox"
        className={`h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${className || ''}`}
        {...props}
      />
      <label className="ml-2 text-sm text-gray-700">{label}</label>
      {error && <p className="text-red-500 text-xs ml-auto">{error.message}</p>}
    </div>
  )
);

Checkbox.displayName = 'Checkbox';

// ============================================================================
// RADIO GROUP
// ============================================================================

interface RadioOption {
  value: string;
  label: string;
}

interface RadioGroupProps {
  label: string;
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  error?: FieldError;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  label,
  options,
  value,
  onChange,
  error,
}) => (
  <FormField label={label} error={error}>
    <div className="space-y-2">
      {options.map((opt) => (
        <label key={opt.value} className="flex items-center">
          <input
            type="radio"
            value={opt.value}
            checked={value === opt.value}
            onChange={(e) => onChange(e.target.value)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500"
          />
          <span className="ml-2 text-sm text-gray-700">{opt.label}</span>
        </label>
      ))}
    </div>
  </FormField>
);

// ============================================================================
// FORM BUTTON
// ============================================================================

interface FormButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}

export const FormButton = React.forwardRef<HTMLButtonElement, FormButtonProps>(
  ({ loading, variant = 'primary', className, children, disabled, ...props }, ref) => {
    const baseClasses = 'px-4 py-2 rounded-md font-medium transition-colors';
    const variantClasses = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
      secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:bg-gray-100',
      danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseClasses} ${variantClasses[variant]} ${className || ''}`}
        {...props}
      >
        {loading ? (
          <div className="flex items-center">
            <div className="animate-spin h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full" />
            Loading...
          </div>
        ) : (
          children
        )}
      </button>
    );
  }
);

FormButton.displayName = 'FormButton';

// ============================================================================
// FORM SECTION DIVIDER
// ============================================================================

interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  description,
  children,
}) => (
  <div className="border-t pt-6 mt-6 first:border-t-0 first:pt-0 first:mt-0">
    <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
    {description && (
      <p className="text-sm text-gray-600 mb-4">{description}</p>
    )}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {children}
    </div>
  </div>
);

// ============================================================================
// ALERT MESSAGE
// ============================================================================

interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onDismiss?: () => void;
}

export const Alert: React.FC<AlertProps> = ({ type, message, onDismiss }) => {
  const typeClasses = {
    success: 'bg-green-50 text-green-800 border-green-200',
    error: 'bg-red-50 text-red-800 border-red-200',
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    info: 'bg-blue-50 text-blue-800 border-blue-200',
  };

  return (
    <div className={`border rounded-md p-4 mb-4 ${typeClasses[type]}`}>
      <div className="flex justify-between items-start">
        <p className="text-sm">{message}</p>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-lg font-bold opacity-50 hover:opacity-100"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// FILE UPLOAD
// ============================================================================

interface FileUploadProps {
  label: string;
  accept?: string;
  onChange: (file: File | null) => void;
  error?: FieldError;
  helperText?: string;
  fileName?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  label,
  accept,
  onChange,
  error,
  helperText,
  fileName,
}) => (
  <FormField label={label} error={error} helperText={helperText}>
    <div className="flex items-center space-x-4">
      <input
        type="file"
        accept={accept}
        onChange={(e) => onChange(e.target.files?.[0] || null)}
        className="block w-full text-sm text-gray-500
          file:mr-4 file:py-2 file:px-4
          file:rounded-md file:border-0
          file:text-sm file:font-semibold
          file:bg-blue-50 file:text-blue-700
          hover:file:bg-blue-100"
      />
      {fileName && (
        <span className="text-sm text-gray-600 truncate">{fileName}</span>
      )}
    </div>
  </FormField>
);

// ============================================================================
// SYNC STATUS INDICATOR
// ============================================================================

interface SyncStatusProps {
  status: 'synced' | 'pending' | 'syncing' | 'error';
  message?: string;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({ status, message }) => {
  const statusConfig = {
    synced: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      icon: '✓',
      label: 'Synced',
    },
    pending: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      icon: '○',
      label: 'Pending Sync',
    },
    syncing: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      icon: '⟳',
      label: 'Syncing...',
    },
    error: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      icon: '!',
      label: 'Sync Error',
    },
  };

  const config = statusConfig[status];

  return (
    <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${config.bg} ${config.text}`}>
      <span className={status === 'syncing' ? 'animate-spin' : ''}>
        {config.icon}
      </span>
      <span>{config.label}</span>
      {message && <span className="text-xs opacity-75">{message}</span>}
    </div>
  );
};
