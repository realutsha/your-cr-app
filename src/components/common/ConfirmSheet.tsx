interface ConfirmSheetProps {
  title?: string;
  description: string;
  confirmLabel: string;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmSheet({
  title,
  description,
  confirmLabel,
  disabled,
  onCancel,
  onConfirm,
}: ConfirmSheetProps) {
  return (
    <div style={{ paddingBottom: 8 }}>
      {title && (
        <div
          style={{
            fontFamily: 'var(--font-head)',
            fontSize: 17,
            fontWeight: 700,
            color: 'var(--c-text)',
            textAlign: 'center',
            padding: '8px 20px 4px',
          }}
        >
          {title}
        </div>
      )}
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          color: 'var(--c-text-faint)',
          textAlign: 'center',
          lineHeight: 1.5,
          padding: '4px 28px 18px',
        }}
      >
        {description}
      </div>
      <button
        onClick={onConfirm}
        disabled={disabled}
        style={{
          width: '100%',
          cursor: disabled ? 'default' : 'pointer',
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--c-danger)',
          padding: '15px 0',
          borderTop: '1px solid var(--c-hairline)',
          textAlign: 'center',
          display: 'block',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {confirmLabel}
      </button>
      <button
        onClick={onCancel}
        disabled={disabled}
        style={{
          width: '100%',
          cursor: disabled ? 'default' : 'pointer',
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          color: 'var(--c-text-soft)',
          padding: '15px 0',
          borderTop: '1px solid var(--c-hairline)',
          textAlign: 'center',
          display: 'block',
        }}
      >
        Cancel
      </button>
    </div>
  );
}
