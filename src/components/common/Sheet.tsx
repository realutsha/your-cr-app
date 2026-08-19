import React, { useState, useEffect } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function Sheet({ open, onClose, children }: SheetProps) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let raf1: number;
    let raf2: number;
    let timer: ReturnType<typeof setTimeout>;

    if (open) {
      setMounted(true);
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setShown(true));
      });
    } else {
      setShown(false);
      timer = setTimeout(() => setMounted(false), 280);
    }
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(timer);
    };
  }, [open]);

  if (!mounted) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--c-backdrop)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          opacity: shown ? 1 : 0,
          transition: 'opacity 260ms ease',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: '88vh',
          margin: '0 auto',
          maxWidth: 480,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--c-sheet-bg)',
          borderTop: '1px solid var(--c-hairline-strong)',
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
          transform: shown ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 6 }}>
          <div style={{ width: 34, height: 4, borderRadius: 999, background: 'var(--c-hairline-strong)' }} />
        </div>
        <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>{children}</div>
      </div>
    </div>
  );
}
