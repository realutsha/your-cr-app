import { ChevronRight } from 'lucide-react';
import type { Group } from '../../types';
import { getExpirationCountdown } from '../../lib/auth';
import { store } from '../../lib/store';

interface HomeScreenProps {
  group: Group;
  onShowCourses: () => void;
}

export function HomeScreen({
  group,
  onShowCourses,
}: HomeScreenProps) {
  // Expiration countdown (e.g. "7 days remaining", "6 days remaining", etc. in final week)
  const countdown = getExpirationCountdown(group.expires_at);
  const totalUnreadCount = store.getTotalUnreadCount();

  return (
    <div
      style={{
        minHeight: 'calc(80dvh - 60px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        padding: '24px 0',
        boxSizing: 'border-box',
      }}
    >
      {countdown.isFinalWeek && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            background: 'rgba(255, 59, 48, 0.1)',
            border: '1px solid rgba(255, 59, 48, 0.25)',
            borderRadius: 20,
            padding: '4px 12px',
            color: 'var(--c-danger)',
            fontSize: 12,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            marginBottom: 16,
          }}
        >
          <span>⏳ {countdown.label}</span>
        </div>
      )}

      {/* 1. ClassMate Main Brand Header */}
      <h1
        style={{
          fontFamily: 'var(--font-head)',
          fontSize: 38,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          color: 'var(--c-text)',
          margin: '0 0 10px 0',
          lineHeight: 1.15,
        }}
      >
        ClassMate
      </h1>

      {/* 2. Current Section / Class Name */}
      <p
        style={{
          fontFamily: 'var(--font-head)',
          fontSize: 19,
          fontWeight: 600,
          color: 'var(--c-text-soft)',
          letterSpacing: '-0.015em',
          margin: '0 0 32px 0',
          lineHeight: 1.35,
          maxWidth: 360,
        }}
      >
        {group.name}
      </p>

      {/* 3. Main Action: Show Courses Button */}
      <div style={{ width: '100%', maxWidth: 320 }}>
        <button
          type="button"
          onClick={onShowCourses}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '16px 24px',
            background: 'var(--c-accent, #007aff)',
            color: '#FFFFFF',
            fontFamily: 'var(--font-head, -apple-system, sans-serif)',
            fontSize: 17,
            fontWeight: 600,
            borderRadius: 16,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 16px var(--c-accent-glow, rgba(0, 122, 255, 0.3))',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            boxSizing: 'border-box',
          }}
        >
          <span>Show Courses</span>
          {totalUnreadCount > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 22,
                height: 22,
                padding: '0 6px',
                borderRadius: 999,
                background: '#FFFFFF',
                color: 'var(--c-accent, #007aff)',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              {totalUnreadCount}
            </span>
          )}
          <ChevronRight size={19} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
