export function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) {
    return (
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12.5,
          color: 'var(--c-text-faint)',
        }}
      >
        0
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: 'var(--c-danger)',
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12.5,
          fontWeight: 700,
          color: 'var(--c-danger)',
        }}
      >
        {count}
      </span>
    </div>
  );
}
