import React, { useState, useEffect } from 'react';
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

  // Synchronize local form state whenever the Firestore system config arrives or updates
  useEffect(() => {
    if (system) {
      setIsShutdown(Boolean(system.isShutdown));
      setShutdownMessage(
        system.shutdownMessage ||
          'Class Mate is temporarily unavailable due to maintenance. Please try again later.'
      );
      setScheduledStart(system.scheduledStart || '');
      setScheduledEnd(system.scheduledEnd || '');
    }
  }, [system]);

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
        actionType: targetShutdown !== undefined
          ? (targetShutdown ? 'APP_SHUTDOWN' : 'APP_RESTART')
          : (shutdownState ? 'APP_SHUTDOWN' : 'UPDATE_SYSTEM_STATUS'),
        notes: notes.trim() || (shutdownState ? 'Admin activated maintenance shutdown.' : 'System updated.'),
      });

      setIsShutdown(res.isShutdown);
      onUpdateSuccess(res);
      showToast(shutdownState ? 'Application SHUT DOWN (Maintenance mode active)' : 'Application operational status saved');
    } catch (err: any) {
      console.error('[Admin Dashboard] Failed to update system status in Firestore:', err);
      showToast(err?.message || 'Failed to update system status in Firestore.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 760 }}>
      {/* Card 1: Immediate Application Availability */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 16,
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Global Maintenance & Shutdown Switch
            </h2>
            <p style={{ fontSize: 13, color: '#64748B', marginTop: 4, lineHeight: 1.45 }}>
              Instantly toggle the application availability for all student and CR users across the university.
            </p>
          </div>

          <div
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              background: isShutdown ? '#FEF2F2' : '#ECFDF5',
              color: isShutdown ? '#DC2626' : '#059669',
              border: `1px solid ${isShutdown ? '#FECACA' : '#A7F3D0'}`,
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
                boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)',
              }}
            >
              <span>🚀 Turn Application Back ON (Online)</span>
            </button>
          ) : (
            <button
              onClick={() => setConfirmModal('shutdown')}
              disabled={saving}
              style={{
                background: '#DC2626',
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
                boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
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
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 16,
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0 }}>
          Custom Maintenance Message
        </h2>
        <p style={{ fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 16 }}>
          This message will be presented to users when they open ClassMate during shutdown.
        </p>

        <textarea
          rows={3}
          value={shutdownMessage}
          onChange={(e) => setShutdownMessage(e.target.value)}
          placeholder="Enter custom maintenance explanation for users..."
          style={{
            width: '100%',
            background: '#F8FAFC',
            border: '1px solid #CBD5E1',
            borderRadius: 10,
            padding: '12px 14px',
            color: '#0F172A',
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
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 16,
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0 }}>
          Scheduled Maintenance Window
        </h2>
        <p style={{ fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 16 }}>
          Set an optional future window. The application will automatically enter maintenance at Start Time and restore access at End Time.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
              SCHEDULED START TIME
            </label>
            <input
              type="datetime-local"
              value={scheduledStart}
              onChange={(e) => setScheduledStart(e.target.value)}
              style={{
                width: '100%',
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: 8,
                padding: '10px 12px',
                color: '#0F172A',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
              AUTOMATIC RESTART / END TIME
            </label>
            <input
              type="datetime-local"
              value={scheduledEnd}
              onChange={(e) => setScheduledEnd(e.target.value)}
              style={{
                width: '100%',
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: 8,
                padding: '10px 12px',
                color: '#0F172A',
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
                color: '#64748B',
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
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 16,
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <label style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', display: 'block', marginBottom: 6 }}>
          Audit Reason / Internal Notes
        </label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Scheduled database index maintenance or semester migration"
          style={{
            width: '100%',
            background: '#F8FAFC',
            border: '1px solid #CBD5E1',
            borderRadius: 8,
            padding: '10px 14px',
            color: '#0F172A',
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
              background: '#4F46E5',
              border: 'none',
              color: '#FFFFFF',
              padding: '12px 24px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: saving ? 'default' : 'pointer',
              boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
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
            background: 'rgba(15, 23, 42, 0.45)',
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
              background: '#FFFFFF',
              border: '1px solid #FCA5A5',
              borderRadius: 20,
              maxWidth: 480,
              width: '100%',
              padding: '28px 24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Confirm Application Shutdown
            </h3>
            <p style={{ fontSize: 13.5, color: '#475569', marginTop: 8, lineHeight: 1.5 }}>
              Are you sure you want to put ClassMate into <strong>Maintenance Mode</strong>? All students and CRs will be temporarily shown the maintenance screen until you restart the application.
            </p>
            <div style={{ fontSize: 12, color: '#991B1B', marginTop: 12, background: '#FEF2F2', border: '1px solid #FECACA', padding: '10px 12px', borderRadius: 8 }}>
              Note: The admin dashboard will remain accessible to you at all times.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <button
                onClick={() => setConfirmModal(null)}
                style={{
                  background: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  color: '#0F172A',
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
                  background: '#DC2626',
                  border: 'none',
                  color: '#FFFFFF',
                  padding: '10px 18px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
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
