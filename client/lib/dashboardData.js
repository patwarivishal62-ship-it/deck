export const KPI_STATS = [
  { id: "projects", label: "Projects", value: "12", trend: "↑ 2 from last week" },
  { id: "tasks", label: "Tasks Completed", value: "78%", trend: "↑ 19% from last week" },
  { id: "ontrack", label: "On Track", value: "8", trend: "↑ 3 from last week" },
];

export const DASHBOARD_PROJECTS = [
  {
    id: "launch",
    title: "Product Launch Campaign",
    status: "On Track",
    progress: 68,
    tasks: 12,
    members: 3,
    due: "May 30",
    accent: "launch",
  },
  {
    id: "growth",
    title: "Growth Campaign",
    status: "On Track",
    progress: 54,
    tasks: 18,
    members: 4,
    due: "May 28",
    accent: "growth",
  },
  {
    id: "content",
    title: "Content Strategy Plan",
    status: "On Track",
    progress: 72,
    tasks: 24,
    members: 2,
    due: "May 31",
    accent: "content",
  },
];

export const DASHBOARD_TASKS = [
  { id: "t1", title: "Review ad performance", done: true, pill: "Product Launch" },
  { id: "t2", title: "Approve creative mockups", done: true, pill: "Growth Campaign" },
  { id: "t3", title: "Plan next week’s content", done: false, pill: "Content Strategy Plan" },
];
