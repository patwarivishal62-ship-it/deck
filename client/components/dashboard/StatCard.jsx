export default function StatCard({ label, value, trend }) {
  return (
    <article className="rounded-[14px] border border-[#E8EAF0] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(23,32,51,0.04)]">
      <p className="text-[11px] font-medium text-[#7B8498]">{label}</p>
      <p className="mt-1.5 text-[26px] font-bold leading-none tracking-tight text-[#172033]">{value}</p>
      {trend ? <p className="mt-2 text-[11px] font-medium text-[#22A06B]">{trend}</p> : null}
    </article>
  );
}
