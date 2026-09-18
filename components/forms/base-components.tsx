import React from 'react';
import { FieldError } from 'react-hook-form';

// ============================================================================
// FORM FIELD
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
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {error && <p className="text-red-500 text-sm mt-1">{error.message}</p>}
    {helperText && <p className="text-gray-500 text-xs mt-1">{helperText}</p>}
  </div>
);

// ============================================================================
// TEXT INPUT
// ============================================================================

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: FieldError;
  required?: boolean;
  helperText?: string;
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, error, required, helperText, ...props }, ref) => (
    <FormField label={label} error={error} required={required} helperText={helperText}>
      <input
        ref={ref}
        {...props}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
      />
    </FormField>
  )
);

TextInput.displayName = 'TextInput';

// ============================================================================
// TEXTAREA
// ============================================================================

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: FieldError;
  required?: boolean;
  helperText?: string;
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, required, helperText, ...props }, ref) => (
    <FormField label={label} error={error} required={required} helperText={helperText}>
      <textarea
        ref={ref}
        {...props}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
      />
    </FormField>
  )
);

TextArea.displayName = 'TextArea';

// ============================================================================
// SELECT
// ============================================================================

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  error?: FieldError;
  required?: boolean;
  helperText?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, required, helperText, ...props }, ref) => (
    <FormField label={label} error={error} required={required} helperText={helperText}>
      <select
        ref={ref}
        {...props}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">{props.placeholder || 'Select an option'}</option>
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

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, ...props }, ref) => (
    <label className="flex items-center space-x-2 cursor-pointer">
      <input
        ref={ref}
        type="checkbox"
        {...props}
        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  )
);

Checkbox.displayName = 'Checkbox';

// ============================================================================
// FORM BUTTON
// ============================================================================

interface FormButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  children: React.ReactNode;
}

export const FormButton: React.FC<FormButtonProps> = ({
  variant = 'primary',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses =
    'px-4 py-2 rounded-md font-medium transition-colors duration-200 flex items-center justify-center gap-2';
  const variantClasses =
    variant === 'primary'
      ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400'
      : 'bg-gray-200 text-gray-900 hover:bg-gray-300 disabled:bg-gray-100';

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses} ${className}`}
    >
      {loading && <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  );
};

// ============================================================================
// FORM SECTION
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
  <div className="space-y-4">
    <div>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
    </div>
    <div className="grid grid-cols-2 gap-4">{children}</div>
  </div>
);

// ============================================================================
// ALERT
// ============================================================================

interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onDismiss?: () => void;
}

export const Alert: React.FC<AlertProps> = ({ type, message, onDismiss }) => {
  const typeStyles = {
    success: 'bg-green-50 text-green-800 border-green-200',
    error: 'bg-red-50 text-red-800 border-red-200',
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    info: 'bg-blue-50 text-blue-800 border-blue-200',
  };

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  return (
    <div className={`p-4 rounded-lg border ${typeStyles[type]} mb-4 flex justify-between items-start`}>
      <div className="flex items-start gap-3">
        <span className="text-lg font-semibold">{icons[type]}</span>
        <p className="text-sm">{message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-lg font-semibold opacity-70 hover:opacity-100 transition-opacity"
        >
          ×
        </button>
      )}
    </div>
  );
};

// ============================================================================
// SYNC STATUS
// ============================================================================

interface SyncStatusProps {
  status: 'pending' | 'syncing' | 'synced' | 'error';
  message?: string;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({
  status,
  message = 'Sync status',
}) => {
  const statusStyles = {
    pending: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    syncing: 'bg-blue-50 text-blue-800 border-blue-200',
    synced: 'bg-green-50 text-green-800 border-green-200',
    error: 'bg-red-50 text-red-800 border-red-200',
  };

  const statusIcons = {
    pending: '⏳',
    syncing: '↻',
    synced: '✓',
    error: '✕',
  };

  return (
    <div className={`p-3 rounded-lg border ${statusStyles[status]} flex items-center gap-2`}>
      <span className={status === 'syncing' ? 'animate-spin' : ''}>
        {statusIcons[status]}
      </span>
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
};
