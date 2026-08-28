import StatCard from "./StatCard";
import { KPI_STATS } from "@/lib/dashboardData";

export default function StatsGrid() {
  return (
    <section className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {KPI_STATS.map((stat) => (
        <StatCard key={stat.id} {...stat} />
      ))}
    </section>
  );
}
