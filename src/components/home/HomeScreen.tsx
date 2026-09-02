import type { Group } from '../../types';
import { getExpirationCountdown } from '../../lib/auth';
import { store } from '../../lib/store';
import './ShowCoursesButton.css';

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

      {/* 3. Main Action: Show Courses Button with Uiverse Ripple Animation */}
      <div style={{ width: '100%', maxWidth: 320, display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={onShowCourses}
          className="cm-show-courses-btn"
        >
          <i className="cm-show-courses-anim" />
          <span className="cm-show-courses-label">
            <span>Show Courses</span>
            {totalUnreadCount > 0 && (
              <span className="cm-show-courses-badge">
                {totalUnreadCount}
              </span>
            )}
          </span>
          <i className="cm-show-courses-anim" />
        </button>
      </div>
    </div>
  );
}
