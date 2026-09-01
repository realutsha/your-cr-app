import { ChevronLeft, Plus } from 'lucide-react';
import { CATEGORIES, type AcademicCategory, type AcademicUpdate, type Course } from '../../types';
import { store } from '../../lib/store';
import { UpdateCard } from './UpdateCard';

interface CategoryScreenProps {
  course: Course;
  categoryKey: AcademicCategory;
  isCR: boolean;
  onBack: () => void;
  onOpenUpdate: (u: AcademicUpdate) => void;
  onComposeForCategory: (course: Course, category: AcademicCategory) => void;
}

export function CategoryScreen({
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
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <button
          onClick={onBack}
          aria-label="Go back"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: 'var(--c-text)',
            cursor: 'pointer',
            padding: '4px 0',
          }}
        >
          <ChevronLeft size={22} strokeWidth={2.5} style={{ color: 'var(--c-accent)' }} />
          <h1
            style={{
              fontFamily: 'var(--font-head)',
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--c-text)',
              margin: 0,
            }}
          >
            {catMeta.label}
          </h1>
        </button>

        {isCR && (
          <button
            onClick={() => onComposeForCategory(course, categoryKey)}
            title={`New ${catMeta.label} update`}
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
        )}
      </header>

      {/* Course Breadcrumb */}
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          fontWeight: 500,
          color: 'var(--c-text-faint)',
          marginTop: 0,
          marginBottom: 24,
          paddingLeft: 2,
        }}
      >
        {course.name}
      </p>

      {allUpdates.length === 0 ? (
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
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--c-text-faint)' }}>
            {catMeta.emptyLabel}
          </span>
        </div>
      ) : (
        <>
          {/* Upcoming Section */}
          {upcomingUpdates.length > 0 && (
            <section style={{ marginBottom: 28 }}>
              <h2
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--c-text-faint)',
                  marginBottom: 12,
                  paddingLeft: 2,
                }}
              >
                Upcoming ({upcomingUpdates.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {upcomingUpdates.map((u) => (
                  <UpdateCard
                    key={u.id}
                    u={u}
                    onOpen={onOpenUpdate}
                    topicLabel={catMeta.topicLabel}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Completed / Past Section */}
          {pastUpdates.length > 0 && (
            <section style={{ marginTop: upcomingUpdates.length > 0 ? 32 : 0 }}>
              <h2
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--c-text-faint)',
                  marginBottom: 12,
                  paddingLeft: 2,
                }}
              >
                Completed & Passed ({pastUpdates.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pastUpdates.map((u) => (
                  <UpdateCard
                    key={u.id}
                    u={u}
                    onOpen={onOpenUpdate}
                    topicLabel={catMeta.topicLabel}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
