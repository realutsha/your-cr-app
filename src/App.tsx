import React, { useState, useEffect, useRef } from 'react';
import {
  Home as HomeIcon,
  User as UserIcon,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  X,
  Plus,
  Trash2,
  Edit3,
  ArrowRight,
  Clock,
  Sun,
  Moon,
  Laptop,
  FolderPlus,
  ExternalLink,
  Bell,
} from 'lucide-react';
import { store } from './lib/store';
import { formatFriendlyDate } from './lib/auth';
import {
  getThemePreference,
  setThemePreference,
  subscribeTheme,
  type ThemePreference,
} from './lib/theme';
import {
  initForegroundNotificationListener,
  requestNotificationPermission,
} from './lib/notifications';
import type {
  User,
  Group,
  Course,
  AcademicUpdate,
  AcademicCategory,
  UpdateStatus,
  ApprovalMode,
} from './types';
import { AuthModal } from './components/auth/AuthModal';

const NAV_H = 58;

const CATEGORIES: { key: AcademicCategory; label: string; topicLabel: string; emptyLabel: string }[] = [
  { key: 'lab', label: 'Lab', topicLabel: 'Topics', emptyLabel: 'No updates in Lab' },
  { key: 'presentation', label: 'Presentation', topicLabel: 'Topic', emptyLabel: 'No updates in Presentation' },
  { key: 'assignment', label: 'Assignment', topicLabel: 'Requirements', emptyLabel: 'No updates in Assignment' },
  { key: 'quiz', label: 'Quiz', topicLabel: 'Syllabus / Topics', emptyLabel: 'No updates in Quiz' },
];

const STATUS_OPTIONS: { key: UpdateStatus; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'passed_deadline', label: 'Passed deadline' },
];

/* ---------------------------------------------------------------
   URL HELPERS
----------------------------------------------------------------*/
function isValidUrl(url: string): boolean {
  if (!url || !url.trim()) return true; // Optional field
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function getResourceLinkLabel(url: string, category?: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('drive.google.com') || lower.endsWith('.pdf')) {
    if (category === 'quiz') return 'Open Syllabus PDF';
    if (category === 'lab') return 'Open Lab Guidelines';
    if (category === 'presentation') return 'Open Presentation Guidelines';
    if (category === 'assignment') return 'Open Assignment PDF';
    return 'View PDF';
  }
  if (lower.includes('docs.google.com/document')) {
    return 'Open Document';
  }
  if (lower.includes('docs.google.com/forms') || lower.includes('forms.gle')) {
    return 'Open Form';
  }
  if (lower.includes('docs.google.com/presentation')) {
    return 'Open Presentation Slides';
  }
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    return 'Watch Video';
  }
  if (lower.includes('github.com')) {
    return 'Open GitHub';
  }
  if (lower.includes('classroom.google.com')) {
    return 'Open Classroom';
  }
  if (lower.includes('blc.daffodilvarsity.edu.bd') || lower.includes('blc.')) {
    return 'Open BLC';
  }
  return 'Open Resource';
}

/* ---------------------------------------------------------------
   PRIMITIVES: SHEET & TOAST
----------------------------------------------------------------*/
interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

function Sheet({ open, onClose, children }: SheetProps) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let raf1: number;
    let raf2: number;
    let timer: ReturnType<typeof setTimeout>;

    if (open) {
      setMounted(true);
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setShown(true));
      });
    } else {
      setShown(false);
      timer = setTimeout(() => setMounted(false), 280);
    }
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(timer);
    };
  }, [open]);

  if (!mounted) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--c-backdrop)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          opacity: shown ? 1 : 0,
          transition: 'opacity 260ms ease',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: '88vh',
          margin: '0 auto',
          maxWidth: 480,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--c-sheet-bg)',
          borderTop: '1px solid var(--c-hairline-strong)',
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
          transform: shown ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 6 }}>
          <div style={{ width: 34, height: 4, borderRadius: 999, background: 'var(--c-hairline-strong)' }} />
        </div>
        <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>{children}</div>
      </div>
    </div>
  );
}

function Toast({ message }: { message: string }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, [message]);

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        top: 18,
        zIndex: 90,
        pointerEvents: 'none',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12.5,
          fontWeight: 500,
          color: '#F4F5F7',
          background: 'var(--c-toast-bg)',
          border: '1px solid var(--c-hairline-strong)',
          borderRadius: 10,
          padding: '8px 14px',
          opacity: shown ? 1 : 0,
          transform: shown ? 'translateY(0)' : 'translateY(-6px)',
          transition: 'all 220ms ease',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}
      >
        {message}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   UNREAD INDICATOR BADGE
----------------------------------------------------------------*/
function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) {
    return (
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12.5,
          color: 'var(--c-text-faint)',
        }}
      >
        0
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
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
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12.5,
          fontWeight: 700,
          color: 'var(--c-danger)',
        }}
      >
        {count}
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------
   FORM FIELD PRIMITIVE
----------------------------------------------------------------*/
interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label: string;
  as?: 'input' | 'textarea';
  rows?: number;
}

function Field({ label, as = 'input', ...props }: FieldProps) {
  const Component = as;
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: 'block',
          fontFamily: 'var(--font-body)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.4,
          color: 'var(--c-text-faint)',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      <Component
        {...(props as any)}
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          color: 'var(--c-text)',
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid var(--c-hairline)',
          borderRadius: 0,
          padding: '6px 0',
          width: '100%',
          outline: 'none',
          resize: as === 'textarea' ? 'none' : undefined,
        }}
      />
    </div>
  );
}

/* ---------------------------------------------------------------
   UPDATE CARD (Used inside Category Updates Screen)
----------------------------------------------------------------*/
interface UpdateCardProps {
  u: AcademicUpdate;
  onOpen: (u: AcademicUpdate) => void;
  topicLabel: string;
}

function UpdateCard({ u, onOpen, topicLabel }: UpdateCardProps) {
  const isCompleted = u.status === 'completed';
  const isCancelled = u.status === 'cancelled';
  const isMuted = isCompleted || isCancelled;

  return (
    <button
      onClick={() => onOpen(u)}
      style={{
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        padding: '14px 16px',
        background: 'var(--c-card-bg)',
        border: `1px solid ${u.unread ? 'var(--c-danger)' : 'var(--c-hairline)'}`,
        borderRadius: 14,
        marginBottom: 10,
        display: 'block',
        opacity: isMuted ? 0.55 : 1,
        transition: 'border-color 180ms ease, opacity 180ms ease, background 180ms ease',
      }}
    >
      {/* Top Row: Title + Date/Time + Unread Indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 4,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {u.unread && (
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
              fontFamily: 'var(--font-head)',
              fontSize: 15,
              fontWeight: 700,
              color: isCompleted ? 'var(--c-text-soft)' : 'var(--c-text)',
              textDecoration: isCompleted ? 'line-through' : 'none',
            }}
          >
            {u.title}
          </span>
        </div>

        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11.5,
            color: 'var(--c-text-soft)',
            flexShrink: 0,
          }}
        >
          {u.date} {u.time ? `· ${u.time}` : ''}
        </span>
      </div>

      {/* Topic / Syllabus Sub-Box */}
      {u.topic && (
        <div
          style={{
            padding: '7px 10px',
            background: 'var(--c-card-subtle)',
            border: '1px solid var(--c-hairline)',
            borderRadius: 8,
            marginTop: 6,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              color: 'var(--c-text-faint)',
              marginBottom: 2,
            }}
          >
            {topicLabel}: {u.topic}
          </div>
        </div>
      )}

      {/* Status indicator (if completed/cancelled) */}
      {u.status !== 'pending' && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 10.5,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              color: isCompleted ? 'var(--c-success)' : isCancelled ? 'var(--c-danger)' : 'var(--c-text-faint)',
            }}
          >
            {u.status.replace('_', ' ')}
          </span>
        </div>
      )}
    </button>
  );
}

/* ---------------------------------------------------------------
   1. HOME SCREEN — LIST OF COURSES
----------------------------------------------------------------*/
interface HomeScreenProps {
  group: Group;
  courses: Course[];
  isCR: boolean;
  onSelectCourse: (course: Course) => void;
  onCompose: () => void;
  onManageCourses: () => void;
}

function HomeScreen({
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
            const unreadCount = course.unread_count || 0;
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
                  <UnreadBadge count={unreadCount} />
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

/* ---------------------------------------------------------------
   2. COURSE SCREEN — SHOW 4 FIXED CATEGORIES (Lab, Presentation, Assignment, Quiz)
----------------------------------------------------------------*/
interface CourseScreenProps {
  course: Course;
  isCR: boolean;
  onBack: () => void;
  onSelectCategory: (category: AcademicCategory) => void;
  onComposeForCourse: (course: Course) => void;
  onEditCourse: (course: Course) => void;
}

function CourseScreen({
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
                <UnreadBadge count={unreadCount} />
                <ChevronRight size={16} color="var(--c-text-faint)" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   3. CATEGORY SCREEN — LIST OF UPDATES
----------------------------------------------------------------*/
interface CategoryScreenProps {
  course: Course;
  categoryKey: AcademicCategory;
  isCR: boolean;
  onBack: () => void;
  onOpenUpdate: (u: AcademicUpdate) => void;
  onComposeForCategory: (course: Course, category: AcademicCategory) => void;
}

function CategoryScreen({
  course,
  categoryKey,
  isCR,
  onBack,
  onOpenUpdate,
  onComposeForCategory,
}: CategoryScreenProps) {
  const catMeta = CATEGORIES.find((c) => c.key === categoryKey) || CATEGORIES[0];
  const allUpdates = store.getAcademicUpdates(course.id, categoryKey);

  const upcomingUpdates = allUpdates.filter((u) => u.status === 'pending');
  const pastUpdates = allUpdates.filter((u) => u.status !== 'pending');

  return (
    <div>
      {/* Category Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
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
          }}
        >
          <ChevronLeft size={20} strokeWidth={2} />
          <div>
            <span
              style={{
                fontFamily: 'var(--font-head)',
                fontSize: 19,
                fontWeight: 800,
                letterSpacing: '-0.02em',
              }}
            >
              {catMeta.label}
            </span>
          </div>
        </button>

        {isCR && (
          <button
            onClick={() => onComposeForCategory(course, categoryKey)}
            title={`New ${catMeta.label} update`}
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
        )}
      </div>

      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12.5,
          color: 'var(--c-text-faint)',
          marginBottom: 20,
        }}
      >
        {course.name}
      </div>

      {allUpdates.length === 0 ? (
        <div style={{ padding: '48px 16px', textAlign: 'center' }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--c-text-faint)' }}>
            {catMeta.emptyLabel}
          </span>
        </div>
      ) : (
        <>
          {/* Upcoming Section */}
          {upcomingUpdates.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  color: 'var(--c-text-faint)',
                  marginBottom: 10,
                  paddingLeft: 2,
                }}
              >
                Upcoming ({upcomingUpdates.length})
              </div>
              {upcomingUpdates.map((u) => (
                <UpdateCard
                  key={u.id}
                  u={u}
                  onOpen={onOpenUpdate}
                  topicLabel={catMeta.topicLabel}
                />
              ))}
            </div>
          )}

          {/* Completed / Past Section */}
          {pastUpdates.length > 0 && (
            <div style={{ marginTop: upcomingUpdates.length > 0 ? 28 : 0 }}>
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  color: 'var(--c-text-faint)',
                  marginBottom: 10,
                  paddingLeft: 2,
                }}
              >
                Completed & Passed ({pastUpdates.length})
              </div>
              {pastUpdates.map((u) => (
                <UpdateCard
                  key={u.id}
                  u={u}
                  onOpen={onOpenUpdate}
                  topicLabel={catMeta.topicLabel}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   4. DETAIL SHEET (With Optional Resource Link, View Tracking & CR Edit/Delete)
----------------------------------------------------------------*/
interface DetailSheetProps {
  u: AcademicUpdate | null;
  isCR: boolean;
  onClose: () => void;
  onEdit: (u: AcademicUpdate) => void;
  onDelete: (id: string) => void;
}

function DetailSheet({ u, isCR, onClose, onEdit, onDelete }: DetailSheetProps) {
  const [tab, setTab] = useState<'viewed' | 'notviewed'>('viewed');
  if (!u) return null;

  const catMeta = CATEGORIES.find((c) => c.key === u.category || c.key === u.section);
  const topicLabel = catMeta?.topicLabel || 'Topic / Syllabus';

  const rosterStats = isCR ? store.getViewTrackingRoster(u.id) : null;
  const viewedList = rosterStats?.viewed || [];
  const notViewedList = rosterStats?.notViewed || [];
  const viewCount = rosterStats?.viewCount ?? (u.view_count || 0);
  const totalCount = rosterStats?.totalCount ?? (u.total_members || 1);
  const viewPercentage = Math.min(100, Math.round((viewCount / (totalCount || 1)) * 100));

  const resourceLabel = u.resource_url
    ? getResourceLinkLabel(u.resource_url, u.category || u.section)
    : 'Open Resource';

  return (
    <div style={{ padding: '0 20px 32px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11.5,
              fontWeight: 600,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              color: 'var(--c-accent)',
              marginBottom: 4,
            }}
          >
            {u.category ? u.category.toUpperCase() : u.section.toUpperCase()} · {u.course_name}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-head)',
              fontSize: 21,
              fontWeight: 800,
              color: 'var(--c-text)',
              lineHeight: 1.25,
            }}
          >
            {u.title}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            color: 'var(--c-text-faint)',
            padding: 4,
            flexShrink: 0,
            cursor: 'pointer',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Date & Time Info Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: 'var(--c-text-soft)',
          marginBottom: 16,
        }}
      >
        <Clock size={13} color="var(--c-text-faint)" />
        <span>{u.date}</span>
        {u.time && <span>· {u.time}</span>}
      </div>

      {/* Topic / Syllabus Block */}
      {u.topic && (
        <div
          style={{
            padding: '12px 14px',
            background: 'var(--c-card-subtle)',
            border: '1px solid var(--c-hairline-strong)',
            borderRadius: 12,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              color: 'var(--c-text-faint)',
              marginBottom: 4,
            }}
          >
            {topicLabel}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--c-text)',
            }}
          >
            {u.topic}
          </div>
        </div>
      )}

      {/* Additional Description */}
      {u.description && (
        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              color: 'var(--c-text-faint)',
              marginBottom: 6,
            }}
          >
            Additional Information
          </div>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--c-text-soft)',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}
          >
            {u.description}
          </div>
        </div>
      )}

      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: u.resource_url ? 16 : isCR ? 20 : 10 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-text-faint)' }}>Status:</span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'capitalize',
            color: u.status === 'completed' ? 'var(--c-success)' : u.status === 'cancelled' ? 'var(--c-danger)' : 'var(--c-accent)',
          }}
        >
          {u.status.replace('_', ' ')}
        </span>
      </div>

      {/* RESOURCE / LINK SECTION (Shown if URL exists) */}
      {u.resource_url && (
        <div style={{ marginBottom: isCR ? 20 : 10 }}>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              color: 'var(--c-text-faint)',
              marginBottom: 8,
            }}
          >
            Resource
          </div>
          <a
            href={u.resource_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--c-accent)',
              background: 'var(--c-card-bg)',
              border: '1px solid var(--c-hairline-strong)',
              padding: '10px 16px',
              borderRadius: 12,
              textDecoration: 'none',
              transition: 'all 160ms ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}
          >
            <span>{resourceLabel}</span>
            <ExternalLink size={14} />
          </a>
        </div>
      )}

      {/* CR CONTROLS & VIEW TRACKING */}
      {isCR && (
        <div style={{ borderTop: '1px solid var(--c-hairline)', paddingTop: 18 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--c-text-soft)' }}>Seen by</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--c-text)' }}>
              {viewCount} / {totalCount}
            </span>
          </div>

          <div
            style={{
              height: 2,
              borderRadius: 999,
              background: 'var(--c-hairline)',
              marginBottom: 14,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${viewPercentage}%`,
                background: 'var(--c-accent)',
                transition: 'width 400ms ease',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
            <button
              onClick={() => setTab('viewed')}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12.5,
                fontWeight: tab === 'viewed' ? 700 : 500,
                color: tab === 'viewed' ? 'var(--c-text)' : 'var(--c-text-faint)',
                padding: '2px 0',
                cursor: 'pointer',
              }}
            >
              Viewed ({viewedList.length})
            </button>
            <button
              onClick={() => setTab('notviewed')}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12.5,
                fontWeight: tab === 'notviewed' ? 700 : 500,
                color: tab === 'notviewed' ? 'var(--c-text)' : 'var(--c-text-faint)',
                padding: '2px 0',
                cursor: 'pointer',
              }}
            >
              Not viewed ({notViewedList.length})
            </button>
          </div>

          <div style={{ maxHeight: 130, overflowY: 'auto', marginBottom: 18 }}>
            {(tab === 'viewed' ? viewedList : notViewedList).length === 0 ? (
              <div style={{ padding: '6px 0', color: 'var(--c-text-faint)', fontSize: 12, fontFamily: 'var(--font-body)' }}>
                {tab === 'viewed' ? 'No views recorded yet.' : 'All students have viewed.'}
              </div>
            ) : (
              (tab === 'viewed' ? viewedList : notViewedList).map((id, i) => (
                <div key={id + i} style={{ padding: '4px 0' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--c-text-soft)' }}>{id}</span>
                </div>
              ))
            )}
          </div>

          <div
            style={{
              display: 'flex',
              gap: 12,
              paddingTop: 12,
              borderTop: '1px solid var(--c-hairline)',
            }}
          >
            <button
              onClick={() => onEdit(u)}
              style={{
                flex: 1,
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--c-accent)',
                background: 'var(--c-accent-bg)',
                padding: '9px 0',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer',
              }}
            >
              <Edit3 size={14} />
              <span>Edit update</span>
            </button>

            <button
              onClick={() => onDelete(u.id)}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--c-danger)',
                background: 'var(--c-danger-bg)',
                padding: '9px 14px',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                cursor: 'pointer',
              }}
            >
              <Trash2 size={14} />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   5. COMPOSE & EDIT UPDATE SHEET (With Optional Resource URL)
----------------------------------------------------------------*/
interface ComposeSheetProps {
  courses: Course[];
  initialUpdate?: AcademicUpdate | null;
  defaultCourseId?: string;
  defaultCategory?: AcademicCategory;
  onClose: () => void;
  onSave: (data: {
    id?: string;
    course_id: string;
    category: AcademicCategory;
    title: string;
    date: string;
    time: string;
    topic: string;
    description: string;
    resource_url?: string;
    status: UpdateStatus;
  }) => void;
}

function ComposeSheet({
  courses,
  initialUpdate,
  defaultCourseId,
  defaultCategory = 'quiz',
  onClose,
  onSave,
}: ComposeSheetProps) {
  const isEditing = Boolean(initialUpdate);
  const [courseId, setCourseId] = useState<string>(
    initialUpdate?.course_id || defaultCourseId || (courses[0]?.id || '')
  );
  const [category, setCategory] = useState<AcademicCategory>(
    initialUpdate?.category || initialUpdate?.section || defaultCategory
  );
  const [title, setTitle] = useState(initialUpdate?.title || '');
  const [date, setDate] = useState(initialUpdate?.date || '');
  const [time, setTime] = useState(initialUpdate?.time || '');
  const [topic, setTopic] = useState(initialUpdate?.topic || '');
  const [description, setDescription] = useState(initialUpdate?.description || '');
  const [resourceUrl, setResourceUrl] = useState(initialUpdate?.resource_url || '');
  const [urlError, setUrlError] = useState('');
  const [status, setStatus] = useState<UpdateStatus>(initialUpdate?.status || 'pending');

  const canSave = title.trim() && courseId && date.trim();
  const activeTopicLabel =
    CATEGORIES.find((s) => s.key === category)?.topicLabel || 'Topic / Syllabus';

  const handleFormSubmit = () => {
    const trimmedUrl = resourceUrl.trim();
    if (trimmedUrl && !isValidUrl(trimmedUrl)) {
      setUrlError('Please enter a valid URL starting with http:// or https://');
      return;
    }

    onSave({
      id: initialUpdate?.id,
      course_id: courseId,
      category,
      title: title.trim(),
      date: date.trim(),
      time: time.trim() || 'TBA',
      topic: topic.trim(),
      description: description.trim(),
      resource_url: trimmedUrl || undefined,
      status,
    });
  };

  return (
    <div style={{ padding: '0 20px 32px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 18,
        }}
      >
        <span style={{ fontFamily: 'var(--font-head)', fontSize: 16, fontWeight: 700, color: 'var(--c-text)' }}>
          {isEditing ? 'Edit update' : 'New academic update'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            disabled={!canSave}
            onClick={handleFormSubmit}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14.5,
              fontWeight: 700,
              color: canSave ? 'var(--c-accent)' : 'var(--c-text-faint)',
              cursor: canSave ? 'pointer' : 'default',
            }}
          >
            {isEditing ? 'Save' : 'Post'}
          </button>
          <button onClick={onClose} style={{ color: 'var(--c-text-faint)', padding: 2 }}>
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Course Selector */}
      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            display: 'block',
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.4,
            color: 'var(--c-text-faint)',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Course
        </label>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          style={{
            width: '100%',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            color: 'var(--c-text)',
            background: 'var(--c-card-bg)',
            border: '1px solid var(--c-hairline-strong)',
            borderRadius: 10,
            padding: '10px 12px',
            outline: 'none',
          }}
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Category Selector */}
      <div style={{ marginBottom: 18 }}>
        <label
          style={{
            display: 'block',
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.4,
            color: 'var(--c-text-faint)',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Update Type / Category
        </label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {CATEGORIES.map((s) => (
            <button
              key={s.key}
              onClick={() => setCategory(s.key)}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12.5,
                fontWeight: category === s.key ? 700 : 500,
                color: category === s.key ? 'var(--c-text)' : 'var(--c-text-faint)',
                padding: '6px 12px',
                borderRadius: 8,
                background: category === s.key ? 'var(--c-card-bg-active)' : 'transparent',
                border: `1px solid ${category === s.key ? 'var(--c-hairline-strong)' : 'transparent'}`,
                cursor: 'pointer',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <Field
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Quiz 1, Lab Test 1, Assignment 2"
      />

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field
            label="Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            placeholder="e.g. 15 Aug"
          />
        </div>
        <div style={{ flex: 1 }}>
          <Field
            label="Time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="e.g. 7:00 AM / 11:59 PM"
          />
        </div>
      </div>

      <Field
        label={activeTopicLabel}
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="e.g. Array, Polymorphism, ERD + SQL"
      />

      <Field
        as="textarea"
        label="Additional Instructions / Description"
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Room number, materials to bring, or submission guidelines..."
      />

      {/* Optional Resource / Link Field */}
      <div>
        <Field
          label="Resource / Link (optional)"
          value={resourceUrl}
          onChange={(e) => {
            setResourceUrl(e.target.value);
            if (urlError) setUrlError('');
          }}
          placeholder="e.g. https://drive.google.com/file/... or GitHub link"
        />
        {urlError && (
          <div style={{ color: 'var(--c-danger)', fontSize: 12, fontFamily: 'var(--font-body)', marginTop: -10, marginBottom: 14 }}>
            {urlError}
          </div>
        )}
      </div>

      {/* Status Picker */}
      <div style={{ marginBottom: 12 }}>
        <label
          style={{
            display: 'block',
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.4,
            color: 'var(--c-text-faint)',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Status
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STATUS_OPTIONS.map((st) => (
            <button
              key={st.key}
              onClick={() => setStatus(st.key)}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                fontWeight: status === st.key ? 600 : 400,
                color: status === st.key ? 'var(--c-text)' : 'var(--c-text-faint)',
                padding: '4px 8px',
                borderRadius: 6,
                background: status === st.key ? 'var(--c-card-bg-active)' : 'transparent',
                border: `1px solid ${status === st.key ? 'var(--c-hairline-strong)' : 'transparent'}`,
                cursor: 'pointer',
              }}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   6. COURSE MANAGEMENT SHEET (CR Only)
----------------------------------------------------------------*/
interface CourseManageSheetProps {
  courses: Course[];
  editingCourse?: Course | null;
  onClose: () => void;
  onCreateCourse: (name: string) => void;
  onUpdateCourse: (courseId: string, name: string) => void;
  onDeleteCourse: (courseId: string) => void;
}

function CourseManageSheet({
  courses,
  editingCourse,
  onClose,
  onCreateCourse,
  onUpdateCourse,
  onDeleteCourse,
}: CourseManageSheetProps) {
  const [courseName, setCourseName] = useState(editingCourse?.name || '');
  const isEditing = Boolean(editingCourse);

  return (
    <div style={{ padding: '0 20px 32px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <span style={{ fontFamily: 'var(--font-head)', fontSize: 16, fontWeight: 700, color: 'var(--c-text)' }}>
          {isEditing ? 'Edit course' : 'Manage courses'}
        </span>
        <button onClick={onClose} style={{ color: 'var(--c-text-faint)', padding: 2 }}>
          <X size={16} />
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!courseName.trim()) return;
          if (isEditing && editingCourse) {
            onUpdateCourse(editingCourse.id, courseName.trim());
          } else {
            onCreateCourse(courseName.trim());
            setCourseName('');
          }
        }}
        style={{ marginBottom: 24 }}
      >
        <Field
          label={isEditing ? 'Course Name' : 'Add New Course'}
          value={courseName}
          onChange={(e) => setCourseName(e.target.value)}
          placeholder="e.g. Object Oriented Programming"
          autoFocus
        />

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="submit"
            disabled={!courseName.trim()}
            style={{
              flex: 1,
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 600,
              color: '#FFFFFF',
              background: 'var(--c-accent)',
              padding: '10px 0',
              borderRadius: 10,
              cursor: courseName.trim() ? 'pointer' : 'default',
            }}
          >
            {isEditing ? 'Update course name' : 'Add course'}
          </button>
          {isEditing && (
            <button
              type="button"
              onClick={() => editingCourse && onDeleteCourse(editingCourse.id)}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--c-danger)',
                background: 'var(--c-danger-bg)',
                padding: '10px 14px',
                borderRadius: 10,
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
          )}
        </div>
      </form>

      {!isEditing && (
        <div>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              color: 'var(--c-text-faint)',
              marginBottom: 10,
            }}
          >
            Current Courses ({courses.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {courses.map((c) => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'var(--c-card-bg)',
                  border: '1px solid var(--c-hairline)',
                  borderRadius: 10,
                }}
              >
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--c-text)' }}>
                  {c.name}
                </span>
                <button
                  onClick={() => onDeleteCourse(c.id)}
                  style={{ color: 'var(--c-danger)', padding: 4 }}
                  title="Delete course"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   JOIN & CREATE CLASS SHEETS
----------------------------------------------------------------*/
interface JoinSheetProps {
  onClose: () => void;
  onJoin: (code: string) => void;
}

function JoinSheet({ onClose, onJoin }: JoinSheetProps) {
  const [code, setCode] = useState('');
  const canJoin = code.trim().length >= 4;

  return (
    <div style={{ padding: '0 20px 32px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <span style={{ fontFamily: 'var(--font-head)', fontSize: 16, fontWeight: 700, color: 'var(--c-text)' }}>
          Join class
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            disabled={!canJoin}
            onClick={() => onJoin(code.trim())}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14.5,
              fontWeight: 700,
              color: canJoin ? 'var(--c-accent)' : 'var(--c-text-faint)',
              cursor: canJoin ? 'pointer' : 'default',
            }}
          >
            Join
          </button>
          <button onClick={onClose} style={{ color: 'var(--c-text-faint)', padding: 2 }}>
            <X size={16} />
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label
          style={{
            display: 'block',
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.4,
            color: 'var(--c-text-faint)',
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          6-Character Group Code
        </label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. K7X4P9"
          maxLength={10}
          autoFocus
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: '0.1em',
            color: 'var(--c-text)',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--c-hairline)',
            padding: '8px 0',
            width: '100%',
            outline: 'none',
            textTransform: 'uppercase',
          }}
        />
      </div>

      <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--c-text-faint)', lineHeight: 1.5 }}>
        Ask your Class Representative for their unique 6-character class code.
      </div>
    </div>
  );
}

interface CreateClassSheetProps {
  onClose: () => void;
  onCreate: (name: string, mode: ApprovalMode) => void;
}

function CreateClassSheet({ onClose, onCreate }: CreateClassSheetProps) {
  const [name, setName] = useState('');
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>('auto');
  const canCreate = name.trim().length > 2;

  return (
    <div style={{ padding: '0 20px 32px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <span style={{ fontFamily: 'var(--font-head)', fontSize: 16, fontWeight: 700, color: 'var(--c-text)' }}>
          Create class
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            disabled={!canCreate}
            onClick={() => onCreate(name.trim(), approvalMode)}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14.5,
              fontWeight: 700,
              color: canCreate ? 'var(--c-accent)' : 'var(--c-text-faint)',
              cursor: canCreate ? 'pointer' : 'default',
            }}
          >
            Create
          </button>
          <button onClick={onClose} style={{ color: 'var(--c-text-faint)', padding: 2 }}>
            <X size={16} />
          </button>
        </div>
      </div>

      <Field
        label="Class Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Software Engineering — Section I"
      />

      <div style={{ marginBottom: 18 }}>
        <label
          style={{
            display: 'block',
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.4,
            color: 'var(--c-text-faint)',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Student Approval Mode
        </label>
        <div style={{ display: 'flex', gap: 14 }}>
          <button
            onClick={() => setApprovalMode('auto')}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: approvalMode === 'auto' ? 700 : 500,
              color: approvalMode === 'auto' ? 'var(--c-text)' : 'var(--c-text-faint)',
              cursor: 'pointer',
            }}
          >
            Automatic approval
          </button>
          <button
            onClick={() => setApprovalMode('manual')}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: approvalMode === 'manual' ? 700 : 500,
              color: approvalMode === 'manual' ? 'var(--c-text)' : 'var(--c-text-faint)',
              cursor: 'pointer',
            }}
          >
            Manual approval
          </button>
        </div>
      </div>

      <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--c-text-faint)', lineHeight: 1.5, marginTop: 14 }}>
        A 6-character code will be generated automatically. Every class exists for exactly 4 months.
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   PROFILE SCREEN (With Appearance & Push Notifications)
----------------------------------------------------------------*/
interface InfoRowProps {
  label: string;
  value: string | number;
  last?: boolean;
}

function InfoRow({ label, value, last }: InfoRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderBottom: last ? 'none' : '1px solid var(--c-hairline)',
      }}
    >
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-text-faint)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--c-text-soft)' }}>{value}</span>
    </div>
  );
}

interface ProfileScreenProps {
  user: User;
  group: Group | null;
  isCR: boolean;
  themePreference: ThemePreference;
  notificationPermission: NotificationPermission | 'unsupported';
  hasFcmToken: boolean;
  onThemeChange: (pref: ThemePreference) => void;
  onEnableNotifications: () => void;
  onCopyCode: () => void;
  onLeave: () => void;
  onDeleteGroup?: () => void;
  onLogout: () => void;
  onToggleApprovalMode?: (mode: ApprovalMode) => void;
  onJoinClick: () => void;
  onCreateClassClick: () => void;
}

function ProfileScreen({
  user,
  group,
  isCR,
  themePreference,
  notificationPermission,
  hasFcmToken,
  onThemeChange,
  onEnableNotifications,
  onCopyCode,
  onLeave,
  onDeleteGroup,
  onLogout,
  onToggleApprovalMode,
  onJoinClick,
  onCreateClassClick,
}: ProfileScreenProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);

  const pendingRequests = isCR && group ? store.getPendingRequestsForHost(user.id) : [];

  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 25, fontWeight: 500, color: 'var(--c-text)' }}>
        {user.username}
      </div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--c-text-soft)', marginTop: 3 }}>
        {user.email}
      </div>
      {isCR && (
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--c-accent)', marginTop: 5 }}>
          Class Representative
        </div>
      )}

      {/* Class Section */}
      <div style={{ marginTop: 34 }}>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            color: 'var(--c-text-faint)',
            marginBottom: 8,
          }}
        >
          Current class
        </div>

        {group ? (
          <>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 16.5, fontWeight: 700, color: 'var(--c-text)' }}>
              {group.name}
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-text-soft)', marginTop: 4 }}>
              <span
                onClick={onCopyCode}
                title="Click to copy code"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text)', cursor: 'pointer' }}
              >
                {group.code}
              </span>{' '}
              · Expires {formatFriendlyDate(group.expires_at)}
            </div>

            {/* CR Accordion */}
            {isCR && (
              <>
                <button
                  onClick={() => setDetailsOpen((v) => !v)}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 12.5,
                    color: 'var(--c-text-faint)',
                    marginTop: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    cursor: 'pointer',
                  }}
                >
                  <span>Class details</span>
                  <ChevronDown
                    size={13}
                    style={{
                      transform: detailsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 200ms ease',
                    }}
                  />
                </button>

                <div
                  style={{
                    maxHeight: detailsOpen ? 240 : 0,
                    opacity: detailsOpen ? 1 : 0,
                    overflow: 'hidden',
                    transition: 'max-height 240ms ease, opacity 180ms ease',
                  }}
                >
                  <div style={{ paddingTop: 6 }}>
                    <InfoRow label="Members" value={group.member_count || 1} />
                    <InfoRow label="Class started" value={formatFriendlyDate(group.created_at)} />
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-text-faint)' }}>
                        Approval mode
                      </span>
                      <button
                        onClick={() =>
                          onToggleApprovalMode?.(group.approval_mode === 'auto' ? 'manual' : 'auto')
                        }
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 13,
                          color: 'var(--c-accent)',
                          textTransform: 'capitalize',
                          cursor: 'pointer',
                        }}
                      >
                        {group.approval_mode} (Tap to change)
                      </button>
                    </div>

                    {/* Quick Delete Option inside Class Management */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderTop: '1px solid var(--c-hairline)',
                        marginTop: 4,
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-danger)' }}>
                        Delete Class
                      </span>
                      <button
                        onClick={onDeleteGroup}
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: 'var(--c-danger)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <Trash2 size={13} color="var(--c-danger)" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Pending requests if manual approval */}
                {pendingRequests.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <button
                      onClick={() => setPendingOpen((v) => !v)}
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 12.5,
                        color: 'var(--c-accent)',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        cursor: 'pointer',
                      }}
                    >
                      <span>Pending requests ({pendingRequests.length})</span>
                      <ChevronDown
                        size={13}
                        style={{
                          transform: pendingOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 200ms ease',
                        }}
                      />
                    </button>

                    {pendingOpen && (
                      <div style={{ marginTop: 8, padding: '8px 0' }}>
                        {pendingRequests.map((req) => (
                          <div
                            key={req.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 0',
                              borderBottom: '1px solid var(--c-hairline)',
                            }}
                          >
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--c-text)' }}>
                              {req.username}
                            </span>
                            <div style={{ display: 'flex', gap: 10 }}>
                              <button
                                onClick={() => store.respondToJoinRequest(req.id, true)}
                                style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--c-accent)' }}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => store.respondToJoinRequest(req.id, false)}
                                style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-danger)' }}
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--c-text-soft)', marginBottom: 12 }}>
              You are not enrolled in any class.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={onJoinClick}
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--c-accent)',
                  cursor: 'pointer',
                }}
              >
                Join with code
              </button>
              <span style={{ color: 'var(--c-text-faint)' }}>·</span>
              <button
                onClick={onCreateClassClick}
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12.5,
                  color: 'var(--c-text-soft)',
                  cursor: 'pointer',
                }}
              >
                Create class
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Appearance / Theme Switcher */}
      <div style={{ marginTop: 32 }}>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            color: 'var(--c-text-faint)',
            marginBottom: 10,
          }}
        >
          Appearance
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { key: 'system' as const, label: 'System', icon: Laptop },
            { key: 'light' as const, label: 'Light', icon: Sun },
            { key: 'dark' as const, label: 'Dark', icon: Moon },
          ].map((item) => {
            const isSelected = themePreference === item.key;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => onThemeChange(item.key)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '9px 0',
                  borderRadius: 10,
                  fontFamily: 'var(--font-body)',
                  fontSize: 12.5,
                  fontWeight: isSelected ? 600 : 400,
                  background: isSelected ? 'var(--c-card-bg-active)' : 'var(--c-card-bg)',
                  border: `1px solid ${isSelected ? 'var(--c-accent)' : 'var(--c-hairline)'}`,
                  color: isSelected ? 'var(--c-accent)' : 'var(--c-text-soft)',
                  cursor: 'pointer',
                  transition: 'all 160ms ease',
                }}
              >
                <Icon size={14} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Push Notifications Section */}
      <div style={{ marginTop: 32 }}>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            color: 'var(--c-text-faint)',
            marginBottom: 10,
          }}
        >
          Push Notifications
        </div>
        <button
          onClick={onEnableNotifications}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            borderRadius: 12,
            background: 'var(--c-card-bg)',
            border: `1px solid ${notificationPermission === 'granted' ? 'var(--c-hairline-strong)' : 'var(--c-hairline)'}`,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bell size={16} color={notificationPermission === 'granted' ? 'var(--c-accent)' : 'var(--c-text-faint)'} />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-text)' }}>
              {notificationPermission === 'granted'
                ? hasFcmToken
                  ? 'FCM push notifications active'
                  : 'Browser notifications allowed'
                : 'Enable push notifications'}
            </span>
          </div>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              fontWeight: 600,
              color: notificationPermission === 'granted' ? 'var(--c-success)' : 'var(--c-accent)',
            }}
          >
            {notificationPermission === 'granted' ? 'Active' : 'Enable'}
          </span>
        </button>
      </div>

      {/* Danger Zone Actions */}
      <div style={{ marginTop: 40, paddingTop: 18, borderTop: '1px solid var(--c-hairline)' }}>
        {group && (
          <button
            onClick={onLeave}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--c-danger)',
              padding: '8px 0',
              display: 'block',
              width: '100%',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            Leave class
          </button>
        )}
        {group && isCR && (
          <button
            onClick={onDeleteGroup}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--c-danger)',
              padding: '8px 0',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <Trash2 size={15} color="var(--c-danger)" />
            <span>Delete Group</span>
          </button>
        )}
        <button
          onClick={onLogout}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--c-danger)',
            padding: '8px 0',
            display: 'block',
            width: '100%',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          Log out
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   CONFIRMATION ACTION SHEET
----------------------------------------------------------------*/
interface ConfirmSheetProps {
  title?: string;
  description: string;
  confirmLabel: string;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmSheet({ title, description, confirmLabel, disabled, onCancel, onConfirm }: ConfirmSheetProps) {
  return (
    <div style={{ paddingBottom: 8 }}>
      {title && (
        <div
          style={{
            fontFamily: 'var(--font-head)',
            fontSize: 17,
            fontWeight: 700,
            color: 'var(--c-text)',
            textAlign: 'center',
            padding: '8px 20px 4px',
          }}
        >
          {title}
        </div>
      )}
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          color: 'var(--c-text-faint)',
          textAlign: 'center',
          lineHeight: 1.5,
          padding: '4px 28px 18px',
        }}
      >
        {description}
      </div>
      <button
        onClick={onConfirm}
        disabled={disabled}
        style={{
          width: '100%',
          cursor: disabled ? 'default' : 'pointer',
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--c-danger)',
          padding: '15px 0',
          borderTop: '1px solid var(--c-hairline)',
          textAlign: 'center',
          display: 'block',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {confirmLabel}
      </button>
      <button
        onClick={onCancel}
        disabled={disabled}
        style={{
          width: '100%',
          cursor: disabled ? 'default' : 'pointer',
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          color: 'var(--c-text-soft)',
          padding: '15px 0',
          borderTop: '1px solid var(--c-hairline)',
          textAlign: 'center',
          display: 'block',
        }}
      >
        Cancel
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------
   BOTTOM NAVIGATION BAR
----------------------------------------------------------------*/
interface BottomNavProps {
  screen: 'home' | 'profile';
  setScreen: (screen: 'home' | 'profile') => void;
  unreadCount: number;
}

function BottomNav({ screen, setScreen, unreadCount }: BottomNavProps) {
  const items = [
    { key: 'home' as const, label: 'Home', icon: HomeIcon, badge: unreadCount > 0 },
    { key: 'profile' as const, label: 'Profile', icon: UserIcon, badge: false },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        borderTop: '1px solid var(--c-hairline)',
        background: 'var(--c-sheet-bg)',
        zIndex: 40,
        transition: 'background 220ms ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          margin: '0 auto',
          maxWidth: 480,
          height: NAV_H,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {items.map((it) => {
          const active = screen === it.key;
          const Icon = it.icon;
          return (
            <button
              key={it.key}
              onClick={() => setScreen(it.key)}
              style={{
                flex: 1,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                position: 'relative',
              }}
            >
              <Icon
                size={20}
                color={active ? 'var(--c-accent)' : 'var(--c-text-faint)'}
                strokeWidth={1.8}
              />
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 10.5,
                  fontWeight: 500,
                  color: active ? 'var(--c-accent)' : 'var(--c-text-faint)',
                }}
              >
                {it.label}
              </span>
              {it.badge && (
                <span
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 'calc(50% - 18px)',
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: 'var(--c-danger)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   MAIN APPLICATION ROOT
----------------------------------------------------------------*/
export function App() {
  const [authReady, setAuthReady] = useState<boolean>(store.isAuthReady());
  const [currentUser, setCurrentUser] = useState<User | null>(store.getCurrentUser());
  const [currentGroup, setCurrentGroup] = useState<Group | null>(store.getCurrentUserGroup());
  const [courses, setCourses] = useState<Course[]>(store.getCourses());
  const [, setUpdates] = useState<AcademicUpdate[]>(store.getAcademicUpdates());
  const [themePref, setThemePref] = useState<ThemePreference>(getThemePreference());
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );
  const [hasFcmToken, setHasFcmToken] = useState<boolean>(Boolean(store.getUserFcmToken()));

  const [screen, setScreen] = useState<'home' | 'profile'>('home');

  // Navigation Hierarchy State
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<AcademicCategory | null>(null);

  // Sheets
  const [selectedUpdate, setSelectedUpdate] = useState<AcademicUpdate | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<AcademicUpdate | null>(null);
  const [composeDefaultCourseId, setComposeDefaultCourseId] = useState<string | undefined>(undefined);
  const [composeDefaultCategory, setComposeDefaultCategory] = useState<AcademicCategory>('quiz');

  const [manageCoursesOpen, setManageCoursesOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const [joinOpen, setJoinOpen] = useState(false);
  const [createClassOpen, setCreateClassOpen] = useState(false);
  const [confirm, setConfirm] = useState<'leave' | 'logout' | 'deleteGroup' | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = (msg: string) => {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    const unsubStore = store.subscribe(() => {
      setAuthReady(store.isAuthReady());
      setCurrentUser(store.getCurrentUser());
      setCurrentGroup(store.getCurrentUserGroup());
      setCourses(store.getCourses());
      setUpdates(store.getAcademicUpdates());
      setHasFcmToken(Boolean(store.getUserFcmToken()));
    });
    const unsubTheme = subscribeTheme((t) => setThemePref(t));
    const unsubFCM = initForegroundNotificationListener((title, body) => {
      showToast(`${title}: ${body}`);
    });

    return () => {
      unsubStore();
      unsubTheme();
      unsubFCM();
    };
  }, []);

  const isCR = currentUser ? currentUser.role === 'cr' || currentUser.id === currentGroup?.host_id : false;
  const totalUnreadCount = store.getTotalUnreadCount();

  const activeCourse = courses.find((c) => c.id === activeCourseId);

  // Open update details & automatically record view for student
  const handleOpenUpdate = (u: AcademicUpdate) => {
    setSelectedUpdate(u);
    store.recordView(u.id);
  };

  const handleEnableNotifications = async () => {
    const res = await requestNotificationPermission();
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    }
    if (res.granted) {
      if (res.token) {
        setHasFcmToken(true);
        showToast('Push notifications enabled & active');
      } else if (res.needsVapidKey) {
        showToast('Notifications allowed (VAPID key needed for FCM token)');
      } else {
        showToast('Browser notifications enabled');
      }
    } else if (res.error) {
      showToast(res.error);
    }
  };

  const handleSaveUpdate = (data: {
    id?: string;
    course_id: string;
    category: AcademicCategory;
    title: string;
    date: string;
    time: string;
    topic: string;
    description: string;
    resource_url?: string;
    status: UpdateStatus;
  }) => {
    if (data.id) {
      const res = store.updateAcademicUpdate(data.id, data);
      if (res.error) {
        showToast(res.error);
      } else {
        setComposeOpen(false);
        setEditingUpdate(null);
        if (selectedUpdate && selectedUpdate.id === data.id && res.update) {
          setSelectedUpdate(res.update);
        }
        showToast('Update saved');
      }
    } else {
      const res = store.createAcademicUpdate(data);
      if (res.error) {
        showToast(res.error);
      } else {
        setComposeOpen(false);
        showToast(`Posted ${data.category.toUpperCase()} update`);
      }
    }
  };

  const handleDeleteUpdate = (id: string) => {
    store.deleteAcademicUpdate(id);
    setSelectedUpdate(null);
    showToast('Update deleted');
  };

  const handleCreateCourse = (name: string) => {
    const res = store.createCourse(name);
    if (res.error) {
      showToast(res.error);
    } else {
      showToast(`Course "${name}" created`);
    }
  };

  const handleUpdateCourse = (courseId: string, name: string) => {
    const res = store.updateCourse(courseId, name);
    if (res.error) {
      showToast(res.error);
    } else {
      setManageCoursesOpen(false);
      setEditingCourse(null);
      showToast('Course name updated');
    }
  };

  const handleDeleteCourse = (courseId: string) => {
    store.deleteCourse(courseId);
    setManageCoursesOpen(false);
    setEditingCourse(null);
    if (activeCourseId === courseId) {
      setActiveCourseId(null);
      setActiveCategory(null);
    }
    showToast('Course deleted');
  };

  const handleJoinClass = (code: string) => {
    const res = store.joinGroupByCode(code);
    if (res.error) {
      showToast(res.error);
    } else if (res.status === 'joined') {
      setJoinOpen(false);
      showToast(`Joined ${res.group?.name}`);
    } else {
      setJoinOpen(false);
      showToast('Request submitted for CR approval');
    }
  };

  const handleCreateClass = (name: string, mode: ApprovalMode) => {
    const res = store.createGroup(name, mode);
    if (res.error) {
      showToast(res.error);
    } else {
      setCreateClassOpen(false);
      showToast(`Class created (${res.group?.code})`);
    }
  };

  const handleCopyCode = () => {
    if (currentGroup?.code) {
      try {
        navigator.clipboard.writeText(currentGroup.code);
      } catch {}
      showToast('Code copied');
    }
  };

  const handleLeaveClass = () => {
    store.leaveCurrentGroup();
    setActiveCourseId(null);
    setActiveCategory(null);
    setConfirm(null);
    showToast('Left class');
  };

  const handleDeleteGroup = async () => {
    if (!currentGroup || isDeletingGroup) return;
    setIsDeletingGroup(true);
    const res = await store.deleteGroup(currentGroup.id);
    setIsDeletingGroup(false);
    if (res.success) {
      setConfirm(null);
      setActiveCourseId(null);
      setActiveCategory(null);
      setScreen('home');
      showToast('Group deleted successfully.');
    } else {
      showToast(res.error || 'Failed to delete group.');
    }
  };

  const handleLogout = () => {
    store.signOut();
    setActiveCourseId(null);
    setActiveCategory(null);
    setConfirm(null);
    showToast('Signed out');
  };

  if (!authReady) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--c-bg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: '2.5px solid var(--c-hairline-strong)',
            borderTopColor: 'var(--c-accent)',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--c-text-soft)',
          }}
        >
          Connecting to Class Announcement Hub...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthModal
        onSuccess={() => {
          setCurrentUser(store.getCurrentUser());
          setCurrentGroup(store.getCurrentUserGroup());
        }}
        showToast={showToast}
      />
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--c-bg)', transition: 'background 220ms ease' }}>
      {toast && <Toast message={toast} />}

      {/* Main Viewport */}
      <div
        style={{
          maxWidth: 480,
          margin: '0 auto',
          padding: '0 20px',
          paddingTop: 'max(28px, env(safe-area-inset-top))',
          paddingBottom: NAV_H + 28,
        }}
      >
        {screen === 'home' ? (
          !currentGroup ? (
            /* No Group Screen */
            <div style={{ paddingTop: 40, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 700, color: 'var(--c-text)', marginBottom: 8 }}>
                Join your class
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-text-soft)', maxWidth: 300, margin: '0 auto 28px', lineHeight: 1.5 }}>
                Enter the 6-character group code provided by your Class Representative.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 260, margin: '0 auto' }}>
                <button
                  onClick={() => setJoinOpen(true)}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#FFFFFF',
                    background: 'var(--c-accent)',
                    padding: '11px 18px',
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <span>Enter class code</span>
                  <ArrowRight size={15} />
                </button>

                <button
                  onClick={() => setCreateClassOpen(true)}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    color: 'var(--c-text-soft)',
                    padding: '10px 18px',
                    borderRadius: 12,
                    border: '1px solid var(--c-hairline)',
                    background: 'var(--c-card-bg)',
                  }}
                >
                  Are you a CR? Create a class
                </button>
              </div>
            </div>
          ) : activeCourseId === null ? (
            /* 1. HOME: Show Courses with Unread Badges */
            <HomeScreen
              group={currentGroup}
              courses={courses}
              isCR={isCR}
              onSelectCourse={(c) => setActiveCourseId(c.id)}
              onCompose={() => {
                setEditingUpdate(null);
                setComposeDefaultCourseId(courses[0]?.id);
                setComposeDefaultCategory('quiz');
                setComposeOpen(true);
              }}
              onManageCourses={() => {
                setEditingCourse(null);
                setManageCoursesOpen(true);
              }}
            />
          ) : activeCategory === null && activeCourse ? (
            /* 2. COURSE SCREEN: Show 4 Fixed Categories */
            <CourseScreen
              course={activeCourse}
              isCR={isCR}
              onBack={() => setActiveCourseId(null)}
              onSelectCategory={(cat) => setActiveCategory(cat)}
              onComposeForCourse={(c) => {
                setEditingUpdate(null);
                setComposeDefaultCourseId(c.id);
                setComposeDefaultCategory('quiz');
                setComposeOpen(true);
              }}
              onEditCourse={(c) => {
                setEditingCourse(c);
                setManageCoursesOpen(true);
              }}
            />
          ) : activeCourse && activeCategory ? (
            /* 3. CATEGORY SCREEN: List Updates for that Category */
            <CategoryScreen
              course={activeCourse}
              categoryKey={activeCategory}
              isCR={isCR}
              onBack={() => setActiveCategory(null)}
              onOpenUpdate={handleOpenUpdate}
              onComposeForCategory={(c, cat) => {
                setEditingUpdate(null);
                setComposeDefaultCourseId(c.id);
                setComposeDefaultCategory(cat);
                setComposeOpen(true);
              }}
            />
          ) : null
        ) : (
          /* Profile Screen */
          <ProfileScreen
            user={currentUser}
            group={currentGroup}
            isCR={isCR}
            themePreference={themePref}
            notificationPermission={notifPermission}
            hasFcmToken={hasFcmToken}
            onThemeChange={(p) => setThemePreference(p)}
            onEnableNotifications={handleEnableNotifications}
            onCopyCode={handleCopyCode}
            onLeave={() => setConfirm('leave')}
            onDeleteGroup={() => setConfirm('deleteGroup')}
            onLogout={() => setConfirm('logout')}
            onToggleApprovalMode={(mode) => {
              if (currentGroup) {
                store.updateApprovalMode(currentGroup.id, mode);
                showToast(`Approval mode set to ${mode}`);
              }
            }}
            onJoinClick={() => setJoinOpen(true)}
            onCreateClassClick={() => setCreateClassOpen(true)}
          />
        )}
      </div>

      {/* Fixed Bottom Navigation */}
      <BottomNav
        screen={screen}
        setScreen={(s) => {
          setScreen(s);
        }}
        unreadCount={totalUnreadCount}
      />

      {/* Update Detail Sheet */}
      <Sheet open={!!selectedUpdate} onClose={() => setSelectedUpdate(null)}>
        <DetailSheet
          u={selectedUpdate}
          isCR={isCR}
          onClose={() => setSelectedUpdate(null)}
          onEdit={(u) => {
            setSelectedUpdate(null);
            setEditingUpdate(u);
            setComposeDefaultCourseId(u.course_id);
            setComposeDefaultCategory(u.category || u.section);
            setComposeOpen(true);
          }}
          onDelete={handleDeleteUpdate}
        />
      </Sheet>

      {/* CR Compose / Edit Update Sheet */}
      <Sheet
        open={composeOpen}
        onClose={() => {
          setComposeOpen(false);
          setEditingUpdate(null);
        }}
      >
        <ComposeSheet
          courses={courses}
          initialUpdate={editingUpdate}
          defaultCourseId={composeDefaultCourseId}
          defaultCategory={composeDefaultCategory}
          onClose={() => {
            setComposeOpen(false);
            setEditingUpdate(null);
          }}
          onSave={handleSaveUpdate}
        />
      </Sheet>

      {/* CR Course Management Sheet */}
      <Sheet
        open={manageCoursesOpen}
        onClose={() => {
          setManageCoursesOpen(false);
          setEditingCourse(null);
        }}
      >
        <CourseManageSheet
          courses={courses}
          editingCourse={editingCourse}
          onClose={() => {
            setManageCoursesOpen(false);
            setEditingCourse(null);
          }}
          onCreateCourse={handleCreateCourse}
          onUpdateCourse={handleUpdateCourse}
          onDeleteCourse={handleDeleteCourse}
        />
      </Sheet>

      {/* Join Class Sheet */}
      <Sheet open={joinOpen} onClose={() => setJoinOpen(false)}>
        <JoinSheet onClose={() => setJoinOpen(false)} onJoin={handleJoinClass} />
      </Sheet>

      {/* Create Class Sheet */}
      <Sheet open={createClassOpen} onClose={() => setCreateClassOpen(false)}>
        <CreateClassSheet onClose={() => setCreateClassOpen(false)} onCreate={handleCreateClass} />
      </Sheet>

      {/* Confirm Action Sheet */}
      <Sheet open={!!confirm} onClose={() => { if (!isDeletingGroup) setConfirm(null); }}>
        {confirm === 'deleteGroup' && (
          <ConfirmSheet
            title="Delete this group?"
            description="This will permanently delete the group for all members. This action cannot be undone."
            confirmLabel={isDeletingGroup ? 'Deleting group...' : 'Delete Group'}
            disabled={isDeletingGroup}
            onCancel={() => { if (!isDeletingGroup) setConfirm(null); }}
            onConfirm={handleDeleteGroup}
          />
        )}
        {confirm === 'leave' && (
          <ConfirmSheet
            description="You'll lose access to this class's academic updates. You can rejoin later with the group code, if it hasn't expired."
            confirmLabel="Leave class"
            onCancel={() => setConfirm(null)}
            onConfirm={handleLeaveClass}
          />
        )}
        {confirm === 'logout' && (
          <ConfirmSheet
            description="You'll need to sign in again with your DIU email to access your announcements."
            confirmLabel="Log out"
            onCancel={() => setConfirm(null)}
            onConfirm={handleLogout}
          />
        )}
      </Sheet>
    </div>
  );
}

export default App;
