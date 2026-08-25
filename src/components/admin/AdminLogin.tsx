import React, { useState } from 'react';
import { auth, googleProvider, signInWithPopup, signInWithRedirect, firebaseSignOut } from '../../lib/firebase';
import { adminApi } from '../../lib/adminApi';

interface AdminLoginProps {
  onSuccess: () => void;
  onGoToApp: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess, onGoToApp }) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [attemptedEmail, setAttemptedEmail] = useState<string | null>(null);

  const handleAdminSignIn = async (useRedirect = false) => {
    setErrorMsg(null);
    setIsAccessDenied(false);
    setLoading(true);

    if (!auth) {
      setLoading(false);
      setErrorMsg('Firebase Authentication is not configured.');
      return;
    }

    try {
      if (useRedirect) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }

      const cred = await signInWithPopup(auth, googleProvider);
      const email = cred.user.email || '';
      setAttemptedEmail(email);

      // Verify server-side authorization
      const verifyRes = await adminApi.verifyAdmin();
      if (!verifyRes.authorized) {
        setIsAccessDenied(true);
        setErrorMsg(verifyRes.error || 'Access Denied: You do not have administrator permissions.');
        await firebaseSignOut(auth).catch(() => {});
        setLoading(false);
        return;
      }

      setLoading(false);
      onSuccess();
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || 'Failed to authenticate.');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0B0D14',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: '#121624',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          padding: '36px 32px',
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        }}
      >
        {/* Shield Icon & Title */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))',
              border: '1px solid rgba(129,140,248,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: '#818CF8', marginBottom: 6 }}>
            ClassMate Admin Control
          </div>
          <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 22, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
            Administrator Access
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 8, lineHeight: 1.5 }}>
            Restricted area. Please sign in with your authorized administrator Google account.
          </p>
        </div>

        {/* Error / Access Denied Banner */}
        {errorMsg && (
          <div
            style={{
              background: isAccessDenied ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
              border: `1px solid ${isAccessDenied ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
              borderRadius: 12,
              padding: '14px 16px',
              marginBottom: 24,
              fontSize: 13,
              color: isAccessDenied ? '#FCA5A5' : '#FCD34D',
              lineHeight: 1.45,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              {isAccessDenied ? '🚫 Access Denied' : 'Authentication Error'}
            </div>
            <div>{errorMsg}</div>
            {attemptedEmail && (
              <div style={{ marginTop: 6, fontSize: 11.5, opacity: 0.85 }}>
                Account: <strong>{attemptedEmail}</strong>
              </div>
            )}
          </div>
        )}

        {/* Sign In Button */}
        <button
          onClick={() => handleAdminSignIn(false)}
          disabled={loading}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            background: '#1E2438',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 12,
            padding: '14px 18px',
            fontSize: 14,
            fontWeight: 600,
            color: '#FFFFFF',
            cursor: loading ? 'default' : 'pointer',
            transition: 'background 160ms ease, transform 100ms ease',
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 16,
                  height: 16,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#818CF8',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <span>Verifying authorization...</span>
            </div>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.94 0 12s.45 3.84 1.25 5.42l4.03-3.15z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
              </svg>
              <span>Sign in with Google Admin</span>
            </>
          )}
        </button>

        {/* Fallback Redirect */}
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button
            onClick={() => handleAdminSignIn(true)}
            disabled={loading}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.4)',
              fontSize: 12,
              cursor: loading ? 'default' : 'pointer',
              textDecoration: 'underline',
            }}
          >
            Trouble with popups? Use redirect sign-in
          </button>
        </div>

        {/* Return to Main App */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 28, paddingTop: 20, textAlign: 'center' }}>
          <button
            onClick={onGoToApp}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#818CF8',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>&larr; Back to ClassMate Student App</span>
          </button>
        </div>
      </div>
    </div>
  );
};
