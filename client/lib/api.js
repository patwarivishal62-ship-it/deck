// Thin fetch wrapper. Requests go to /api/* which Next.js rewrites to the
// Express server (see next.config.js), so cookies travel naturally.

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message = data?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export const api = {
  // auth
  signup: (body) => request("/auth/signup", { method: "POST", body }),
  login: (body) => request("/auth/login", { method: "POST", body }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me"),
  updateProfile: (body) => request("/auth/me", { method: "PATCH", body }),
  changePassword: (body) => request("/auth/change-password", { method: "POST", body }),

  // account
  requestAccountDeletion: (body) => request("/account/deletion-request", { method: "POST", body }),
  getDeletionRequest: () => request("/account/deletion-request"),

  // projects
  listProjects: () => request("/projects"),
  getProject: (id) => request(`/projects/${id}`),
  createProject: (body) => request("/projects", { method: "POST", body }),
  updateProject: (id, body) => request(`/projects/${id}`, { method: "PATCH", body }),
  deleteProject: (id) => request(`/projects/${id}`, { method: "DELETE" }),

  // goals
  createGoal: (projectId, body) => request(`/projects/${projectId}/goals`, { method: "POST", body }),
  updateGoal: (projectId, goalId, body) =>
    request(`/projects/${projectId}/goals/${goalId}`, { method: "PATCH", body }),
  nudgeGoal: (projectId, goalId, direction) =>
    request(`/projects/${projectId}/goals/${goalId}/nudge`, { method: "PATCH", body: { direction } }),
  deleteGoal: (projectId, goalId) =>
    request(`/projects/${projectId}/goals/${goalId}`, { method: "DELETE" }),

  // tasks
  createTask: (projectId, body) => request(`/projects/${projectId}/tasks`, { method: "POST", body }),
  updateTask: (projectId, taskId, body) =>
    request(`/projects/${projectId}/tasks/${taskId}`, { method: "PATCH", body }),
  cycleTaskStatus: (projectId, taskId) =>
    request(`/projects/${projectId}/tasks/${taskId}/cycle-status`, { method: "PATCH" }),
  deleteTask: (projectId, taskId) =>
    request(`/projects/${projectId}/tasks/${taskId}`, { method: "DELETE" }),
};
