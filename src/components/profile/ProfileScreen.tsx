import { useState } from 'react';
import {
  Bell,
  Check,
  ChevronRight,
  Copy,
  Edit3,
  ExternalLink,
  Info,
  Laptop,
  LogOut,
  Mail,
  Moon,
  Send,
  Sun,
  Trash2,
  User as UserIcon,
  Users,
} from 'lucide-react';
import type { ApprovalMode, Group, User } from '../../types';
import { formatFriendlyDate, getExpirationCountdown } from '../../lib/auth';
import { store } from '../../lib/store';
import { LIMITS } from '../../lib/validation';
import type { ThemePreference } from '../../lib/theme';
import { Sheet } from '../common/Sheet';

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
  onUpdateSectionName?: (name: string) => Promise<{ success: boolean; error?: string }>;
  onJoinClick: () => void;
  onCreateClassClick: () => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--c-text-faint)',
        margin: '20px 0 7px 4px',
      }}
    >
      {children}
    </div>
  );
}

function SettingsCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: 'var(--c-card-bg)',
        borderRadius: 16,
        border: '1px solid var(--c-hairline)',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

interface SettingsRowProps {
  icon: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  value?: string | React.ReactNode;
  onClick?: () => void;
  showChevron?: boolean;
  rightElement?: React.ReactNode;
  isDestructive?: boolean;
}

function SettingsRow({
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  value,
  onClick,
  showChevron = true,
  rightElement,
  isDestructive = false,
}: SettingsRowProps) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '13px 16px',
        gap: 13,
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: iconBg || (isDestructive ? 'var(--c-danger-bg)' : 'var(--c-card-subtle)'),
          color: iconColor || (isDestructive ? 'var(--c-danger)' : 'var(--c-accent)'),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: isDestructive ? 'var(--c-danger)' : 'var(--c-text)',
            lineHeight: 1.3,
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--c-text-faint)',
              marginTop: 1,
              lineHeight: 1.3,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {value && (
        <div
          style={{
            fontSize: 14.5,
            fontFamily:
              typeof value === 'string' && /\d/.test(value)
                ? 'var(--font-mono)'
                : 'var(--font-body)',
            color: 'var(--c-text-soft)',
            flexShrink: 0,
            marginRight: 2,
            maxWidth: 180,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </div>
      )}
      {rightElement ? (
        rightElement
      ) : showChevron ? (
        <ChevronRight
          size={16}
          color={isDestructive ? 'var(--c-danger)' : 'var(--c-text-faint)'}
          style={{ flexShrink: 0 }}
        />
      ) : null}
    </div>
  );
}

function RowDivider() {
  return (
    <div
      style={{
        marginLeft: 61,
        borderBottom: '1px solid var(--c-hairline)',
      }}
    />
  );
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label || 'Toggle switch'}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      style={{
        width: 48,
        height: 29,
        borderRadius: 15,
        background: checked ? 'var(--c-success)' : 'var(--c-hairline-strong)',
        position: 'relative',
        transition: 'background-color 200ms ease',
        border: 'none',
        cursor: 'pointer',
        padding: 2,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: 25,
          height: 25,
          borderRadius: '50%',
          background: '#FFFFFF',
          boxShadow: '0 2px 4px rgba(0,0,0,0.18)',
          transform: checked ? 'translateX(19px)' : 'translateX(0)',
          transition: 'transform 200ms cubic-bezier(0.3, 0.85, 0.4, 1)',
        }}
      />
    </button>
  );
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
  onUpdateSectionName,
  onJoinClick,
  onCreateClassClick,
}: ProfileScreenProps) {
  // Modal / Sheet States
  const [manageSheetOpen, setManageSheetOpen] = useState(false);
  const [appearanceSheetOpen, setAppearanceSheetOpen] = useState(false);
  const [aboutSheetOpen, setAboutSheetOpen] = useState(false);
  const [contactSheetOpen, setContactSheetOpen] = useState(false);
  const [classDetailsOpen, setClassDetailsOpen] = useState(false);

  // Copy Feedback States
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedRegId, setCopiedRegId] = useState(false);

  // Section Name Editing State
  const [editingSectionName, setEditingSectionName] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [savingSectionName, setSavingSectionName] = useState(false);
  const [sectionNameError, setSectionNameError] = useState<string | null>(null);

  const editCount = group?.section_name_edit_count ?? 0;
  const canEditSectionName = Boolean(isCR && group && editCount < 2);
  const pendingRequests = isCR && group ? store.getPendingRequestsForHost(user.id) : [];

  const handleCopyClassCode = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onCopyCode();
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyRegId = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(user.username);
      setCopiedRegId(true);
      setTimeout(() => setCopiedRegId(false), 2000);
    }
  };

  // Formatted Registration ID (e.g. "251 - 35 - 118")
  const formattedRegId = user.username.includes('-')
    ? user.username.split('-').join(' - ')
    : user.username;

  // Theme Preference Title & Icon
  const themeNames: Record<ThemePreference, string> = {
    system: 'System',
    light: 'Light',
    dark: 'Dark',
  };
  const ThemeIcon = themePreference === 'dark' ? Moon : themePreference === 'light' ? Sun : Laptop;

  // Notification status
  const isNotificationsActive = notificationPermission === 'granted';
  const notificationSubtitle = isNotificationsActive
    ? hasFcmToken
      ? 'FCM push notifications active'
      : 'Browser notifications allowed'
    : 'Routine and schedule updates';

  const memberCount = Math.min(
    50,
    Math.max(0, typeof group?.member_count === 'number' ? group.member_count : 1)
  );

  return (
    <main style={{ paddingBottom: 28 }}>
      {/* ========================================================
          1. CURRENT CLASS SECTION
          ======================================================== */}
      <SectionLabel>Current Class</SectionLabel>

      {group ? (
        <SettingsCard style={{ padding: '16px 18px' }}>
          {/* Top Row: Class icon, name, code, capacity, chevron */}
          <div
            onClick={() => {
              if (isCR) {
                setManageSheetOpen(true);
              } else {
                setClassDetailsOpen(true);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 13,
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            {/* Blue outlined users icon inside light-blue container */}
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'var(--c-accent-bg)',
                color: 'var(--c-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Users size={22} strokeWidth={2} />
            </div>

            {/* Class Name + Code + Capacity */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <h3
                  style={{
                    fontFamily: 'var(--font-head)',
                    fontSize: 16.5,
                    fontWeight: 700,
                    color: 'var(--c-text)',
                    margin: 0,
                    letterSpacing: '-0.015em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {group.name}
                </h3>
                {isCR && (
                  <span
                    style={{
                      background: 'var(--c-accent-bg)',
                      color: 'var(--c-accent)',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      padding: '2px 6px',
                      borderRadius: 6,
                      flexShrink: 0,
                    }}
                  >
                    CR
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                {/* Class Code with small copy icon */}
                <button
                  type="button"
                  onClick={handleCopyClassCode}
                  title="Click to copy class code"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'var(--c-card-subtle)',
                    padding: '2px 7px',
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: 'var(--c-text)',
                    }}
                  >
                    #{group.code}
                  </span>
                  {copiedCode ? (
                    <Check size={12} color="var(--c-success)" />
                  ) : (
                    <Copy size={12} color="var(--c-text-faint)" />
                  )}
                </button>

                {/* Capacity */}
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: 'var(--c-text-faint)',
                    fontWeight: 500,
                  }}
                >
                  ({memberCount}/50)
                </span>
              </div>
            </div>

            {/* Chevron Right */}
            <ChevronRight size={18} color="var(--c-text-faint)" style={{ flexShrink: 0 }} />
          </div>

          {/* Thin Divider */}
          <div
            style={{
              borderBottom: '1px solid var(--c-hairline)',
              margin: '14px 0 12px',
            }}
          />

          {/* Info Row: Students count | Green Active Dot | Expiry */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 12.5,
              fontFamily: 'var(--font-body)',
              color: 'var(--c-text-soft)',
              padding: '0 4px',
            }}
          >
            <span>{memberCount} Students</span>

            <div style={{ width: 1, height: 12, background: 'var(--c-hairline)' }} />

            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--c-success)',
                  display: 'inline-block',
                }}
              />
              Active
            </span>

            <div style={{ width: 1, height: 12, background: 'var(--c-hairline)' }} />

            {getExpirationCountdown(group.expires_at).isFinalWeek ? (
              <span style={{ color: 'var(--c-danger)', fontWeight: 600 }}>
                {getExpirationCountdown(group.expires_at).label}
              </span>
            ) : (
              <span>Expires {formatFriendlyDate(group.expires_at)}</span>
            )}
          </div>

          {/* If CR: Bottom large light-blue "Manage Class" button with chevron */}
          {isCR && (
            <button
              type="button"
              onClick={() => setManageSheetOpen(true)}
              style={{
                width: '100%',
                marginTop: 14,
                background: 'var(--c-accent-bg)',
                color: 'var(--c-accent)',
                borderRadius: 12,
                padding: '11px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 14.5,
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                transition: 'opacity 150ms ease',
              }}
            >
              <span>Manage Class</span>
              <ChevronRight size={16} />
            </button>
          )}
        </SettingsCard>
      ) : (
        /* Empty State */
        <SettingsCard style={{ padding: '22px 18px', textAlign: 'center' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'var(--c-accent-bg)',
              color: 'var(--c-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}
          >
            <Users size={24} strokeWidth={2} />
          </div>
          <div
            style={{
              fontFamily: 'var(--font-head)',
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--c-text)',
              marginBottom: 4,
            }}
          >
            No Class Joined
          </div>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'var(--c-text-soft)',
              marginBottom: 16,
              lineHeight: 1.4,
            }}
          >
            Join with your 6-character class code or create a new class.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={onJoinClick}
              style={{
                padding: '9px 16px',
                borderRadius: 10,
                background: 'var(--c-accent)',
                color: '#FFFFFF',
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
              }}
            >
              Join with code
            </button>
            <button
              type="button"
              onClick={onCreateClassClick}
              style={{
                padding: '9px 16px',
                borderRadius: 10,
                background: 'var(--c-card-subtle)',
                border: '1px solid var(--c-hairline)',
                color: 'var(--c-text-soft)',
                fontSize: 13.5,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Create class
            </button>
          </div>
        </SettingsCard>
      )}

      {/* ========================================================
          2. ACCOUNT SECTION
          ======================================================== */}
      <SectionLabel>Account</SectionLabel>
      <SettingsCard>
        {/* Row 1: Reg ID */}
        <SettingsRow
          icon={<UserIcon size={17} />}
          title="Reg ID"
          value={formattedRegId}
          onClick={handleCopyRegId}
          rightElement={
            copiedRegId ? (
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--c-success)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <Check size={14} /> Copied
              </span>
            ) : undefined
          }
        />

        <RowDivider />

        {/* Row 2: Email */}
        <SettingsRow
          icon={<Mail size={17} />}
          title="Email"
          value={user.email}
          onClick={() => {
            if (navigator.clipboard) {
              navigator.clipboard.writeText(user.email);
            }
          }}
        />
      </SettingsCard>

      {/* ========================================================
          3. PREFERENCES SECTION
          ======================================================== */}
      <SectionLabel>Preferences</SectionLabel>
      <SettingsCard>
        {/* Row 1: Push Notifications */}
        <SettingsRow
          icon={<Bell size={17} />}
          title="Push Notifications"
          subtitle={notificationSubtitle}
          showChevron={false}
          rightElement={
            <ToggleSwitch
              checked={isNotificationsActive}
              onChange={onEnableNotifications}
              label="Push Notifications"
            />
          }
        />

        <RowDivider />

        {/* Row 2: Appearance */}
        <SettingsRow
          icon={<ThemeIcon size={17} />}
          title="Appearance"
          subtitle={themeNames[themePreference]}
          onClick={() => setAppearanceSheetOpen(true)}
        />
      </SettingsCard>

      {/* ========================================================
          4. SUPPORT SECTION
          ======================================================== */}
      <SectionLabel>Support</SectionLabel>
      <SettingsCard>
        {/* Row 1: About Classmate */}
        <SettingsRow
          icon={<Info size={17} />}
          title="About Classmate"
          onClick={() => setAboutSheetOpen(true)}
        />

        <RowDivider />

        {/* Row 2: Contact Developer */}
        <SettingsRow
          icon={<Send size={16} />}
          title="Contact Developer"
          onClick={() => setContactSheetOpen(true)}
        />
      </SettingsCard>

      {/* ========================================================
          5. SIGN OUT SECTION
          ======================================================== */}
      <div style={{ marginTop: 20 }}>
        <SettingsCard>
          <SettingsRow
            icon={<LogOut size={17} />}
            title="Sign Out"
            isDestructive={true}
            onClick={onLogout}
          />
        </SettingsCard>
      </div>

      {/* ========================================================
          SHEET: MANAGE CLASS (CR)
          ======================================================== */}
      {group && isCR && (
        <Sheet open={manageSheetOpen} onClose={() => setManageSheetOpen(false)}>
          <div style={{ padding: '8px 20px 32px' }}>
            {/* Sheet Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: 14,
                borderBottom: '1px solid var(--c-hairline)',
                marginBottom: 18,
              }}
            >
              <div>
                <h2
                  style={{
                    fontFamily: 'var(--font-head)',
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'var(--c-text)',
                    margin: 0,
                  }}
                >
                  Manage Class
                </h2>
                <span style={{ fontSize: 12.5, color: 'var(--c-text-faint)' }}>
                  Class Representative Controls
                </span>
              </div>
              <button
                type="button"
                onClick={() => setManageSheetOpen(false)}
                style={{
                  fontSize: 14.5,
                  fontWeight: 600,
                  color: 'var(--c-accent)',
                  padding: '4px 8px',
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>

            {/* Section Name Management */}
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'var(--c-text-faint)',
                  }}
                >
                  Section Name
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: canEditSectionName ? 'var(--c-accent)' : 'var(--c-text-faint)',
                  }}
                >
                  {2 - editCount} edit{2 - editCount === 1 ? '' : 's'} remaining
                </span>
              </div>

              {!editingSectionName ? (
                <div
                  style={{
                    background: 'var(--c-card-subtle)',
                    border: '1px solid var(--c-hairline)',
                    borderRadius: 12,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-text)' }}>
                    {group.name}
                  </span>
                  {canEditSectionName && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewSectionName(group.name);
                        setEditingSectionName(true);
                        setSectionNameError(null);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        color: 'var(--c-accent)',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '4px 8px',
                      }}
                    >
                      <Edit3 size={13} />
                      <span>Edit</span>
                    </button>
                  )}
                </div>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (savingSectionName || !newSectionName.trim()) return;
                    setSavingSectionName(true);
                    setSectionNameError(null);
                    try {
                      const res = await onUpdateSectionName?.(newSectionName);
                      if (res?.success) {
                        setEditingSectionName(false);
                      } else {
                        setSectionNameError(res?.error || 'Failed to update section name.');
                      }
                    } catch (err: unknown) {
                      const eObj = err as { message?: string };
                      setSectionNameError(eObj?.message || 'Failed to update section name.');
                    } finally {
                      setSavingSectionName(false);
                    }
                  }}
                  style={{
                    background: 'var(--c-card-subtle)',
                    border: '1px solid var(--c-hairline)',
                    borderRadius: 12,
                    padding: '12px 14px',
                  }}
                >
                  <input
                    type="text"
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    placeholder="e.g. Software Engineering — Section I"
                    maxLength={LIMITS.CLASS_NAME}
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--c-hairline-strong)',
                      background: 'var(--c-card-bg)',
                      color: 'var(--c-text)',
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                      marginBottom: 8,
                    }}
                  />
                  {sectionNameError && (
                    <div style={{ fontSize: 12, color: 'var(--c-danger)', marginBottom: 8 }}>
                      {sectionNameError}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSectionName(false);
                        setSectionNameError(null);
                      }}
                      disabled={savingSectionName}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12.5,
                        fontWeight: 500,
                        color: 'var(--c-text-soft)',
                        borderRadius: 8,
                        border: '1px solid var(--c-hairline)',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={
                        savingSectionName ||
                        !newSectionName.trim() ||
                        newSectionName.trim().toLowerCase() === group.name.trim().toLowerCase()
                      }
                      style={{
                        padding: '6px 14px',
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: '#FFFFFF',
                        background: 'var(--c-accent)',
                        borderRadius: 8,
                        border: 'none',
                        cursor:
                          savingSectionName ||
                          !newSectionName.trim() ||
                          newSectionName.trim().toLowerCase() === group.name.trim().toLowerCase()
                            ? 'default'
                            : 'pointer',
                        opacity:
                          savingSectionName ||
                          !newSectionName.trim() ||
                          newSectionName.trim().toLowerCase() === group.name.trim().toLowerCase()
                            ? 0.6
                            : 1,
                      }}
                    >
                      {savingSectionName ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Approval Mode */}
            <div style={{ marginBottom: 20 }}>
              <span
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--c-text-faint)',
                  marginBottom: 8,
                }}
              >
                Student Approval Mode
              </span>
              <div
                style={{
                  background: 'var(--c-card-subtle)',
                  border: '1px solid var(--c-hairline)',
                  borderRadius: 12,
                  padding: '12px 14px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--c-text)' }}>
                    {group.approval_mode === 'auto' ? 'Auto Approval' : 'Manual Approval'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onToggleApprovalMode?.(group.approval_mode === 'auto' ? 'manual' : 'auto')
                    }
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--c-accent)',
                      cursor: 'pointer',
                    }}
                  >
                    Switch to {group.approval_mode === 'auto' ? 'Manual' : 'Auto'}
                  </button>
                </div>
                <p
                  style={{
                    fontSize: 12.5,
                    color: 'var(--c-text-faint)',
                    margin: 0,
                    lineHeight: 1.4,
                  }}
                >
                  {group.approval_mode === 'auto'
                    ? 'Students with your class code can join immediately without waiting.'
                    : 'New students who enter your class code must be approved by you before joining.'}
                </p>
              </div>
            </div>

            {/* Pending Requests */}
            {pendingRequests.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'var(--c-text-faint)',
                    marginBottom: 8,
                  }}
                >
                  Pending Requests ({pendingRequests.length})
                </span>
                <div
                  style={{
                    background: 'var(--c-card-subtle)',
                    border: '1px solid var(--c-hairline)',
                    borderRadius: 12,
                    overflow: 'hidden',
                  }}
                >
                  {pendingRequests.map((req, idx) => (
                    <div
                      key={req.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderBottom:
                          idx < pendingRequests.length - 1
                            ? '1px solid var(--c-hairline)'
                            : 'none',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 13.5,
                          fontWeight: 500,
                          color: 'var(--c-text)',
                        }}
                      >
                        {req.username}
                      </span>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          type="button"
                          onClick={() => store.respondToJoinRequest(req.id, true)}
                          style={{
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: 'var(--c-accent)',
                            cursor: 'pointer',
                          }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => store.respondToJoinRequest(req.id, false)}
                          style={{
                            fontSize: 12.5,
                            color: 'var(--c-danger)',
                            cursor: 'pointer',
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Danger Actions */}
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--c-hairline)' }}>
              <button
                type="button"
                onClick={() => {
                  setManageSheetOpen(false);
                  onLeave();
                }}
                style={{
                  width: '100%',
                  padding: '11px 0',
                  fontSize: 14.5,
                  fontWeight: 500,
                  color: 'var(--c-danger)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  border: 'none',
                  background: 'none',
                }}
              >
                Leave class
              </button>
              <button
                type="button"
                onClick={() => {
                  setManageSheetOpen(false);
                  onDeleteGroup?.();
                }}
                style={{
                  width: '100%',
                  padding: '11px 0',
                  fontSize: 14.5,
                  fontWeight: 600,
                  color: 'var(--c-danger)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  border: 'none',
                  background: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Trash2 size={16} />
                <span>Delete Class</span>
              </button>
            </div>
          </div>
        </Sheet>
      )}

      {/* ========================================================
          SHEET: CLASS DETAILS (NON-CR)
          ======================================================== */}
      {group && !isCR && (
        <Sheet open={classDetailsOpen} onClose={() => setClassDetailsOpen(false)}>
          <div style={{ padding: '8px 20px 32px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: 14,
                borderBottom: '1px solid var(--c-hairline)',
                marginBottom: 18,
              }}
            >
              <h2
                style={{
                  fontFamily: 'var(--font-head)',
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'var(--c-text)',
                  margin: 0,
                }}
              >
                Class Information
              </h2>
              <button
                type="button"
                onClick={() => setClassDetailsOpen(false)}
                style={{
                  fontSize: 14.5,
                  fontWeight: 600,
                  color: 'var(--c-accent)',
                  padding: '4px 8px',
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>

            <SettingsCard style={{ marginBottom: 20 }}>
              <SettingsRow
                icon={<Users size={16} />}
                title="Class Name"
                value={group.name}
                showChevron={false}
              />
              <RowDivider />
              <SettingsRow
                icon={<Copy size={16} />}
                title="Class Code"
                value={`#${group.code}`}
                onClick={handleCopyClassCode}
                rightElement={
                  copiedCode ? (
                    <span style={{ fontSize: 12, color: 'var(--c-success)', fontWeight: 600 }}>
                      Copied
                    </span>
                  ) : undefined
                }
              />
              <RowDivider />
              <SettingsRow
                icon={<UserIcon size={16} />}
                title="Enrolled Students"
                value={`${memberCount} / 50`}
                showChevron={false}
              />
            </SettingsCard>

            <button
              type="button"
              onClick={() => {
                setClassDetailsOpen(false);
                onLeave();
              }}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 12,
                background: 'var(--c-danger-bg)',
                color: 'var(--c-danger)',
                fontSize: 14.5,
                fontWeight: 600,
                textAlign: 'center',
                cursor: 'pointer',
                border: 'none',
              }}
            >
              Leave this class
            </button>
          </div>
        </Sheet>
      )}

      {/* ========================================================
          SHEET: APPEARANCE SELECTION
          ======================================================== */}
      <Sheet open={appearanceSheetOpen} onClose={() => setAppearanceSheetOpen(false)}>
        <div style={{ padding: '8px 20px 32px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 14,
              borderBottom: '1px solid var(--c-hairline)',
              marginBottom: 18,
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-head)',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--c-text)',
                margin: 0,
              }}
            >
              Appearance
            </h2>
            <button
              type="button"
              onClick={() => setAppearanceSheetOpen(false)}
              style={{
                fontSize: 14.5,
                fontWeight: 600,
                color: 'var(--c-accent)',
                padding: '4px 8px',
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>

          <SettingsCard>
            {[
              { key: 'system' as const, label: 'System', icon: Laptop, desc: 'Match device theme' },
              { key: 'light' as const, label: 'Light', icon: Sun, desc: 'Clean, light background' },
              { key: 'dark' as const, label: 'Dark', icon: Moon, desc: 'Subtle dark interface' },
            ].map((item, idx) => {
              const isSelected = themePreference === item.key;
              const IconComponent = item.icon;
              return (
                <div key={item.key}>
                  {idx > 0 && <RowDivider />}
                  <div
                    onClick={() => {
                      onThemeChange(item.key);
                      setAppearanceSheetOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '14px 16px',
                      gap: 13,
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: isSelected ? 'var(--c-accent-bg)' : 'var(--c-card-subtle)',
                        color: isSelected ? 'var(--c-accent)' : 'var(--c-text-soft)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <IconComponent size={17} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: isSelected ? 600 : 500,
                          color: 'var(--c-text)',
                        }}
                      >
                        {item.label}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--c-text-faint)' }}>{item.desc}</div>
                    </div>
                    {isSelected && (
                      <Check size={18} color="var(--c-accent)" style={{ flexShrink: 0 }} />
                    )}
                  </div>
                </div>
              );
            })}
          </SettingsCard>
        </div>
      </Sheet>

      {/* ========================================================
          SHEET: ABOUT CLASSMATE
          ======================================================== */}
      <Sheet open={aboutSheetOpen} onClose={() => setAboutSheetOpen(false)}>
        <div style={{ padding: '8px 20px 32px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 14,
              borderBottom: '1px solid var(--c-hairline)',
              marginBottom: 18,
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-head)',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--c-text)',
                margin: 0,
              }}
            >
              About Classmate
            </h2>
            <button
              type="button"
              onClick={() => setAboutSheetOpen(false)}
              style={{
                fontSize: 14.5,
                fontWeight: 600,
                color: 'var(--c-accent)',
                padding: '4px 8px',
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>

          <div style={{ textAlign: 'center', padding: '12px 0 20px' }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 16,
                background: 'var(--c-accent-bg)',
                color: 'var(--c-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
              }}
            >
              <Users size={32} strokeWidth={2.2} />
            </div>
            <h3
              style={{
                fontFamily: 'var(--font-head)',
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--c-text)',
                margin: '0 0 2px',
              }}
            >
              ClassMate
            </h3>
            <span
              style={{
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
                color: 'var(--c-text-faint)',
              }}
            >
              Version 1.0.0
            </span>
          </div>

          <SettingsCard style={{ padding: '16px 18px', marginBottom: 16 }}>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                color: 'var(--c-text-soft)',
                lineHeight: 1.55,
                margin: '0 0 12px',
              }}
            >
              ClassMate is an exclusive real-time class announcement and schedule platform designed
              specifically for students and Class Representatives at Daffodil International
              University (DIU).
            </p>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                color: 'var(--c-text-soft)',
                lineHeight: 1.55,
                margin: 0,
              }}
            >
              Get instant updates for quizzes, assignments, class cancellations, and room
              allocations right on your mobile screen.
            </p>
          </SettingsCard>

          <div style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--c-text-faint)' }}>
            Developed with ❤️ for DIU Students
          </div>
        </div>
      </Sheet>

      {/* ========================================================
          SHEET: CONTACT DEVELOPER
          ======================================================== */}
      <Sheet open={contactSheetOpen} onClose={() => setContactSheetOpen(false)}>
        <div style={{ padding: '8px 20px 32px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 14,
              borderBottom: '1px solid var(--c-hairline)',
              marginBottom: 18,
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-head)',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--c-text)',
                margin: 0,
              }}
            >
              Contact Developer
            </h2>
            <button
              type="button"
              onClick={() => setContactSheetOpen(false)}
              style={{
                fontSize: 14.5,
                fontWeight: 600,
                color: 'var(--c-accent)',
                padding: '4px 8px',
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>

          <div style={{ padding: '4px 0 16px' }}>
            <p
              style={{
                fontSize: 14,
                color: 'var(--c-text-soft)',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Have feedback, found a bug, or want to suggest a new feature? Feel free to reach out
              directly:
            </p>
          </div>

          <SettingsCard>
            <SettingsRow
              icon={<Mail size={16} />}
              title="Send an Email"
              subtitle="madhurzamutsha@gmail.com"
              onClick={() => {
                window.location.href = 'mailto:madhurzamutsha@gmail.com?subject=ClassMate%20Feedback';
              }}
              rightElement={<ExternalLink size={16} color="var(--c-text-faint)" />}
            />

            <RowDivider />

            <SettingsRow
              icon={<Send size={16} />}
              title="GitHub"
              subtitle="@realutsha"
              onClick={() => {
                window.open('https://github.com/realutsha', '_blank', 'noopener,noreferrer');
              }}
              rightElement={<ExternalLink size={16} color="var(--c-text-faint)" />}
            />

            <RowDivider />

            <SettingsRow
              icon={<Users size={16} />}
              title="Facebook"
              subtitle="Connect on Facebook"
              onClick={() => {
                window.open('https://www.facebook.com/realutsha', '_blank', 'noopener,noreferrer');
              }}
              rightElement={<ExternalLink size={16} color="var(--c-text-faint)" />}
            />
          </SettingsCard>
        </div>
      </Sheet>
    </main>
  );
}
