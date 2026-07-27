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
  forgotPassword: (body) => request("/auth/forgot-password", { method: "POST", body }),
  resetPassword: (body) => request("/auth/reset-password", { method: "POST", body }),

  // account
  deleteAccount: (body) => request("/account/me", { method: "DELETE", body }),

  // workspaces
  listWorkspaces: () => request("/workspaces"),
  createWorkspace: (body) => request("/workspaces", { method: "POST", body }),
  listMembers: (workspaceId) => request(`/workspaces/${workspaceId}/members`),
  inviteMember: (workspaceId, body) => request(`/workspaces/${workspaceId}/invite`, { method: "POST", body }),
  updateMemberRole: (workspaceId, membershipId, role) =>
    request(`/workspaces/${workspaceId}/members/${membershipId}`, { method: "PATCH", body: { role } }),
  removeMember: (workspaceId, membershipId) =>
    request(`/workspaces/${workspaceId}/members/${membershipId}`, { method: "DELETE" }),
  previewInvite: (token) => request(`/workspaces/invites/preview?token=${encodeURIComponent(token)}`),
  acceptInvite: (token) => request("/workspaces/invites/accept", { method: "POST", body: { token } }),

  // projects
  listProjects: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.tags && params.tags.length) query.set("tags", params.tags.join(","));
    if (params.priority) query.set("priority", params.priority);
    if (params.archived !== undefined) query.set("archived", String(params.archived));
    if (params.sort) query.set("sort", params.sort);
    const qs = query.toString();
    return request(`/projects${qs ? `?${qs}` : ""}`);
  },
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
