'use client';

import React, { HTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

// ==================== TYPE DEFINITIONS ====================

export interface SelectOption {
  value: string;
  label: string;
}

export interface FormFieldProps {
  label?: string;
  error?: string;
  children: React.ReactNode;
  required?: boolean;
}

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  rows?: number;
}

export interface SelectProps extends Omit<InputHTMLAttributes<HTMLSelectElement>, 'size'> {
  options: SelectOption[];
  placeholder?: string;
  error?: string;
}

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value'> {
  label?: string;
  checked?: boolean;
}

export interface FormButtonProps extends HTMLAttributes<HTMLButtonElement> {
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  children: React.ReactNode;
}

export interface FormSectionProps {
  title?: string;
  subtitle?: string;
  description?: string;
  children: React.ReactNode;
}

export interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message?: string;
  children?: React.ReactNode;
}

export interface SyncStatusProps {
  status: 'idle' | 'syncing' | 'success' | 'error';
  message?: string;
}

// ==================== FORM FIELD WRAPPER ====================

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  children,
  required,
}) => (
  <div className="mb-4">
    {label && (
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
    )}
    {children}
    {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
  </div>
);

// ==================== TEXT INPUT ====================

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ className = '', error, ...props }, ref) => (
    <input
      ref={ref}
      className={`
        w-full px-3 py-2 border rounded-md shadow-sm
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
        disabled:bg-gray-100 disabled:cursor-not-allowed
        ${error ? 'border-red-500' : 'border-gray-300'}
        ${className}
      `}
      {...props}
    />
  )
);

TextInput.displayName = 'TextInput';

// ==================== TEXT AREA ====================

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className = '', error, rows = 4, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={`
        w-full px-3 py-2 border rounded-md shadow-sm
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
        disabled:bg-gray-100 disabled:cursor-not-allowed
        ${error ? 'border-red-500' : 'border-gray-300'}
        ${className}
      `}
      {...props}
    />
  )
);

TextArea.displayName = 'TextArea';

// ==================== SELECT ====================

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', options, placeholder, error, ...props }, ref) => (
    <select
      ref={ref}
      className={`
        w-full px-3 py-2 border rounded-md shadow-sm
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
        disabled:bg-gray-100 disabled:cursor-not-allowed
        ${error ? 'border-red-500' : 'border-gray-300'}
        ${className}
      `}
      {...props}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
);

Select.displayName = 'Select';

// ==================== CHECKBOX ====================

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className = '', label, checked, ...props }, ref) => (
    <div className="flex items-center">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        className={`
          h-4 w-4 rounded border-gray-300
          focus:outline-none focus:ring-2 focus:ring-blue-500
          disabled:cursor-not-allowed disabled:bg-gray-100
          ${className}
        `}
        {...props}
      />
      {label && (
        <label className="ml-2 text-sm text-gray-700">
          {label}
        </label>
      )}
    </div>
  )
);

Checkbox.displayName = 'Checkbox';

// ==================== FORM BUTTON ====================

export const FormButton = React.forwardRef<HTMLButtonElement, FormButtonProps>(
  ({ type = 'button', variant = 'primary', disabled = false, className = '', children, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={`
        px-4 py-2 rounded-md font-medium transition-colors
        focus:outline-none focus:ring-2 focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${
          variant === 'primary'
            ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
            : 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500'
        }
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  )
);

FormButton.displayName = 'FormButton';

// ==================== FORM SECTION ====================

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  subtitle,
  description,
  children,
}) => (
  <div className="bg-white rounded-lg shadow p-6 mb-6">
    {title && (
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        {(subtitle || description) && (
          <p className="text-sm text-gray-600 mt-1">{subtitle || description}</p>
        )}
      </div>
    )}
    <div>{children}</div>
  </div>
);

// ==================== ALERT ====================

export const Alert: React.FC<AlertProps> = ({ type, message, children }) => {
  const bgColor = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200',
    info: 'bg-blue-50 border-blue-200',
  }[type];

  const textColor = {
    success: 'text-green-800',
    error: 'text-red-800',
    warning: 'text-yellow-800',
    info: 'text-blue-800',
  }[type];

  const iconColor = {
    success: 'text-green-600',
    error: 'text-red-600',
    warning: 'text-yellow-600',
    info: 'text-blue-600',
  }[type];

  return (
    <div className={`border rounded-md p-4 ${bgColor} mb-4`}>
      <div className={`flex ${textColor}`}>
        <span className={`${iconColor} mr-3`}>
          {type === 'success' && '✓'}
          {type === 'error' && '✕'}
          {type === 'warning' && '⚠'}
          {type === 'info' && 'ℹ'}
        </span>
        <div>
          {message && <p className="text-sm font-medium">{message}</p>}
          {children}
        </div>
      </div>
    </div>
  );
};

// ==================== SYNC STATUS ====================

export const SyncStatus: React.FC<SyncStatusProps> = ({ status, message }) => {
  if (status === 'idle') return null;

  const alertType = status === 'success' ? 'success' : status === 'error' ? 'error' : 'info';

  return (
    <Alert type={alertType}>
      {status === 'syncing' && 'Syncing data...'}
      {status === 'success' && 'Data synced successfully'}
      {status === 'error' && `Sync error: ${message || 'Unknown error'}`}
      {message && status !== 'syncing' && status !== 'success' && message}
    </Alert>
  );
};

export default {
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
};
