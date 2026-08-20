import React from 'react';
import { BookOpen, ChevronRight, Compass, FolderPlus, Plus, Share2, Sparkles } from 'lucide-react';
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

interface CardTheme {
  bg: string;
  borderColor: string;
  iconColor: string;
  dividerColor: string;
  textColor: string;
  badgeBg: string;
  badgeColor: string;
  arrowColor: string;
  bgPattern?: string;
  bgSize?: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string; style?: React.CSSProperties }>;
}

const CARD_THEMES: CardTheme[] = [
  // 1. Mint / Seafoam (Matches card 1 from screenshot)
  {
    bg: '#EBF7F5',
    borderColor: '#9BDAD0',
    iconColor: '#60AB9B',
    dividerColor: 'rgba(96, 171, 155, 0.35)',
    textColor: '#192C29',
    badgeBg: '#B6E6DD',
    badgeColor: '#145D51',
    arrowColor: '#284640',
    bgPattern: 'linear-gradient(to right, rgba(0, 160, 120, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 160, 120, 0.05) 1px, transparent 1px)',
    bgSize: '12px 12px',
    Icon: BookOpen,
  },
  // 2. Lavender / Purple (Matches card 2 from screenshot)
  {
    bg: '#F2EFFC',
    borderColor: '#BEB2E9',
    iconColor: '#8071BB',
    dividerColor: 'rgba(128, 113, 187, 0.35)',
    textColor: '#231D3A',
    badgeBg: '#4B427B',
    badgeColor: '#FFFFFF',
    arrowColor: '#362E56',
    bgPattern: 'radial-gradient(circle at 85% 50%, rgba(120, 90, 200, 0.06) 0%, transparent 60%), radial-gradient(circle at 15% 50%, rgba(120, 90, 200, 0.04) 0%, transparent 60%)',
    bgSize: '100% 100%',
    Icon: Share2,
  },
  // 3. Soft Sky Blue
  {
    bg: '#EDF5FD',
    borderColor: '#ADD3F7',
    iconColor: '#5392CE',
    dividerColor: 'rgba(83, 146, 206, 0.35)',
    textColor: '#182C40',
    badgeBg: '#366898',
    badgeColor: '#FFFFFF',
    arrowColor: '#21405F',
    bgPattern: 'linear-gradient(to right, rgba(40, 120, 220, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(40, 120, 220, 0.04) 1px, transparent 1px)',
    bgSize: '12px 12px',
    Icon: Compass,
  },
  // 4. Warm Amber / Peach
  {
    bg: '#FDF6EC',
    borderColor: '#EFCFA6',
    iconColor: '#D38A44',
    dividerColor: 'rgba(211, 138, 68, 0.35)',
    textColor: '#402913',
    badgeBg: '#E2A05F',
    badgeColor: '#FFFFFF',
    arrowColor: '#553416',
    bgPattern: 'radial-gradient(circle at 85% 50%, rgba(220, 140, 60, 0.06) 0%, transparent 60%)',
    bgSize: '100% 100%',
    Icon: Sparkles,
  },
];

export function HomeScreen({
  group,
  courses,
  isCR,
  onSelectCourse,
  onCompose,
  onManageCourses,
}: HomeScreenProps) {
  // Format section header e.g. "Courses Section - i"
  const rawName = (group.name || '').trim();
  const displaySectionHeader = rawName.toLowerCase().startsWith('courses')
    ? rawName
    : rawName.toLowerCase().includes('section')
    ? `Courses ${rawName}`
    : `Courses — ${rawName}`;

  return (
    <div style={{ paddingTop: 4 }}>
      {/* 1. ClassMate Main Brand Header */}
      <div
        style={{
          fontFamily: 'var(--font-head)',
          fontSize: 28,
          fontWeight: 800,
          letterSpacing: '-0.025em',
          color: 'var(--c-text, #1E2238)',
          marginBottom: 28,
        }}
      >
        ClassMate
      </div>

      {/* 2. Courses Section Header & Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-head)',
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--c-text, #1E2238)',
            letterSpacing: '-0.015em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '75%',
          }}
        >
          {displaySectionHeader}
        </span>

        {isCR && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              onClick={onManageCourses}
              title="Add or manage courses"
              style={{
                color: 'var(--c-text, #1E2238)',
                padding: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <FolderPlus size={20} strokeWidth={2} />
            </button>
            <button
              onClick={onCompose}
              title="New academic update"
              style={{
                color: 'var(--c-text, #1E2238)',
                padding: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Plus size={22} strokeWidth={2.2} />
            </button>
          </div>
        )}
      </div>

      {courses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 16px' }}>
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
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Add first course
            </button>
          )}
        </div>
      ) : (
        /* 3. List of Course Cards Matching Reference */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {courses.map((course, idx) => {
            const updateCount = store.getCourseUpdateCount(course.id);
            const theme = CARD_THEMES[idx % CARD_THEMES.length];
            const CardIcon = theme.Icon;

            return (
              <button
                key={course.id}
                onClick={() => onSelectCourse(course)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 18px',
                  background: theme.bg,
                  backgroundImage: theme.bgPattern,
                  backgroundSize: theme.bgSize,
                  border: `1.5px solid ${theme.borderColor}`,
                  borderRadius: 16,
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
                  transition: 'transform 140ms ease, box-shadow 140ms ease',
                  outline: 'none',
                }}
              >
                {/* Left Part: Icon + Divider + Course Name */}
                <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 28,
                      height: 28,
                      flexShrink: 0,
                      color: theme.iconColor,
                    }}
                  >
                    <CardIcon size={22} strokeWidth={1.8} />
                  </div>

                  <div
                    style={{
                      width: 1,
                      height: 26,
                      background: theme.dividerColor,
                      margin: '0 14px',
                      flexShrink: 0,
                    }}
                  />

                  <span
                    style={{
                      fontFamily: 'var(--font-head)',
                      fontSize: 16,
                      fontWeight: 700,
                      color: theme.textColor,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {course.name}
                  </span>
                </div>

                {/* Right Part: Count Badge + Chevron Right */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginLeft: 12 }}>
                  <span
                    style={{
                      minWidth: 26,
                      height: 26,
                      padding: '0 7px',
                      borderRadius: 999,
                      background: theme.badgeBg,
                      color: theme.badgeColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {updateCount}
                  </span>
                  <ChevronRight size={18} color={theme.arrowColor} strokeWidth={2} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
