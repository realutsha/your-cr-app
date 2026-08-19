import { useState, useEffect } from 'react';

export function Toast({ message }: { message: string }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, [message]);

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        top: 18,
        zIndex: 90,
        pointerEvents: 'none',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12.5,
          fontWeight: 500,
          color: '#F4F5F7',
          background: 'var(--c-toast-bg)',
          border: '1px solid var(--c-hairline-strong)',
          borderRadius: 10,
          padding: '8px 14px',
          opacity: shown ? 1 : 0,
          transform: shown ? 'translateY(0)' : 'translateY(-6px)',
          transition: 'all 220ms ease',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}
      >
        {message}
      </div>
    </div>
  );
}
