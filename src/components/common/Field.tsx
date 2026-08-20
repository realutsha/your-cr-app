import React from 'react';

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label: string;
  as?: 'input' | 'textarea';
  rows?: number;
  maxLength?: number;
  showCount?: boolean;
  error?: string;
  helperText?: string;
}

export function Field({
  label,
  as = 'input',
  maxLength,
  showCount = false,
  error,
  helperText,
  value,
  style,
  ...props
}: FieldProps) {
  const Component = as;
  const currentLength = typeof value === 'string' ? value.length : typeof value === 'number' ? String(value).length : 0;
  const isOverLimit = maxLength ? currentLength > maxLength : false;

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <label
          style={{
            display: 'block',
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.4,
            color: error || isOverLimit ? 'var(--c-danger)' : 'var(--c-text-faint)',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </label>
        {(showCount || maxLength) && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: isOverLimit ? 700 : 500,
              color: isOverLimit
                ? 'var(--c-danger)'
                : currentLength > (maxLength ? maxLength * 0.85 : 0)
                ? 'var(--c-accent)'
                : 'var(--c-text-faint)',
            }}
          >
            {maxLength ? `${currentLength} / ${maxLength}` : currentLength}
          </span>
        )}
      </div>
      <Component
        {...(props as any)}
        value={value}
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          color: 'var(--c-text)',
          background: 'transparent',
          border: 'none',
          borderBottom: `1px solid ${error || isOverLimit ? 'var(--c-danger)' : 'var(--c-hairline)'}`,
          borderRadius: 0,
          padding: '6px 0',
          width: '100%',
          outline: 'none',
          resize: as === 'textarea' ? 'none' : undefined,
          ...style,
        }}
      />
      {error && (
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            color: 'var(--c-danger)',
            marginTop: 4,
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
      )}
      {!error && isOverLimit && maxLength && (
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            color: 'var(--c-danger)',
            marginTop: 4,
            lineHeight: 1.4,
          }}
        >
          Limit exceeded by {currentLength - maxLength} character{currentLength - maxLength === 1 ? '' : 's'}.
        </div>
      )}
      {!error && !isOverLimit && helperText && (
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11.5,
            color: 'var(--c-text-faint)',
            marginTop: 4,
            lineHeight: 1.4,
          }}
        >
          {helperText}
        </div>
      )}
    </div>
  );
}
