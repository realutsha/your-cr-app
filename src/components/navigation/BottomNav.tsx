import { Home as HomeIcon, User as UserIcon } from 'lucide-react';

export const NAV_H = 58;

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
        borderTop: '1px solid var(--c-hairline)',
        background: 'var(--c-sheet-bg)',
        zIndex: 40,
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
                gap: 3,
                position: 'relative',
              }}
            >
              <Icon
                size={20}
                color={active ? 'var(--c-accent)' : 'var(--c-text-faint)'}
                strokeWidth={1.8}
              />
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 10.5,
                  fontWeight: 500,
                  color: active ? 'var(--c-accent)' : 'var(--c-text-faint)',
                }}
              >
                {it.label}
              </span>
              {it.badge && (
                <span
                  style={{
                    position: 'absolute',
                    top: 6,
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
