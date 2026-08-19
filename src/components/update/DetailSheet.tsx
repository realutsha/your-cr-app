import { useState, useEffect } from 'react';
import { Clock, Edit3, ExternalLink, Trash2, X } from 'lucide-react';
import { CATEGORIES, type AcademicUpdate, type UpdateView } from '../../types';
import { store } from '../../lib/store';

interface DetailSheetProps {
  u: AcademicUpdate | null;
  isCR: boolean;
  onClose: () => void;
  onEdit: (u: AcademicUpdate) => void;
  onDelete: (id: string) => void;
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

export function DetailSheet({ u, isCR, onClose, onEdit, onDelete }: DetailSheetProps) {
  const [tab, setTab] = useState<'viewed' | 'notviewed'>('viewed');
  const [remoteViews, setRemoteViews] = useState<UpdateView[]>([]);

  // On-demand fetch of update views for CR when opening sheet
  useEffect(() => {
    if (u && isCR) {
      store.fetchRosterForUpdate(u.id).then((views) => {
        if (views.length > 0) {
          setRemoteViews(views);
        }
      });
    }
  }, [u, isCR]);

  if (!u) return null;

  const catMeta = CATEGORIES.find((c) => c.key === u.category || c.key === u.section);
  const topicLabel = catMeta?.topicLabel || 'Topic / Syllabus';

  const rosterStats = isCR ? store.getViewTrackingRoster(u.id, remoteViews) : null;
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
