import React from 'react';

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label: string;
  as?: 'input' | 'textarea';
  rows?: number;
}

export function Field({ label, as = 'input', ...props }: FieldProps) {
  const Component = as;
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: 'block',
          fontFamily: 'var(--font-body)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.4,
          color: 'var(--c-text-faint)',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      <Component
        {...(props as any)}
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          color: 'var(--c-text)',
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid var(--c-hairline)',
          borderRadius: 0,
          padding: '6px 0',
          width: '100%',
          outline: 'none',
          resize: as === 'textarea' ? 'none' : undefined,
        }}
      />
    </div>
  );
}
