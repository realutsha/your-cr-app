import { useState } from 'react';
import { store } from '../../lib/store';
import { AlertTriangle, RefreshCw, Radio } from 'lucide-react';

interface MaintenanceScreenProps {
  message?: string;
}

export function MaintenanceScreen({ message }: MaintenanceScreenProps) {
  const [checking, setChecking] = useState(false);

  const defaultMsg =
    'Class Mate is temporarily unavailable for maintenance. Please check back shortly.';
  const displayMsg = (message || '').trim() || defaultMsg;

  const handleRefresh = async () => {
    setChecking(true);
    try {
      await store.checkSystemStatusNow();
    } finally {
      setTimeout(() => setChecking(false), 800);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: '#0a0f1d',
        color: '#f1f5f9',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          maxWidth: '460px',
          width: '100%',
          backgroundColor: '#111827',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '20px',
          padding: '32px 24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Status Pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '9999px',
            padding: '4px 12px',
            fontSize: '11px',
            fontWeight: 600,
            color: '#f87171',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '20px',
          }}
        >
          <Radio size={14} className="animate-pulse" />
          <span>System Maintenance</span>
        </div>

        {/* Brand Icon */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444',
            marginBottom: '16px',
          }}
        >
          <AlertTriangle size={32} />
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: '20px',
            fontWeight: 700,
            color: '#f8fafc',
            margin: '0 0 8px 0',
          }}
        >
          Temporarily Unavailable
        </h1>

        <p
          style={{
            fontSize: '13px',
            color: '#94a3b8',
            margin: '0 0 20px 0',
            lineHeight: 1.5,
          }}
        >
          Class Mate is undergoing scheduled improvements or operational maintenance.
        </p>

        {/* Admin Message Box */}
        <div
          style={{
            width: '100%',
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(148, 163, 184, 0.1)',
            borderRadius: '12px',
            padding: '14px 16px',
            marginBottom: '24px',
            textAlign: 'left',
          }}
        >
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#818cf8',
              display: 'block',
              marginBottom: '4px',
            }}
          >
            Notice from Administrator:
          </span>
          <p
            style={{
              fontSize: '13px',
              color: '#e2e8f0',
              margin: 0,
              lineHeight: 1.5,
              fontStyle: 'italic',
            }}
          >
            "{displayMsg}"
          </p>
        </div>

        {/* Refresh Button */}
        <button
          onClick={handleRefresh}
          disabled={checking}
          style={{
            width: '100%',
            padding: '12px 16px',
            backgroundColor: '#4f46e5',
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: checking ? 'not-allowed' : 'pointer',
            opacity: checking ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
            transition: 'all 0.15s ease',
          }}
        >
          <RefreshCw size={15} style={{ animation: checking ? 'spin 1s linear infinite' : 'none' }} />
          <span>{checking ? 'Checking Status...' : 'Check Availability'}</span>
        </button>

        <span
          style={{
            fontSize: '11px',
            color: '#64748b',
            marginTop: '16px',
          }}
        >
          Normal service will resume immediately once maintenance completes.
        </span>
      </div>
    </div>
  );
}