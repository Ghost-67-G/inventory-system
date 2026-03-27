interface CategoryBadgeProps {
  name: string;
  color: string;
  size?: 'sm' | 'md';
}

export default function CategoryBadge({ name, color, size = 'md' }: CategoryBadgeProps) {
  const dotSize = size === 'sm' ? 6 : 8;
  const fontSize = size === 'sm' ? 11 : 13;
  const bg = `${color}26`;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        backgroundColor: bg,
        color: color,
        padding: '2px 8px',
        borderRadius: 9999,
        fontSize,
        fontWeight: 500,
        lineHeight: 1.4
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          backgroundColor: color,
          flexShrink: 0
        }}
      />
      {name}
    </span>
  );
}
