import { ChevronRight, FolderPlus, Plus } from 'lucide-react';
import type { Course, Group } from '../../types';
import { store } from '../../lib/store';

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
  return (
    <div>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12.5,
            color: 'var(--c-text-faint)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '75%',
          }}
        >
          {group.name}
        </span>
        {isCR && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={onManageCourses}
              title="Add or manage courses"
              style={{
                color: 'var(--c-text-soft)',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FolderPlus size={18} strokeWidth={2} />
            </button>
            <button
              onClick={onCompose}
              title="New academic update"
              style={{
                color: 'var(--c-text-soft)',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Plus size={19} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>

      {courses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 16px' }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--c-text-faint)', marginBottom: 14 }}>
            {isCR ? 'No courses added yet. Define courses for your class.' : 'No courses created for this class yet.'}
          </div>
          {isCR && (
            <button
              onClick={onManageCourses}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                fontWeight: 600,
                color: '#FFFFFF',
                background: 'var(--c-accent)',
                padding: '9px 16px',
                borderRadius: 10,
              }}
            >
              Add first course
            </button>
          )}
        </div>
      ) : (
        /* List of Courses */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {courses.map((course) => {
            const updateCount = store.getCourseUpdateCount(course.id);
            const unreadCount = store.getCourseUnreadCount(course.id);
            return (
              <button
                key={course.id}
                onClick={() => onSelectCourse(course)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '20px 18px',
                  background: 'var(--c-card-bg)',
                  border: `1px solid ${unreadCount > 0 ? 'var(--c-hairline-strong)' : 'var(--c-hairline)'}`,
                  borderRadius: 16,
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                  transition: 'background 160ms ease, border-color 160ms ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-head)',
                      fontSize: 16.5,
                      fontWeight: 700,
                      color: 'var(--c-text)',
                      lineHeight: 1.3,
                    }}
                  >
                    {course.name}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {unreadCount > 0 && (
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
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12.5,
                        fontWeight: updateCount > 0 ? 700 : 400,
                        color: updateCount > 0 ? 'var(--c-text)' : 'var(--c-text-faint)',
                      }}
                    >
                      {updateCount}
                    </span>
                  </div>
                  <ChevronRight size={16} color="var(--c-text-faint)" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
