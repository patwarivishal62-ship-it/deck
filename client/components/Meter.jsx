export default function Meter({ value, target, color = "#7C5CFF" }) {
  const pct = target > 0 ? Math.min(100, Math.max(0, (value / target) * 100)) : 0;
  return (
    <div className="meter" role="progressbar" aria-valuenow={value} aria-valuemax={target}>
      <div className="meter-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}
