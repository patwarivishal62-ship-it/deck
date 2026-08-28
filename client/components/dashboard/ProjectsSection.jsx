import ProjectCard from "./ProjectCard";
import { DASHBOARD_PROJECTS } from "@/lib/dashboardData";

export default function ProjectsSection() {
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-[14px] font-semibold text-[#172033]">Projects</h2>
      <div className="flex flex-col gap-2.5">
        {DASHBOARD_PROJECTS.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  );
}
