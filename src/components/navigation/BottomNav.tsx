import { Home as HomeIcon, User as UserIcon } from 'lucide-react';

export const NAV_H = 60;

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
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        borderTop: '1px solid var(--c-hairline, rgba(0, 0, 0, 0.07))',
        background: 'var(--c-sheet-bg, #FFFFFF)',
        zIndex: 40,
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.02)',
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
                padding: '8px 0',
              }}
            >
              <Icon
                size={22}
                color={active ? 'var(--c-text, #1E2238)' : 'var(--c-text-faint, #8E92A0)'}
                strokeWidth={active ? 2.1 : 1.75}
              />
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 11,
                  fontWeight: active ? 600 : 500,
                  color: active ? 'var(--c-text, #1E2238)' : 'var(--c-text-faint, #8E92A0)',
                  letterSpacing: '0.01em',
                }}
              >
                {it.label}
              </span>
              {it.badge && (
                <span
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 'calc(50% - 18px)',
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: 'var(--c-danger)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
