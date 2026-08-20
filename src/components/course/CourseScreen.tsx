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
      {/* Course Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: 'var(--c-text)',
            cursor: 'pointer',
            padding: '4px 0',
            maxWidth: '80%',
          }}
        >
          <ChevronLeft size={20} strokeWidth={2} style={{ flexShrink: 0 }} />
          <span
            style={{
              fontFamily: 'var(--font-head)',
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {course.name}
          </span>
        </button>

        {isCR && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => onEditCourse(course)}
              title="Edit course name"
              style={{ color: 'var(--c-text-soft)', padding: 4 }}
            >
              <Edit3 size={16} />
            </button>
            <button
              onClick={() => onComposeForCourse(course)}
              title="New update for this course"
              style={{ color: 'var(--c-text-soft)', padding: 4 }}
            >
              <Plus size={19} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>

      {/* 4 Fixed Categories */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {CATEGORIES.map((cat) => {
          const count = store.getCategoryUpdateCount(course.id, cat.key);
          const unreadCount = store.getCategoryUnreadCount(course.id, cat.key);
          return (
            <button
              key={cat.key}
              onClick={() => onSelectCategory(cat.key)}
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
              <span
                style={{
                  fontFamily: 'var(--font-head)',
                  fontSize: 17,
                  fontWeight: 700,
                  color: 'var(--c-text)',
                }}
              >
                {cat.label}
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
                      fontWeight: count > 0 ? 700 : 400,
                      color: count > 0 ? 'var(--c-text)' : 'var(--c-text-faint)',
                    }}
                  >
                    {count}
                  </span>
                </div>
                <ChevronRight size={16} color="var(--c-text-faint)" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
