import { useState } from 'react';
import { Bell, ChevronDown, Laptop, Moon, Sun, Trash2 } from 'lucide-react';
import type { ApprovalMode, Group, User } from '../../types';
import { formatFriendlyDate } from '../../lib/auth';
import { store } from '../../lib/store';
import type { ThemePreference } from '../../lib/theme';
import { LogoutButton } from './LogoutButton';

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

export function ProfileScreen({
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

      {/* Follow The Creator Section */}
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
          Follow the creator
        </div>
        <div
          style={{
            background: 'var(--c-card-bg)',
            border: '1px solid var(--c-hairline)',
            borderRadius: 14,
            padding: '16px 14px',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13.5,
              color: 'var(--c-text)',
              marginBottom: 16,
            }}
          >
            Connect with the development team!
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
            {/* GitHub */}
            <a
              href="https://github.com/realutsha"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                textDecoration: 'none',
                color: 'var(--c-text)',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 8,
                transition: 'opacity 150ms ease',
              }}
            >
              <div style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              </div>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-accent)' }}>GitHub</span>
            </a>

            {/* Facebook */}
            <a
              href="https://www.facebook.com/realutsha"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                textDecoration: 'none',
                color: 'var(--c-text)',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 8,
                transition: 'opacity 150ms ease',
              }}
            >
              <div style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </div>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-accent)' }}>Facebook</span>
            </a>

            {/* Instagram */}
            <a
              href="https://www.instagram.com/realutsha"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                textDecoration: 'none',
                color: 'var(--c-text)',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 8,
                transition: 'opacity 150ms ease',
              }}
            >
              <div style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </div>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-accent)' }}>Instagram</span>
            </a>
          </div>
        </div>
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
              marginBottom: 10,
            }}
          >
            <Trash2 size={15} color="var(--c-danger)" />
            <span>Delete Group</span>
          </button>
        )}
        <div style={{ marginTop: group ? 12 : 4 }}>
          <LogoutButton onClick={onLogout} />
        </div>
      </div>
    </div>
  );
}
