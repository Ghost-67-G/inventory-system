interface CategoryBadgeProps {
  name: string;
  color: string;
  size?: 'sm' | 'md';
}

const FALLBACK_COLOR = '#6366f1';

/** Returns a ~15% alpha tint of a hex color; works for #rgb and #rrggbb, falls back to a neutral tint otherwise. */
function tint(color: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return `${color}26`;
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const [r, g, b] = color.slice(1).split('');
    return `#${r}${r}${g}${g}${b}${b}26`;
  }
  return 'color-mix(in srgb, currentColor 15%, transparent)';
}

export default function CategoryBadge({ name, color, size = 'md' }: CategoryBadgeProps) {
  const dotSize = size === 'sm' ? 6 : 8;
  const fontSize = size === 'sm' ? 11 : 13;
  const safeColor = color || FALLBACK_COLOR;
  const bg = tint(safeColor);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        backgroundColor: bg,
        color: safeColor,
        padding: '2px 8px',
        borderRadius: 9999,
        fontSize,
        fontWeight: 500,
        lineHeight: 1.4,
        maxWidth: '100%'
      }}
      title={name}
    >
      <span
        style={{
          display: 'inline-block',
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          backgroundColor: safeColor,
          flexShrink: 0
        }}
      />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
    </span>
  );
}
