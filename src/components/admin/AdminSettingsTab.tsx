import React, { useState } from 'react';
import type { AdminSystemConfig } from '../../lib/adminApi';
import { adminApi } from '../../lib/adminApi';

interface AdminSettingsTabProps {
  system: AdminSystemConfig | null;
  onUpdateSuccess: (newConfig: AdminSystemConfig) => void;
  showToast: (msg: string) => void;
}

export const AdminSettingsTab: React.FC<AdminSettingsTabProps> = ({
  system,
  onUpdateSuccess,
  showToast,
}) => {
  const [isShutdown, setIsShutdown] = useState<boolean>(Boolean(system?.isShutdown));
  const [shutdownMessage, setShutdownMessage] = useState<string>(
    system?.shutdownMessage || 'Class Mate is temporarily unavailable due to maintenance. Please try again later.'
  );
  const [scheduledStart, setScheduledStart] = useState<string>(system?.scheduledStart || '');
  const [scheduledEnd, setScheduledEnd] = useState<string>(system?.scheduledEnd || '');
  const [notes, setNotes] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState<'shutdown' | 'restart' | null>(null);

  const handleApplyChanges = async (targetShutdown?: boolean) => {
    setSaving(true);
    setConfirmModal(null);

    const shutdownState = targetShutdown !== undefined ? targetShutdown : isShutdown;

    try {
      const res = await adminApi.updateSystemStatus({
        isShutdown: shutdownState,
        shutdownMessage: shutdownMessage.trim(),
        scheduledStart: scheduledStart.trim() || null,
        scheduledEnd: scheduledEnd.trim() || null,
        actionType: shutdownState ? 'SHUTDOWN_APP' : 'UPDATE_SYSTEM_STATUS',
        notes: notes.trim() || (shutdownState ? 'Admin activated maintenance shutdown.' : 'System updated.'),
      });

      setIsShutdown(res.isShutdown);
      onUpdateSuccess(res);
      showToast(shutdownState ? 'Application SHUT DOWN (Maintenance mode active)' : 'Application operational status saved');
    } catch (err: any) {
      showToast(err.message || 'Failed to update system status.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 760 }}>
      {/* Card 1: Immediate Application Availability */}
      <div
        style={{
          background: '#121624',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
              Global Maintenance & Shutdown Switch
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4, lineHeight: 1.45 }}>
              Instantly toggle the application availability for all student and CR users across the university.
            </p>
          </div>

          <div
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              background: isShutdown ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
              color: isShutdown ? '#FCA5A5' : '#6EE7B7',
              border: `1px solid ${isShutdown ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
            }}
          >
            {isShutdown ? 'OFFLINE' : 'ONLINE'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          {isShutdown ? (
            <button
              onClick={() => handleApplyChanges(false)}
              disabled={saving}
              style={{
                background: '#10B981',
                border: 'none',
                color: '#FFFFFF',
                padding: '12px 20px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                cursor: saving ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>🚀 Turn Application Back ON (Online)</span>
            </button>
          ) : (
            <button
              onClick={() => setConfirmModal('shutdown')}
              disabled={saving}
              style={{
                background: '#EF4444',
                border: 'none',
                color: '#FFFFFF',
                padding: '12px 20px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                cursor: saving ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>⚠️ SHUT DOWN APP (Maintenance Mode)</span>
            </button>
          )}
        </div>
      </div>

      {/* Card 2: Custom Shutdown Notice Message */}
      <div
        style={{
          background: '#121624',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: '24px',
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
          Custom Maintenance Message
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4, marginBottom: 16 }}>
          This message will be presented to users when they open ClassMate during shutdown.
        </p>

        <textarea
          rows={3}
          value={shutdownMessage}
          onChange={(e) => setShutdownMessage(e.target.value)}
          placeholder="Enter custom maintenance explanation for users..."
          style={{
            width: '100%',
            background: '#1E2438',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            padding: '12px 14px',
            color: '#FFFFFF',
            fontSize: 13.5,
            fontFamily: 'inherit',
            lineHeight: 1.5,
            outline: 'none',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Card 3: Scheduled Shutdown & Automatic Restart */}
      <div
        style={{
          background: '#121624',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: '24px',
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
          Scheduled Maintenance Window
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4, marginBottom: 16 }}>
          Set an optional future window. The application will automatically enter maintenance at Start Time and restore access at End Time.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', display: 'block', marginBottom: 6 }}>
              SCHEDULED START TIME
            </label>
            <input
              type="datetime-local"
              value={scheduledStart}
              onChange={(e) => setScheduledStart(e.target.value)}
              style={{
                width: '100%',
                background: '#1E2438',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                padding: '10px 12px',
                color: '#FFFFFF',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', display: 'block', marginBottom: 6 }}>
              AUTOMATIC RESTART / END TIME
            </label>
            <input
              type="datetime-local"
              value={scheduledEnd}
              onChange={(e) => setScheduledEnd(e.target.value)}
              style={{
                width: '100%',
                background: '#1E2438',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                padding: '10px 12px',
                color: '#FFFFFF',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {(scheduledStart || scheduledEnd) && (
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <button
              onClick={() => {
                setScheduledStart('');
                setScheduledEnd('');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.4)',
                fontSize: 12,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Clear Scheduled Dates
            </button>
          </div>
        )}
      </div>

      {/* Card 4: Action Reason / Notes */}
      <div
        style={{
          background: '#121624',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: '24px',
        }}
      >
        <label style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', display: 'block', marginBottom: 6 }}>
          Audit Reason / Internal Notes
        </label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Scheduled database index maintenance or semester migration"
          style={{
            width: '100%',
            background: '#1E2438',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8,
            padding: '10px 14px',
            color: '#FFFFFF',
            fontSize: 13,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => handleApplyChanges()}
            disabled={saving}
            style={{
              background: '#818CF8',
              border: 'none',
              color: '#FFFFFF',
              padding: '12px 24px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            {saving ? 'Saving...' : 'Save Settings & Configuration'}
          </button>
        </div>
      </div>

      {/* Safety Confirmation Modal */}
      {confirmModal === 'shutdown' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#1A1424',
              border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: 20,
              maxWidth: 480,
              width: '100%',
              padding: '28px 24px',
              boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
              Confirm Application Shutdown
            </h3>
            <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.75)', marginTop: 8, lineHeight: 1.5 }}>
              Are you sure you want to put ClassMate into <strong>Maintenance Mode</strong>? All students and CRs will be temporarily shown the maintenance screen until you restart the application.
            </p>
            <div style={{ fontSize: 12, color: '#FCA5A5', marginTop: 12, background: 'rgba(239,68,68,0.1)', padding: '10px 12px', borderRadius: 8 }}>
              Note: The admin dashboard will remain accessible to you at all times.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <button
                onClick={() => setConfirmModal(null)}
                style={{
                  background: '#1E2438',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#FFFFFF',
                  padding: '10px 16px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleApplyChanges(true)}
                style={{
                  background: '#EF4444',
                  border: 'none',
                  color: '#FFFFFF',
                  padding: '10px 18px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Yes, Shut Down App
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
