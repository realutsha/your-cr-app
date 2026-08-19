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
    <button
      onClick={() => onOpen(u)}
      style={{
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        padding: '14px 16px',
        background: 'var(--c-card-bg)',
        border: `1px solid ${u.unread ? 'var(--c-danger)' : 'var(--c-hairline)'}`,
        borderRadius: 14,
        marginBottom: 10,
        display: 'block',
        opacity: isMuted ? 0.55 : 1,
        transition: 'border-color 180ms ease, opacity 180ms ease, background 180ms ease',
      }}
    >
      {/* Top Row: Title + Date/Time + Unread Indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 4,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {u.unread && (
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: 'var(--c-danger)',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
          )}
          <span
            style={{
              fontFamily: 'var(--font-head)',
              fontSize: 15,
              fontWeight: 700,
              color: isCompleted ? 'var(--c-text-soft)' : 'var(--c-text)',
              textDecoration: isCompleted ? 'line-through' : 'none',
            }}
          >
            {u.title}
          </span>
        </div>

        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11.5,
            color: 'var(--c-text-soft)',
            flexShrink: 0,
          }}
        >
          {u.date} {u.time ? `· ${u.time}` : ''}
        </span>
      </div>

      {/* Topic / Syllabus Sub-Box */}
      {u.topic && (
        <div
          style={{
            padding: '7px 10px',
            background: 'var(--c-card-subtle)',
            border: '1px solid var(--c-hairline)',
            borderRadius: 8,
            marginTop: 6,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              color: 'var(--c-text-faint)',
              marginBottom: 2,
            }}
          >
            {topicLabel}: {u.topic}
          </div>
        </div>
      )}

      {/* Status indicator (if completed/cancelled) */}
      {u.status !== 'pending' && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 10.5,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              color: isCompleted ? 'var(--c-success)' : isCancelled ? 'var(--c-danger)' : 'var(--c-text-faint)',
            }}
          >
            {u.status.replace('_', ' ')}
          </span>
        </div>
      )}
    </button>
  );
}
