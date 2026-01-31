import './Gauge.css';

interface GaugeProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  unit?: string;
  showValue?: boolean;
  thresholds?: {
    warning: number;
    danger: number;
  };
}

export function Gauge({
  value,
  max = 100,
  size = 'md',
  label,
  unit = '%',
  showValue = true,
  thresholds = { warning: 70, danger: 90 },
}: GaugeProps) {
  const percentage = Math.min((value / max) * 100, 100);
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Determine color based on thresholds
  let colorClass = 'gauge--normal';
  if (percentage >= thresholds.danger) {
    colorClass = 'gauge--danger';
  } else if (percentage >= thresholds.warning) {
    colorClass = 'gauge--warning';
  }

  const displayValue = max === 100 ? Math.round(value) : value.toFixed(1);

  return (
    <div className={`gauge gauge--${size} ${colorClass}`}>
      <svg viewBox="0 0 100 100" className="gauge-svg">
        {/* Background track */}
        <circle
          className="gauge-track"
          cx="50"
          cy="50"
          r="45"
          fill="none"
          strokeWidth="8"
        />
        {/* Tick marks */}
        {[0, 25, 50, 75, 100].map((tick) => {
          const angle = (tick / 100) * 270 - 135; // -135 to 135 degrees
          const rad = (angle * Math.PI) / 180;
          const innerR = 38;
          const outerR = 42;
          return (
            <line
              key={tick}
              className="gauge-tick"
              x1={50 + innerR * Math.cos(rad)}
              y1={50 + innerR * Math.sin(rad)}
              x2={50 + outerR * Math.cos(rad)}
              y2={50 + outerR * Math.sin(rad)}
              strokeWidth="2"
            />
          );
        })}
        {/* Value arc */}
        <circle
          className="gauge-value"
          cx="50"
          cy="50"
          r="45"
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 50 50)"
          style={{
            '--gauge-circumference': circumference,
            '--gauge-offset': strokeDashoffset,
          } as React.CSSProperties}
        />
      </svg>
      {showValue && (
        <div className="gauge-center">
          <span className="gauge-value-text">{displayValue}</span>
          <span className="gauge-unit">{unit}</span>
        </div>
      )}
      {label && <div className="gauge-label">{label}</div>}
    </div>
  );
}
