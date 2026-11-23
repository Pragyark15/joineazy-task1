const TOKEN_KEY = 'joineazy_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// Thin fetch wrapper: attaches the JWT, parses JSON, throws Error(message) on non-2xx.
async function request(path, { method = 'GET', body } = {}) {
  const token = tokenStore.get();
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  // auth
  register: (b) => request('/auth/register', { method: 'POST', body: b }),
  login: (b) => request('/auth/login', { method: 'POST', body: b }),
  me: () => request('/auth/me'),
  // groups
  myGroup: () => request('/groups/me'),
  allGroups: () => request('/groups'),
  createGroup: (b) => request('/groups', { method: 'POST', body: b }),
  addMember: (gid, identifier) => request(`/groups/${gid}/members`, { method: 'POST', body: { identifier } }),
  removeMember: (gid, uid) => request(`/groups/${gid}/members/${uid}`, { method: 'DELETE' }),
  deleteGroup: (gid) => request(`/groups/${gid}`, { method: 'DELETE' }),
  // assignments
  assignments: () => request('/assignments'),
  assignment: (id) => request(`/assignments/${id}`),
  createAssignment: (b) => request('/assignments', { method: 'POST', body: b }),
  updateAssignment: (id, b) => request(`/assignments/${id}`, { method: 'PUT', body: b }),
  deleteAssignment: (id) => request(`/assignments/${id}`, { method: 'DELETE' }),
  confirm: (id) => request(`/assignments/${id}/confirm`, { method: 'POST', body: { confirmed: true } }),
  // analytics
  analytics: () => request('/analytics'),
};
