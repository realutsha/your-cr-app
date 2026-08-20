import { useState } from 'react';
import { X } from 'lucide-react';
import { LIMITS, validateText } from '../../lib/validation';

interface JoinSheetProps {
  onClose: () => void;
  onJoin: (code: string) => void;
}

export function JoinSheet({ onClose, onJoin }: JoinSheetProps) {
  const [code, setCode] = useState('');

  const codeValidation = validateText(code, {
    fieldName: 'Group Code',
    maxLength: LIMITS.GROUP_CODE,
    minLength: 4,
    required: true,
  });

  const canJoin = codeValidation.isValid;

  return (
    <div style={{ padding: '0 20px 32px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <span style={{ fontFamily: 'var(--font-head)', fontSize: 16, fontWeight: 700, color: 'var(--c-text)' }}>
          Join class
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            disabled={!canJoin}
            onClick={() => onJoin(codeValidation.sanitized)}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14.5,
              fontWeight: 700,
              color: canJoin ? 'var(--c-accent)' : 'var(--c-text-faint)',
              cursor: canJoin ? 'pointer' : 'default',
              border: 'none',
              background: 'transparent',
              padding: 0,
            }}
          >
            Join
          </button>
          <button onClick={onClose} style={{ color: 'var(--c-text-faint)', padding: 2, border: 'none', background: 'transparent', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <label
            style={{
              display: 'block',
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.4,
              color: 'var(--c-text-faint)',
              textTransform: 'uppercase',
            }}
          >
            6-Character Group Code
          </label>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--c-text-faint)' }}>
            {code.length} / {LIMITS.GROUP_CODE}
          </span>
        </div>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. K7X4P9"
          maxLength={LIMITS.GROUP_CODE}
          autoFocus
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: '0.1em',
            color: 'var(--c-text)',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--c-hairline)',
            padding: '8px 0',
            width: '100%',
            outline: 'none',
            textTransform: 'uppercase',
          }}
        />
        {code.length > 0 && !codeValidation.isValid && (
          <div style={{ color: 'var(--c-danger)', fontSize: 12, fontFamily: 'var(--font-body)', marginTop: 4 }}>
            {codeValidation.error}
          </div>
        )}
      </div>

      <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--c-text-faint)', lineHeight: 1.5 }}>
        Ask your Class Representative for their unique 6-character class code.
      </div>
    </div>
  );
}
