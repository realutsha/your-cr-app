import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { ApprovalMode } from '../../types';
import { Field } from '../common/Field';
import { LIMITS, validateText } from '../../lib/validation';

interface CreateClassSheetProps {
  onClose: () => void;
  onCreate: (name: string, mode: ApprovalMode) => Promise<{ success: boolean; error?: string }>;
}

export function CreateClassSheet({ onClose, onCreate }: CreateClassSheetProps) {
  const [name, setName] = useState('');
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>('auto');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameValidation = validateText(name, {
    fieldName: 'Class Name',
    maxLength: LIMITS.CLASS_NAME,
    minLength: 3,
    required: true,
  });

  const canCreate = nameValidation.isValid;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isCreating || !canCreate) return;

    setError(null);
    setIsCreating(true);

    try {
      const res = await onCreate(nameValidation.sanitized, approvalMode);
      if (!res.success) {
        setError(res.error || 'Failed to create class. Please try again.');
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message || 'An unexpected error occurred while creating the class.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ padding: '0 20px 32px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <span style={{ fontFamily: 'var(--font-head)', fontSize: 16, fontWeight: 700, color: 'var(--c-text)' }}>
          Create class
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            type="submit"
            disabled={!canCreate || isCreating}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14.5,
              fontWeight: 700,
              color: canCreate && !isCreating ? 'var(--c-accent)' : 'var(--c-text-faint)',
              cursor: canCreate && !isCreating ? 'pointer' : 'default',
              border: 'none',
              background: 'transparent',
              padding: 0,
            }}
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ color: 'var(--c-text-faint)', padding: 2, border: 'none', background: 'transparent', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--c-danger, #ef4444)',
            border: '1px solid var(--c-danger, #ef4444)',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 13,
            fontWeight: 500,
            marginBottom: 16,
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
      )}

      <Field
        label="Class Name"
        value={name}
        maxLength={LIMITS.CLASS_NAME}
        showCount
        error={name.length > 0 && !nameValidation.isValid ? nameValidation.error : undefined}
        onChange={(e) => {
          setName(e.target.value);
          if (error) setError(null);
        }}
        placeholder="e.g. Software Engineering — Section I"
      />

      <div style={{ marginBottom: 18 }}>
        <label
          style={{
            display: 'block',
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.4,
            color: 'var(--c-text-faint)',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Student Approval Mode
        </label>
        <div style={{ display: 'flex', gap: 14 }}>
          <button
            type="button"
            onClick={() => setApprovalMode('auto')}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: approvalMode === 'auto' ? 700 : 500,
              color: approvalMode === 'auto' ? 'var(--c-text)' : 'var(--c-text-faint)',
              cursor: 'pointer',
              border: 'none',
              background: 'transparent',
              padding: 0,
            }}
          >
            Automatic approval
          </button>
          <button
            type="button"
            onClick={() => setApprovalMode('manual')}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: approvalMode === 'manual' ? 700 : 500,
              color: approvalMode === 'manual' ? 'var(--c-text)' : 'var(--c-text-faint)',
              cursor: 'pointer',
              border: 'none',
              background: 'transparent',
              padding: 0,
            }}
          >
            Manual approval
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={!canCreate || isCreating}
        style={{
          width: '100%',
          marginTop: 10,
          marginBottom: 14,
          padding: '12px 16px',
          borderRadius: 10,
          background: canCreate && !isCreating ? 'var(--c-accent)' : 'var(--c-surface-strong)',
          color: canCreate && !isCreating ? '#ffffff' : 'var(--c-text-faint)',
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          fontWeight: 600,
          border: 'none',
          cursor: canCreate && !isCreating ? 'pointer' : 'default',
          transition: 'all 150ms ease',
        }}
      >
        {isCreating ? 'Creating class...' : 'Create Class'}
      </button>

      <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--c-text-faint)', lineHeight: 1.5 }}>
        A 6-character code will be generated automatically. Every class exists for exactly 4 months.
      </div>
    </form>
  );
}
