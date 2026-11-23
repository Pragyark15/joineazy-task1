// End-to-end API test. Requires a reachable Postgres (DATABASE_URL). Uses unique emails per run.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const { migrate, waitForDb, pool } = require('../src/db');
const config = require('../src/config');

let server, base;
const run = Date.now();
const email = (n) => `${n}.${run}@test.com`;

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

before(async () => {
  await waitForDb();
  await migrate();
  server = app.listen(0);
  base = `http://localhost:${server.address().port}`;
});

after(async () => {
  server.close();
  await pool.end();
});

test('full flow: groups, assignments, two-step confirmation, analytics', async () => {
  // --- auth ---
  const bad = await api('/api/auth/register', {
    method: 'POST',
    body: { name: 'Fake Prof', email: email('fake'), password: 'secret123', role: 'admin', adminCode: 'wrong' },
  });
  assert.equal(bad.status, 403, 'admin signup needs the correct code');

  const prof = await api('/api/auth/register', {
    method: 'POST',
    body: { name: 'Prof T', email: email('prof'), password: 'secret123', role: 'admin', adminCode: config.adminSignupCode },
  });
  assert.equal(prof.status, 201);
  const p = prof.data.token;

  const s1 = (await api('/api/auth/register', { method: 'POST', body: { name: 'Stu One', email: email('s1'), password: 'secret123' } })).data;
  const s2 = (await api('/api/auth/register', { method: 'POST', body: { name: 'Stu Two', email: email('s2'), password: 'secret123' } })).data;
  assert.equal(s1.user.role, 'student');

  const login = await api('/api/auth/login', { method: 'POST', body: { email: email('s1'), password: 'nope' } });
  assert.equal(login.status, 401);

  // --- groups ---
  const g = await api('/api/groups', { method: 'POST', token: s1.token, body: { name: `G-${run}`, members: [email('s2')] } });
  assert.equal(g.status, 201);
  assert.equal(g.data.group.members.length, 2);
  const groupId = g.data.group.id;

  const dup = await api('/api/groups', { method: 'POST', token: s2.token, body: { name: `G2-${run}` } });
  assert.equal(dup.status, 409, 'a student can be in only one group');

  const notOwner = await api(`/api/groups/${groupId}/members`, { method: 'POST', token: s2.token, body: { identifier: 'x@y.com' } });
  assert.equal(notOwner.status, 403);

  // --- assignments ---
  const forbidden = await api('/api/assignments', { method: 'POST', token: s1.token, body: {} });
  assert.equal(forbidden.status, 403, 'students cannot create assignments');

  const a = await api('/api/assignments', {
    method: 'POST',
    token: p,
    body: { title: `HW ${run}`, description: 'd', dueDate: new Date(Date.now() + 864e5).toISOString(), onedriveLink: 'https://onedrive.live.com/x', assignToAll: false, groupIds: [groupId] },
  });
  assert.equal(a.status, 201);
  const aid = a.data.assignment.id;

  const invalid = await api('/api/assignments', { method: 'POST', token: p, body: { title: 'x', dueDate: 'nope', onedriveLink: 'bad' } });
  assert.equal(invalid.status, 400);

  const list = await api('/api/assignments', { token: s1.token });
  assert.ok(list.data.assignments.some((x) => x.id === aid));
  assert.equal(list.data.assignments.find((x) => x.id === aid).submitted, false);

  // --- confirmation requires explicit confirm flag, then is idempotent-safe ---
  const noFlag = await api(`/api/assignments/${aid}/confirm`, { method: 'POST', token: s2.token, body: {} });
  assert.equal(noFlag.status, 400);
  const ok = await api(`/api/assignments/${aid}/confirm`, { method: 'POST', token: s2.token, body: { confirmed: true } });
  assert.equal(ok.status, 201);
  const again = await api(`/api/assignments/${aid}/confirm`, { method: 'POST', token: s1.token, body: { confirmed: true } });
  assert.equal(again.status, 409, 'group confirms once');

  const afterList = await api('/api/assignments', { token: s1.token });
  const mine = afterList.data.assignments.find((x) => x.id === aid);
  assert.ok(mine.submitted);
  assert.equal(mine.confirmedBy, 'Stu Two');
  assert.ok(afterList.data.progress.submitted >= 1);

  // --- admin views ---
  const detail = await api(`/api/assignments/${aid}`, { token: p });
  assert.equal(detail.data.groups.length, 1);
  assert.equal(detail.data.students.length, 2);
  assert.ok(detail.data.groups[0].submitted);

  const an = await api('/api/analytics', { token: p });
  assert.equal(an.status, 200);
  assert.ok(an.data.summary.groups >= 1);
  assert.equal((await api('/api/analytics', { token: s1.token })).status, 403);

  // --- unassigned group does not see it ---
  const s3 = (await api('/api/auth/register', { method: 'POST', body: { name: 'Stu Three', email: email('s3'), password: 'secret123' } })).data;
  await api('/api/groups', { method: 'POST', token: s3.token, body: { name: `G3-${run}` } });
  const l3 = await api('/api/assignments', { token: s3.token });
  assert.ok(!l3.data.assignments.some((x) => x.id === aid), 'targeted assignment hidden from other groups');

  // --- update + delete ---
  const upd = await api(`/api/assignments/${aid}`, {
    method: 'PUT', token: p,
    body: { title: 'HW edited', description: '', dueDate: new Date(Date.now() + 2 * 864e5).toISOString(), onedriveLink: 'https://onedrive.live.com/y', assignToAll: true, groupIds: [] },
  });
  assert.equal(upd.status, 200);
  assert.equal((await api(`/api/assignments/${aid}`, { method: 'DELETE', token: p })).status, 204);

  assert.equal((await api('/api/assignments')).status, 401);
});
