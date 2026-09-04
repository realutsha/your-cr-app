import {
  ChevronLeft,
  FolderPlus,
  Plus,
  ChevronRight,
  Atom,
  Laptop,
  Code,
  Palette,
  Calculator,
  FlaskConical,
  Cpu,
  BookOpen,
  Globe,
  Binary,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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

interface CourseTheme {
  id: string;
  tileBg: string;
  tileColor: string;
  glowColor: string;
  baseTint: string;
  darkTileBg: string;
  darkTileColor: string;
  darkGlowColor: string;
}

const THEMES: Record<string, CourseTheme> = {
  blue: {
    id: 'blue',
    tileBg: '#E9F2FE',
    tileColor: '#007AFF',
    glowColor: 'rgba(0, 122, 255, 0.09)',
    baseTint: 'rgba(233, 242, 254, 0.35)',
    darkTileBg: 'rgba(10, 132, 255, 0.18)',
    darkTileColor: '#409CFF',
    darkGlowColor: 'rgba(10, 132, 255, 0.12)',
  },
  purple: {
    id: 'purple',
    tileBg: '#F1EBFD',
    tileColor: '#8B5CF6',
    glowColor: 'rgba(139, 92, 246, 0.09)',
    baseTint: 'rgba(241, 235, 253, 0.35)',
    darkTileBg: 'rgba(175, 82, 222, 0.18)',
    darkTileColor: '#BF5AF2',
    darkGlowColor: 'rgba(175, 82, 222, 0.12)',
  },
  mint: {
    id: 'mint',
    tileBg: '#E4F6EF',
    tileColor: '#10B981',
    glowColor: 'rgba(16, 185, 129, 0.09)',
    baseTint: 'rgba(228, 246, 239, 0.35)',
    darkTileBg: 'rgba(52, 199, 89, 0.18)',
    darkTileColor: '#30D158',
    darkGlowColor: 'rgba(52, 199, 89, 0.12)',
  },
  peach: {
    id: 'peach',
    tileBg: '#FEF1E4',
    tileColor: '#D97706',
    glowColor: 'rgba(217, 119, 6, 0.09)',
    baseTint: 'rgba(254, 241, 228, 0.35)',
    darkTileBg: 'rgba(255, 159, 10, 0.18)',
    darkTileColor: '#FF9F0A',
    darkGlowColor: 'rgba(255, 159, 10, 0.12)',
  },
  pink: {
    id: 'pink',
    tileBg: '#FCE8F0',
    tileColor: '#EC4899',
    glowColor: 'rgba(236, 72, 153, 0.09)',
    baseTint: 'rgba(252, 232, 240, 0.35)',
    darkTileBg: 'rgba(255, 55, 95, 0.18)',
    darkTileColor: '#FF375F',
    darkGlowColor: 'rgba(255, 55, 95, 0.12)',
  },
  teal: {
    id: 'teal',
    tileBg: '#E2F7F8',
    tileColor: '#0EA5E9',
    glowColor: 'rgba(14, 165, 233, 0.09)',
    baseTint: 'rgba(226, 247, 248, 0.35)',
    darkTileBg: 'rgba(64, 200, 224, 0.18)',
    darkTileColor: '#40C8E0',
    darkGlowColor: 'rgba(64, 200, 224, 0.12)',
  },
  amber: {
    id: 'amber',
    tileBg: '#FEF6E4',
    tileColor: '#EAB308',
    glowColor: 'rgba(234, 179, 8, 0.09)',
    baseTint: 'rgba(254, 246, 228, 0.35)',
    darkTileBg: 'rgba(255, 214, 10, 0.18)',
    darkTileColor: '#FFD60A',
    darkGlowColor: 'rgba(255, 214, 10, 0.12)',
  },
  indigo: {
    id: 'indigo',
    tileBg: '#EDEAFE',
    tileColor: '#6366F1',
    glowColor: 'rgba(99, 102, 241, 0.09)',
    baseTint: 'rgba(237, 234, 254, 0.35)',
    darkTileBg: 'rgba(94, 92, 230, 0.18)',
    darkTileColor: '#5E5CE6',
    darkGlowColor: 'rgba(94, 92, 230, 0.12)',
  },
};

const THEME_LIST = Object.values(THEMES);
const FALLBACK_ICONS: LucideIcon[] = [
  BookOpen,
  Code,
  Atom,
  Laptop,
  Calculator,
  Palette,
  Cpu,
  FlaskConical,
  Globe,
  Binary,
];

function getCourseVisuals(courseName: string, courseId: string): { icon: LucideIcon; theme: CourseTheme } {
  const nameLower = (courseName || '').toLowerCase();

  // 1. Specific Keyword Matching for Academic Subjects
  if (nameLower.includes('physic') || nameLower.includes('quantum') || nameLower.includes('astronomy')) {
    return { icon: Atom, theme: THEMES.blue };
  }
  if (
    nameLower.includes('computer') ||
    nameLower.includes('hardware') ||
    nameLower.includes('os') ||
    nameLower.includes('operating')
  ) {
    return { icon: Laptop, theme: THEMES.purple };
  }
  if (
    nameLower.includes('program') ||
    nameLower.includes('code') ||
    nameLower.includes('software') ||
    nameLower.includes('algorithm') ||
    nameLower.includes('structur') ||
    nameLower.includes('develop') ||
    nameLower.includes('web')
  ) {
    return { icon: Code, theme: THEMES.mint };
  }
  if (
    nameLower.includes('art') ||
    nameLower.includes('living') ||
    nameLower.includes('design') ||
    nameLower.includes('draw') ||
    nameLower.includes('culture') ||
    nameLower.includes('philosophy') ||
    nameLower.includes('ethics')
  ) {
    return { icon: Palette, theme: THEMES.peach };
  }
  if (
    nameLower.includes('math') ||
    nameLower.includes('calculus') ||
    nameLower.includes('algebra') ||
    nameLower.includes('stat') ||
    nameLower.includes('discrete') ||
    nameLower.includes('numeric')
  ) {
    return { icon: Calculator, theme: THEMES.pink };
  }
  if (nameLower.includes('chem') || nameLower.includes('bio') || nameLower.includes('lab')) {
    return { icon: FlaskConical, theme: THEMES.teal };
  }
  if (
    nameLower.includes('circuit') ||
    nameLower.includes('electron') ||
    nameLower.includes('logic') ||
    nameLower.includes('micro') ||
    nameLower.includes('vlsi') ||
    nameLower.includes('embedded')
  ) {
    return { icon: Cpu, theme: THEMES.indigo };
  }
  if (
    nameLower.includes('network') ||
    nameLower.includes('telecom') ||
    nameLower.includes('global') ||
    nameLower.includes('internet') ||
    nameLower.includes('comm')
  ) {
    return { icon: Globe, theme: THEMES.teal };
  }
  if (
    nameLower.includes('english') ||
    nameLower.includes('bangla') ||
    nameLower.includes('history') ||
    nameLower.includes('literature') ||
    nameLower.includes('book') ||
    nameLower.includes('read') ||
    nameLower.includes('write')
  ) {
    return { icon: BookOpen, theme: THEMES.blue };
  }
  if (
    nameLower.includes('data') ||
    nameLower.includes('binary') ||
    nameLower.includes('ai') ||
    nameLower.includes('machine') ||
    nameLower.includes('cloud')
  ) {
    return { icon: Binary, theme: THEMES.purple };
  }

  // 2. Deterministic Hash Fallback for Any Arbitrary or Future Course
  let hash = 0;
  const seed = courseName || courseId || 'course';
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }

  const themeIndex = Math.abs(hash) % THEME_LIST.length;
  const iconIndex = Math.abs(hash >> 3) % FALLBACK_ICONS.length;

  return {
    icon: FALLBACK_ICONS[iconIndex],
    theme: THEME_LIST[themeIndex],
  };
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
            cursor: 'pointer',
            padding: '4px 0',
            maxWidth: '75%',
            background: 'none',
            border: 'none',
          }}
        >
          <ChevronLeft size={24} strokeWidth={2.6} style={{ color: 'var(--c-accent, #007aff)', flexShrink: 0 }} />
          <span
            style={{
              fontFamily: 'var(--font-head, -apple-system, BlinkMacSystemFont, sans-serif)',
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--c-text, #000000)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              letterSpacing: '-0.02em',
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
              className="cm-header-action-btn"
              aria-label="Add or manage courses"
            >
              <FolderPlus size={18} strokeWidth={2.1} />
            </button>
            <button
              onClick={onCompose}
              title="New academic update"
              className="cm-header-action-btn"
              aria-label="New academic update"
            >
              <Plus size={20} strokeWidth={2.3} />
            </button>
          </div>
        )}
      </header>

      {/* Course List / Responsive Grid */}
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
        <div className="cm-course-grid">
          {courses.map((course) => {
            const unreadCount =
              typeof course.unread_count === 'number'
                ? course.unread_count
                : store.getCourseUnreadCount(course.id);
            const { icon: CourseIcon, theme } = getCourseVisuals(course.name, course.id);

            return (
              <div
                key={course.id}
                className="cm-course-card"
                role="button"
                tabIndex={0}
                style={
                  {
                    '--card-glow': theme.glowColor,
                    '--card-tint': theme.baseTint,
                    '--card-dark-glow': theme.darkGlowColor,
                  } as React.CSSProperties
                }
                onClick={() => onSelectCourse(course)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectCourse(course);
                  }
                }}
              >
                {/* Top: Subject Icon Tile and Unread Badge */}
                <div className="cm-course-card-top">
                  <div
                    className="cm-course-icon-tile"
                    style={
                      {
                        '--tile-bg': theme.tileBg,
                        '--tile-color': theme.tileColor,
                        '--tile-dark-bg': theme.darkTileBg,
                        '--tile-dark-color': theme.darkTileColor,
                      } as React.CSSProperties
                    }
                  >
                    <CourseIcon size={23} strokeWidth={2.1} />
                  </div>

                  {unreadCount > 0 && (
                    <span className="cm-course-unread-badge" aria-label={`${unreadCount} unread updates`}>
                      {unreadCount}
                    </span>
                  )}
                </div>

                {/* Course Name Typography */}
                <h3 className="cm-course-title">
                  {course.name}
                </h3>

                {/* Bottom-Right Circular Chevron */}
                <div className="cm-course-chevron-circle" aria-hidden="true">
                  <ChevronRight size={15} strokeWidth={2.4} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

