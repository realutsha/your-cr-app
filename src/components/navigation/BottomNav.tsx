import { Home as HomeIcon, User as UserIcon } from 'lucide-react';

export const NAV_H = 64;

interface BottomNavProps {
  screen: 'home' | 'profile';
  setScreen: (screen: 'home' | 'profile') => void;
  unreadCount: number;
}

export function BottomNav({ screen, setScreen, unreadCount }: BottomNavProps) {
  const items = [
    { key: 'home' as const, label: 'Home', icon: HomeIcon, badge: unreadCount > 0 },
    { key: 'profile' as const, label: 'Profile', icon: UserIcon, badge: false },
  ];

  return (
    <nav
      aria-label="Bottom Navigation"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        borderTop: '1px solid var(--c-hairline)',
        background: 'var(--c-sheet-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 40,
        boxShadow: '0 -1px 8px rgba(0, 0, 0, 0.04)',
        transition: 'background 220ms ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          margin: '0 auto',
          maxWidth: 480,
          height: NAV_H,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {items.map((it) => {
          const active = screen === it.key;
          const Icon = it.icon;
          return (
            <button
              key={it.key}
              onClick={() => setScreen(it.key)}
              style={{
                flex: 1,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                position: 'relative',
                background: 'transparent',
                border: 'none',
                padding: '6px 0',
                transition: 'color 150ms ease',
              }}
            >
              <Icon
                size={22}
                color={active ? 'var(--c-accent)' : 'var(--c-text-faint)'}
                strokeWidth={active ? 2.4 : 1.8}
              />
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 11,
                  fontWeight: active ? 600 : 500,
                  color: active ? 'var(--c-accent)' : 'var(--c-text-faint)',
                  letterSpacing: '0.01em',
                }}
              >
                {it.label}
              </span>
              {it.badge && (
                <span
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 'calc(50% - 16px)',
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    background: 'var(--c-danger)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
