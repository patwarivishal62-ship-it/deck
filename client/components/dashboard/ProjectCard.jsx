"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, MoreHorizontal, Rocket, BarChart2, FileText, Users } from "lucide-react";

const ACCENTS = {
  launch: {
    wrap: "bg-gradient-to-br from-[#6B5CFF] to-[#4F7BFF]",
    Icon: Rocket,
  },
  growth: {
    wrap: "bg-[#1FA67A]",
    Icon: BarChart2,
  },
  content: {
    wrap: "bg-[#E8A23D]",
    Icon: FileText,
  },
};

export default function ProjectCard({ project }) {
  const [menu, setMenu] = useState(false);
  const ref = useRef(null);
  const accent = ACCENTS[project.accent] || ACCENTS.launch;
  const Icon = accent.Icon;

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setMenu(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <article className="rounded-[14px] border border-[#E8EAF0] bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(23,32,51,0.04)] transition-shadow duration-150 hover:shadow-[0_8px_20px_rgba(23,32,51,0.06)]">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${accent.wrap}`}>
          <Icon size={16} className="text-white" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-[13.5px] font-semibold text-[#172033]">{project.title}</h3>
              <span className="mt-1 inline-flex rounded-full bg-[#E8F8EE] px-2 py-[2px] text-[10px] font-semibold text-[#22A06B]">
                {project.status}
              </span>
            </div>
            <div className="relative" ref={ref}>
              <button
                type="button"
                onClick={() => setMenu((v) => !v)}
                aria-label="Project menu"
                className="flex h-7 w-7 items-center justify-center rounded-md text-[#9AA3B5] transition-colors duration-150 hover:bg-[#F4F5F9] hover:text-[#172033]"
              >
                <MoreHorizontal size={16} />
              </button>
              {menu && (
                <div className="absolute right-0 top-8 z-20 w-36 overflow-hidden rounded-lg border border-[#E8EAF0] bg-white py-1 text-[12px] shadow-[0_8px_24px_rgba(23,32,51,0.12)]">
                  <button type="button" className="block w-full px-3 py-1.5 text-left text-[#172033] hover:bg-[#F8F9FC]" onClick={() => setMenu(false)}>
                    View
                  </button>
                  <button type="button" className="block w-full px-3 py-1.5 text-left text-[#172033] hover:bg-[#F8F9FC]" onClick={() => setMenu(false)}>
                    Edit
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-2.5 flex items-center gap-2">
            <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-[#EEF0F5]">
              <div className="h-full rounded-full bg-[#5146F5]" style={{ width: `${project.progress}%` }} />
            </div>
            <span className="w-8 text-right text-[11px] font-medium text-[#7B8498]">{project.progress}%</span>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-y-1 text-[11px] text-[#7B8498]">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <Calendar size={12} strokeWidth={1.8} />
                {project.tasks} Tasks
              </span>
              <span className="inline-flex items-center gap-1">
                <Users size={12} strokeWidth={1.8} />
                {project.members} Team Members
              </span>
            </div>
            <span>Due: {project.due}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
