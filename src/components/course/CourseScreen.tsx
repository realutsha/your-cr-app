import { ChevronLeft, ChevronRight, Edit3, Plus } from 'lucide-react';
import { CATEGORIES, type AcademicCategory, type Course } from '../../types';
import { store } from '../../lib/store';

interface CourseScreenProps {
  course: Course;
  isCR: boolean;
  onBack: () => void;
  onSelectCategory: (category: AcademicCategory) => void;
  onComposeForCourse: (course: Course) => void;
  onEditCourse: (course: Course) => void;
}

export function CourseScreen({
  course,
  isCR,
  onBack,
  onSelectCategory,
  onComposeForCourse,
  onEditCourse,
}: CourseScreenProps) {
  return (
    <div>
      {/* Top Header */}
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
          aria-label="Go back"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            color: 'var(--c-accent)',
            cursor: 'pointer',
            padding: '4px 0',
            maxWidth: '75%',
          }}
        >
          <ChevronLeft size={22} strokeWidth={2.5} style={{ flexShrink: 0 }} />
          <span
            style={{
              fontFamily: 'var(--font-head)',
              fontSize: 17,
              fontWeight: 700,
              color: 'var(--c-text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              letterSpacing: '-0.015em',
            }}
          >
            {course.name}
          </span>
        </button>

        {isCR && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => onEditCourse(course)}
              title="Edit course name"
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
              <Edit3 size={16} />
            </button>
            <button
              onClick={() => onComposeForCourse(course)}
              title="New update for this course"
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
              <Plus size={18} strokeWidth={2.2} />
            </button>
          </div>
        )}
      </header>

      {/* Course Categories Grouped List */}
      <div
        style={{
          background: 'var(--c-card-bg)',
          borderRadius: 16,
          overflow: 'hidden',
          border: '1px solid var(--c-hairline)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
        }}
      >
        {CATEGORIES.map((cat, idx) => {
          const count = store.getCategoryUpdateCount(course.id, cat.key);
          const unreadCount = store.getCategoryUnreadCount(course.id, cat.key);
          const isLast = idx === CATEGORIES.length - 1;

          return (
            <button
              key={cat.key}
              onClick={() => onSelectCategory(cat.key)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 18px',
                background: 'var(--c-card-bg)',
                borderBottom: isLast ? 'none' : '1px solid var(--c-hairline)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 160ms ease',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-head)',
                  fontSize: 17,
                  fontWeight: 500,
                  color: 'var(--c-text)',
                  letterSpacing: '-0.01em',
                }}
              >
                {cat.label}
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {unreadCount > 0 && (
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
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 15,
                    fontWeight: count > 0 ? 600 : 400,
                    color: count > 0 ? 'var(--c-text-soft)' : 'var(--c-text-faint)',
                  }}
                >
                  {count}
                </span>
                <ChevronRight size={18} color="var(--c-text-faint)" strokeWidth={2} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
