// Small 7-day line chart for the stat cards on the Slot Capacity screen (plain SVG, no chart library).
// Step B4b: new file. It draws the numbers it is given; a flat line means the value did not change over the 7 days.

export function AdminSlotCapacitySparkline({ values, label }: { values: number[]; label: string }) {
  const W = 100;
  const H = 36;
  const PAD = 3;
  const n = values.length;
  if (n < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const points = values.map((v, i) => {
    const x = (i / (n - 1)) * W;
    const y = span === 0 ? H / 2 : H - PAD - ((v - min) / span) * (H - PAD * 2);
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p}`).join(' ');
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  const gradientId = `slot-spark-${label.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label} className="h-9 w-full">
        <title>{label}</title>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a3e635" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#a3e635" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke="#a3e635" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <p className="text-right text-[10px] text-white/30">Last 7 days</p>
    </div>
  );
}
