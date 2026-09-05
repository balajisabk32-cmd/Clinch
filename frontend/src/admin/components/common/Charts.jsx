import React from 'react';

export function BarChart({ data, height = 230, prefix = '$' }) {
  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const chartHeight = height - 50;

  return (
    <div className="chart-container" style={{ width: '100%', height }}>
      <svg width="100%" height={height} viewBox={`0 0 500 ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map((p, idx) => {
          const y = chartHeight * (1 - p) + 15;
          return (
            <line
              key={idx}
              x1="40"
              y1={y}
              x2="490"
              y2={y}
              stroke="var(--border-color)"
              strokeDasharray="4,4"
              strokeOpacity="0.6"
            />
          );
        })}

        {/* Bars */}
        {data.map((item, idx) => {
          const barWidth = 60;
          const spacing = (450 - data.length * barWidth) / (data.length + 1);
          const x = 40 + spacing + idx * (barWidth + spacing);
          const barH = (item.value / maxVal) * (chartHeight - 15);
          const y = chartHeight + 15 - barH;

          return (
            <g key={idx}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx="4"
                fill="url(#barGrad)"
              />
              <text
                x={x + barWidth / 2}
                y={y - 6}
                textAnchor="middle"
                fill="var(--text-primary)"
                fontSize="11"
                fontWeight="600"
              >
                {prefix}{(item.value >= 1000000 ? (item.value / 1000000).toFixed(1) + 'M' : (item.value / 1000).toFixed(0) + 'k')}
              </text>
              <text
                x={x + barWidth / 2}
                y={chartHeight + 35}
                textAnchor="middle"
                fill="var(--text-muted)"
                fontSize="11"
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function LineChart({ data, height = 230, suffix = 'h', color = '#38bdf8' }) {
  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const minVal = Math.min(...data.map(d => d.value), 0);
  const chartHeight = height - 50;

  const points = data.map((d, i) => {
    const x = 40 + (i / (data.length - 1)) * 440;
    const y = 20 + (1 - (d.value - minVal) / (maxVal - minVal || 1)) * (chartHeight - 20);
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${chartHeight + 20} L ${points[0].x} ${chartHeight + 20} Z`;

  return (
    <div className="chart-container" style={{ width: '100%', height }}>
      <svg width="100%" height={height} viewBox={`0 0 500 ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.33, 0.66, 1].map((p, idx) => {
          const y = 20 + p * (chartHeight - 20);
          return (
            <line
              key={idx}
              x1="40"
              y1={y}
              x2="480"
              y2={y}
              stroke="var(--border-color)"
              strokeDasharray="4,4"
              strokeOpacity="0.6"
            />
          );
        })}

        {/* Area fill */}
        <path d={areaD} fill="url(#lineGrad)" />

        {/* Line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />

        {/* Points & Labels */}
        {points.map((p, idx) => (
          <g key={idx}>
            <circle cx={p.x} cy={p.y} r="4.5" fill="var(--bg-card)" stroke={color} strokeWidth="2.5" />
            <text
              x={p.x}
              y={p.y - 10}
              textAnchor="middle"
              fill="var(--text-primary)"
              fontSize="11"
              fontWeight="700"
            >
              {p.value}{suffix}
            </text>
            <text
              x={p.x}
              y={chartHeight + 35}
              textAnchor="middle"
              fill="var(--text-muted)"
              fontSize="11"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
