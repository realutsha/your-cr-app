import { useState } from 'react';
import { Bell, ChevronDown, Laptop, Moon, Sun, Trash2 } from 'lucide-react';
import type { ApprovalMode, Group, User } from '../../types';
import { formatFriendlyDate } from '../../lib/auth';
import { store } from '../../lib/store';
import type { ThemePreference } from '../../lib/theme';

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
