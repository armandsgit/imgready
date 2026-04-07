'use client';

import type { ChangeEvent } from 'react';
import CopyButton from '@/components/woocommerce-importer/CopyButton';

interface EditableFieldProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  multiline?: boolean;
  type?: 'text' | 'number';
  copyValue?: string | null;
  disabled?: boolean;
  placeholder?: string;
  helperText?: string;
}

export default function EditableField({
  label,
  value,
  onChange,
  multiline = false,
  type = 'text',
  copyValue = null,
  disabled = false,
  placeholder,
  helperText,
}: EditableFieldProps) {
  const baseClassName =
    'w-full rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none transition-colors placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-60';

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    onChange(event.target.value);
  }

  return (
    <label className="block space-y-2">
      <span className="flex items-center justify-between gap-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
        <span>{label}</span>
        {copyValue ? <CopyButton value={copyValue} label={`Copy ${label.toLowerCase()}`} /> : null}
      </span>

      {multiline ? (
        <textarea
          value={String(value)}
          onChange={handleChange}
          className={`${baseClassName} min-h-[120px] resize-none leading-7`}
          disabled={disabled}
          placeholder={placeholder}
        />
      ) : (
        <input
          type={type}
          value={String(value)}
          onChange={handleChange}
          className={baseClassName}
          disabled={disabled}
          placeholder={placeholder}
        />
      )}

      {helperText ? <p className="text-xs leading-5 text-[color:var(--text-secondary)]">{helperText}</p> : null}
    </label>
  );
}
