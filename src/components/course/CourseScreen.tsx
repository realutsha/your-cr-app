import { useState, useEffect } from 'react';
import {
  ChevronLeft,
  Edit3,
  FileText,
  FlaskConical,
  HelpCircle,
  Plus,
  Presentation,
} from 'lucide-react';
import { CATEGORIES, type AcademicCategory, type Course } from '../../types';
import { store } from '../../lib/store';

interface CourseScreenProps {
  course: Course;
  isCR: boolean;
  onBack: () => void;
  onSelectCategory: (category: AcademicCategory) => void;
  onComposeForCourse: (course: Course) => void;
  onEditCourse: (course: Course) => void;
  selectedCategory?: AcademicCategory | null;
}

// Module-level cache to remember the selected category per course across navigations
const lastSelectedByCategory: Record<string, AcademicCategory> = {};

function getCategoryIcon(key: string, size = 26) {
  switch (key.toLowerCase()) {
    case 'lab':
      return <FlaskConical size={size} strokeWidth={2} />;
    case 'presentation':
      return <Presentation size={size} strokeWidth={2} />;
    case 'assignment':
      return <FileText size={size} strokeWidth={2} />;
    case 'quiz':
      return <HelpCircle size={size} strokeWidth={2} />;
    default:
      return <FileText size={size} strokeWidth={2} />;
  }
}

export function CourseScreen({
  course,
  isCR,
  onBack,
  onSelectCategory,
  onComposeForCourse,
  onEditCourse,
  selectedCategory: propSelectedCategory,
}: CourseScreenProps) {
  // Determine the selected/highlighted category dynamically
  const [selectedCategory, setSelectedCategory] = useState<AcademicCategory | null>(() => {
    if (propSelectedCategory !== undefined) return propSelectedCategory;
    if (lastSelectedByCategory[course.id]) return lastSelectedByCategory[course.id];

    // Check if there is an active category with updates or unread
    const withUnread = CATEGORIES.find((c) => store.getCategoryUnreadCount(course.id, c.key) > 0);
    if (withUnread) return withUnread.key;

    const withUpdates = CATEGORIES.find((c) => store.getCategoryUpdateCount(course.id, c.key) > 0);
    if (withUpdates) return withUpdates.key;

    return null;
  });

  useEffect(() => {
    if (propSelectedCategory !== undefined) {
      setSelectedCategory(propSelectedCategory);
      if (propSelectedCategory) {
        lastSelectedByCategory[course.id] = propSelectedCategory;
      }
    }
  }, [propSelectedCategory, course.id]);

  const handleCategoryClick = (catKey: AcademicCategory) => {
    setSelectedCategory(catKey);
    lastSelectedByCategory[course.id] = catKey;
    onSelectCategory(catKey);
  };

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Top Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          padding: '2px 0',
        }}
      >
        {/* Left: Back chevron + Course Name */}
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            padding: '4px 0',
            maxWidth: isCR ? '72%' : '90%',
            background: 'none',
            border: 'none',
            textAlign: 'left',
          }}
        >
          <ChevronLeft
            size={24}
            strokeWidth={2.5}
            style={{ color: 'var(--c-accent)', flexShrink: 0 }}
          />
          <h1
            style={{
              fontFamily: 'var(--font-head)',
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--c-text)',
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              letterSpacing: '-0.02em',
            }}
          >
            {course.name}
          </h1>
        </button>

        {/* Right: Edit & Add Buttons for CR */}
        {isCR && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => onEditCourse(course)}
              title="Edit course name"
              aria-label="Edit course name"
              style={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--c-accent-bg)',
                color: 'var(--c-accent)',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                transition: 'opacity 150ms ease',
              }}
            >
              <Edit3 size={17} />
            </button>
            <button
              type="button"
              onClick={() => onComposeForCourse(course)}
              title="New update for this course"
              aria-label="New update for this course"
              style={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--c-accent-bg)',
                color: 'var(--c-accent)',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                transition: 'opacity 150ms ease',
              }}
            >
              <Plus size={20} strokeWidth={2.4} />
            </button>
          </div>
        )}
      </header>

      {/* 2-Column Assessment Category Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 14,
        }}
      >
        {CATEGORIES.map((cat) => {
          const count = store.getCategoryUpdateCount(course.id, cat.key);
          const unreadCount = store.getCategoryUnreadCount(course.id, cat.key);
          const isSelected = selectedCategory === cat.key;

          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => handleCategoryClick(cat.key)}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px 14px 20px',
                borderRadius: 20,
                background: isSelected ? 'var(--c-accent-bg)' : 'var(--c-card-bg)',
                border: isSelected
                  ? '1.5px solid var(--c-accent)'
                  : '1px solid var(--c-hairline)',
                boxShadow: isSelected
                  ? '0 4px 14px rgba(0, 122, 255, 0.10)'
                  : '0 2px 8px rgba(0, 0, 0, 0.025)',
                cursor: 'pointer',
                textAlign: 'center',
                userSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
                transition:
                  'transform 150ms ease, background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
              }}
            >
              {/* Optional Unread Notification Dot */}
              {unreadCount > 0 && (
                <div
                  title={`${unreadCount} unread update${unreadCount === 1 ? '' : 's'}`}
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--c-danger)',
                  }}
                />
              )}

              {/* 1. Category Icon inside soft rounded-square container */}
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: isSelected ? 'var(--c-accent-bg)' : 'var(--c-card-subtle)',
                  color: isSelected ? 'var(--c-accent)' : 'var(--c-text-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                  transition: 'background-color 160ms ease, color 160ms ease',
                }}
              >
                {getCategoryIcon(cat.key)}
              </div>

              {/* 2. Category Name below the icon */}
              <div
                style={{
                  fontFamily: 'var(--font-head)',
                  fontSize: 16,
                  fontWeight: 600,
                  color: 'var(--c-text)',
                  marginBottom: 12,
                  letterSpacing: '-0.01em',
                  width: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {cat.label}
              </div>

              {/* 3. Large Item Count */}
              <div
                style={{
                  fontFamily: 'var(--font-head)',
                  fontSize: 34,
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  color: isSelected ? 'var(--c-accent)' : 'var(--c-text)',
                  lineHeight: 1,
                  marginBottom: 4,
                  transition: 'color 160ms ease',
                }}
              >
                {count}
              </div>

              {/* 4. Small Label Underneath: "item" (singular) or "items" (plural) */}
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12.5,
                  fontWeight: 400,
                  color: 'var(--c-text-faint)',
                  letterSpacing: '0.01em',
                }}
              >
                {count === 1 ? 'item' : 'items'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
