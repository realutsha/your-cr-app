import { BookOpen, ChevronRight, FolderPlus, Plus } from 'lucide-react';
import type { Course, Group } from '../../types';
import { store } from '../../lib/store';
import { getExpirationCountdown } from '../../lib/auth';

interface HomeScreenProps {
  group: Group;
  courses: Course[];
  isCR: boolean;
  onSelectCourse: (course: Course) => void;
  onCompose: () => void;
  onManageCourses: () => void;
}

export function HomeScreen({
  group,
  courses,
  isCR,
  onSelectCourse,
  onCompose,
  onManageCourses,
}: HomeScreenProps) {
  // Expiration countdown (e.g. "7 days remaining", "6 days remaining", etc. in final week)
  const countdown = getExpirationCountdown(group.expires_at);

  // Format section header e.g. "Courses — Section 21"
  const rawName = (group.name || '').trim();
  const displaySectionHeader = rawName.toLowerCase().startsWith('courses')
    ? rawName
    : rawName.toLowerCase().includes('section')
    ? `Courses ${rawName}`
    : `Courses — ${rawName}`;

  return (
    <div style={{ paddingTop: 4 }}>
      {/* 1. ClassMate Main Brand Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-head)',
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: '-0.025em',
            color: 'var(--c-text)',
            margin: 0,
            lineHeight: 1.15,
          }}
        >
          ClassMate
        </h1>

        {countdown.isFinalWeek && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: 'rgba(255, 59, 48, 0.1)',
              border: '1px solid rgba(255, 59, 48, 0.25)',
              borderRadius: 20,
              padding: '4px 10px',
              color: 'var(--c-danger)',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span>⏳ {countdown.label}</span>
          </div>
        )}
      </header>

      {/* 2. Courses Section Header & CR Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          paddingLeft: 4,
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-head)',
            fontSize: 22,
            fontWeight: 600,
            color: 'var(--c-text)',
            letterSpacing: '-0.015em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '75%',
            margin: 0,
          }}
        >
          {displaySectionHeader}
        </h2>

        {isCR && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={onManageCourses}
              title="Add or manage courses"
              style={{
                color: 'var(--c-accent)',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--c-accent-bg)',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <FolderPlus size={18} strokeWidth={2} />
            </button>
            <button
              onClick={onCompose}
              title="New academic update"
              style={{
                color: 'var(--c-accent)',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--c-accent-bg)',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Plus size={19} strokeWidth={2.2} />
            </button>
          </div>
        )}
      </div>

      {/* 3. Course List */}
      {courses.length === 0 ? (
        <div
          style={{
            background: 'var(--c-card-bg)',
            borderRadius: 16,
            border: '1px solid var(--c-hairline)',
            textAlign: 'center',
            padding: '48px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--c-text-faint)', marginBottom: 16 }}>
            {isCR ? 'No courses added yet. Define courses for your class.' : 'No courses created for this class yet.'}
          </div>
          {isCR && (
            <button
              onClick={onManageCourses}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                fontWeight: 600,
                color: '#FFFFFF',
                background: 'var(--c-accent)',
                padding: '10px 18px',
                borderRadius: 12,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 8px var(--c-accent-glow)',
              }}
            >
              Add first course
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            background: 'var(--c-card-bg)',
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid var(--c-hairline)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
          }}
        >
          {courses.map((course, idx) => {
            const updateCount = store.getCourseUpdateCount(course.id);
            const isLast = idx === courses.length - 1;

            return (
              <button
                key={course.id}
                onClick={() => onSelectCourse(course)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  background: 'var(--c-card-bg)',
                  borderBottom: isLast ? 'none' : '1px solid var(--c-hairline)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 160ms ease',
                }}
              >
                {/* Left Part: Icon + Course Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: 'var(--c-accent-bg)',
                      color: 'var(--c-accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <BookOpen size={20} strokeWidth={2} />
                  </div>

                  <span
                    style={{
                      fontFamily: 'var(--font-head)',
                      fontSize: 17,
                      fontWeight: 600,
                      color: 'var(--c-text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      letterSpacing: '-0.015em',
                    }}
                  >
                    {course.name}
                  </span>
                </div>

                {/* Right Part: Count Badge + Chevron Right */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginLeft: 12 }}>
                  {updateCount > 0 && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 22,
                        height: 22,
                        padding: '0 6px',
                        borderRadius: 999,
                        background: 'var(--c-accent)',
                        color: '#FFFFFF',
                        fontFamily: 'var(--font-body)',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {updateCount}
                    </span>
                  )}
                  <ChevronRight size={18} color="var(--c-text-faint)" strokeWidth={2} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
