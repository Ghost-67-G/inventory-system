interface StockBadgeProps {
  stock: number;
  threshold: number;
  unit: string;
  showUnit?: boolean;
}

export default function StockBadge({ stock, threshold, unit, showUnit = true }: StockBadgeProps) {
  let color = '#22c55e'; // green - in stock
  let bgColor = '#f0fdf4';
  let badge: string | null = null;

  if (stock > threshold) {
    // In stock, normal level
    color = '#22c55e';
    bgColor = '#f0fdf4';
  } else if (stock > 0 && stock <= threshold) {
    // Low stock
    color = '#eab308';
    bgColor = '#fefce8';
    badge = 'Low stock';
  } else if (stock === 0) {
    // Out of stock
    color = '#ef4444';
    bgColor = '#fef2f2';
    badge = 'Out of stock';
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          color,
          backgroundColor: bgColor,
          padding: badge ? '4px 8px' : '0',
          borderRadius: 4,
          fontSize: 13,
          fontWeight: 500,
          display: 'inline-block'
        }}
      >
        {stock} {showUnit ? unit : ''}
      </span>
      {badge && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            backgroundColor: color + '1a',
            color,
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 500
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}
