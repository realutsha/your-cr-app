import { ChevronLeft, FolderPlus, Plus } from 'lucide-react';
import type { Course } from '../../types';
import { store } from '../../lib/store';
import '../home/CourseRow.css';

interface CoursesListScreenProps {
  courses: Course[];
  isCR: boolean;
  onBack: () => void;
  onSelectCourse: (course: Course) => void;
  onCompose: () => void;
  onManageCourses: () => void;
}

export function CoursesListScreen({
  courses,
  isCR,
  onBack,
  onSelectCourse,
  onCompose,
  onManageCourses,
}: CoursesListScreenProps) {
  return (
    <div style={{ paddingTop: 4 }}>
      {/* Top Header with Back button to Home & CR Actions */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <button
          onClick={onBack}
          aria-label="Back to Home"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            color: 'var(--c-accent)',
            cursor: 'pointer',
            padding: '4px 0',
            maxWidth: '75%',
            background: 'none',
            border: 'none',
          }}
        >
          <ChevronLeft size={22} strokeWidth={2.5} style={{ flexShrink: 0 }} />
          <span
            style={{
              fontFamily: 'var(--font-head)',
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--c-text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              letterSpacing: '-0.015em',
            }}
          >
            All Courses
          </span>
        </button>

        {isCR && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
      </header>

      {/* Course List */}
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
        <div className="cm-course-list">
          {courses.map((course) => {
            const updateCount = store.getCourseUpdateCount(course.id);

            return (
              <div
                key={course.id}
                className="cm-course-row"
                role="button"
                tabIndex={0}
                onClick={() => onSelectCourse(course)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectCourse(course);
                  }
                }}
              >
                <div className="cm-course-content">
                  <div className="cm-course-header">
                    <p className="cm-course-title">
                      {course.name}
                    </p>

                    <div className="cm-course-meta">
                      {updateCount > 0 && (
                        <span className="cm-course-badge">
                          {updateCount}
                        </span>
                      )}
                      <span className="cm-course-arrow">
                        ›
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
