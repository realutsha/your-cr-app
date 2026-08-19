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
