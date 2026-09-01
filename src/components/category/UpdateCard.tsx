import type { AcademicUpdate } from '../../types';

interface UpdateCardProps {
  u: AcademicUpdate;
  onOpen: (u: AcademicUpdate) => void;
  topicLabel: string;
}

export function UpdateCard({ u, onOpen, topicLabel }: UpdateCardProps) {
  const isCompleted = u.status === 'completed';
  const isCancelled = u.status === 'cancelled';
  const isMuted = isCompleted || isCancelled;

  return (
    <article
      onClick={() => onOpen(u)}
      style={{
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        padding: '16px 18px',
        background: 'var(--c-card-bg)',
        border: `1px solid ${u.unread ? 'var(--c-danger)' : 'var(--c-hairline)'}`,
        borderRadius: 16,
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        display: 'block',
        opacity: isMuted ? 0.55 : 1,
        transition: 'border-color 180ms ease, opacity 180ms ease, background 180ms ease',
      }}
    >
      {/* Top Row: Title + Date/Time */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {u.unread && (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: 'var(--c-danger)',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
          )}
          <h3
            style={{
              fontFamily: 'var(--font-head)',
              fontSize: 17,
              fontWeight: 600,
              color: isCompleted ? 'var(--c-text-soft)' : 'var(--c-text)',
              textDecoration: isCompleted ? 'line-through' : 'none',
              letterSpacing: '-0.015em',
              margin: 0,
            }}
          >
            {u.title}
          </h3>
        </div>

        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--c-text-soft)',
            flexShrink: 0,
          }}
        >
          {u.date} {u.time ? `• ${u.time}` : ''}
        </span>
      </div>

      {/* Topic / Requirements Sub-Box */}
      {u.topic && (
        <div
          style={{
            padding: '10px 12px',
            background: 'var(--c-card-subtle)',
            borderRadius: 10,
            marginTop: 10,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--c-text-soft)',
              lineHeight: 1.4,
            }}
          >
            <strong style={{ fontWeight: 600, textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.04em', display: 'block', marginBottom: 2 }}>
              {topicLabel}:
            </strong>
            {u.topic}
          </div>
        </div>
      )}

      {/* Status indicator (if completed/cancelled) */}
      {u.status !== 'pending' && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: isCompleted ? 'var(--c-success)' : isCancelled ? 'var(--c-danger)' : 'var(--c-text-faint)',
            }}
          >
            {u.status.replace('_', ' ')}
          </span>
        </div>
      )}
    </article>
  );
}
