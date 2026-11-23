const router = require('express').Router();
const { z } = require('zod');
const { query, pool } = require('../db');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');

router.use(authenticate);

const MEMBERS_SQL = `
  SELECT g.id AS group_id, u.id, u.name, u.email, (u.id = g.owner_id) AS is_owner
  FROM group_members gm
  JOIN groups g ON g.id = gm.group_id
  JOIN users u ON u.id = gm.user_id
  WHERE gm.group_id = ANY($1::int[])
  ORDER BY gm.joined_at`;

async function loadGroups(ids) {
  if (!ids.length) return [];
  const [groups, members] = await Promise.all([
    query('SELECT id, name, owner_id, created_at FROM groups WHERE id = ANY($1::int[]) ORDER BY name', [ids]),
    query(MEMBERS_SQL, [ids]),
  ]);
  return groups.rows.map((g) => ({
    id: g.id,
    name: g.name,
    ownerId: g.owner_id,
    createdAt: g.created_at,
    members: members.rows
      .filter((m) => m.group_id === g.id)
      .map((m) => ({ id: m.id, name: m.name, email: m.email, isOwner: m.is_owner })),
  }));
}

// Finds a student by email or numeric ID.
async function findStudent(identifier) {
  const id = identifier.trim();
  const { rows } = /^\d+$/.test(id)
    ? await query('SELECT * FROM users WHERE id = $1', [Number(id)])
    : await query('SELECT * FROM users WHERE email = $1', [id.toLowerCase()]);
  const user = rows[0];
  if (!user) throw new HttpError(404, `No user found for "${identifier}"`);
  if (user.role !== 'student') throw new HttpError(400, 'Only students can be added to a group');
  return user;
}

async function getOwnedGroup(groupId, userId) {
  const { rows } = await query('SELECT * FROM groups WHERE id = $1', [groupId]);
  if (!rows[0]) throw new HttpError(404, 'Group not found');
  if (rows[0].owner_id !== userId) throw new HttpError(403, 'Only the group owner can do this');
  return rows[0];
}

// Admin: all groups
router.get(
  '/',
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    const { rows } = await query('SELECT id FROM groups');
    res.json({ groups: await loadGroups(rows.map((r) => r.id)) });
  })
);

// Student: my group (or null)
router.get(
  '/me',
  requireRole('student'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT group_id FROM group_members WHERE user_id = $1', [req.user.id]);
    const [group] = await loadGroups(rows.map((r) => r.group_id));
    let requests = [];
    let joinCode = null;
    if (group && group.ownerId === req.user.id) {
      joinCode = (await query('SELECT join_code FROM groups WHERE id = $1', [group.id])).rows[0].join_code;
      const r = await query(
        `SELECT u.id, u.name, u.email FROM group_requests gr JOIN users u ON u.id = gr.user_id
         WHERE gr.group_id = $1 ORDER BY gr.created_at`,
        [group.id]
      );
      requests = r.rows;
    }
    res.json({ group: group || null, requests, joinCode });
  })
);

// Student without a group: browse existing groups and see which I've requested
router.get(
  '/available',
  requireRole('student'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT g.id, g.name, o.name AS owner_name,
         (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id)::int AS member_count,
         EXISTS (SELECT 1 FROM group_requests gr WHERE gr.group_id = g.id AND gr.user_id = $1) AS requested
       FROM groups g JOIN users o ON o.id = g.owner_id ORDER BY g.name`,
      [req.user.id]
    );
    res.json({
      groups: rows.map((r) => ({ id: r.id, name: r.name, ownerName: r.owner_name, memberCount: r.member_count, requested: r.requested })),
    });
  })
);

// Student: join instantly with a group's join code
router.post(
  '/join',
  requireRole('student'),
  validate(z.object({ code: z.string().trim().min(4).max(8) })),
  asyncHandler(async (req, res) => {
    const member = await query('SELECT 1 FROM group_members WHERE user_id = $1', [req.user.id]);
    if (member.rowCount) throw new HttpError(409, 'You are already in a group');
    const g = await query('SELECT id FROM groups WHERE join_code = $1', [req.body.code.toUpperCase()]);
    if (!g.rows[0]) throw new HttpError(404, 'Invalid join code');
    await query('INSERT INTO group_members (group_id, user_id) VALUES ($1,$2)', [g.rows[0].id, req.user.id]);
    await query('DELETE FROM group_requests WHERE user_id = $1', [req.user.id]);
    const [group] = await loadGroups([g.rows[0].id]);
    res.status(201).json({ group });
  })
);

// Owner: issue a fresh join code (invalidates the old one)
router.post(
  '/:id/join-code',
  requireRole('student'),
  asyncHandler(async (req, res) => {
    const group = await getOwnedGroup(Number(req.params.id), req.user.id);
    const r = await query("UPDATE groups SET join_code = upper(substr(md5(random()::text), 1, 6)) WHERE id = $1 RETURNING join_code", [group.id]);
    res.json({ joinCode: r.rows[0].join_code });
  })
);

// Student: request to join a group
router.post(
  '/:id/requests',
  requireRole('student'),
  asyncHandler(async (req, res) => {
    const groupId = Number(req.params.id);
    const member = await query('SELECT 1 FROM group_members WHERE user_id = $1', [req.user.id]);
    if (member.rowCount) throw new HttpError(409, 'You are already in a group');
    const g = await query('SELECT 1 FROM groups WHERE id = $1', [groupId]);
    if (!g.rowCount) throw new HttpError(404, 'Group not found');
    await query('INSERT INTO group_requests (group_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [groupId, req.user.id]);
    res.status(201).json({ requested: true });
  })
);

// Student: cancel my request
router.delete(
  '/:id/requests',
  requireRole('student'),
  asyncHandler(async (req, res) => {
    await query('DELETE FROM group_requests WHERE group_id = $1 AND user_id = $2', [Number(req.params.id), req.user.id]);
    res.status(204).end();
  })
);

// Owner: approve a request
router.post(
  '/:id/requests/:userId/approve',
  requireRole('student'),
  asyncHandler(async (req, res) => {
    const group = await getOwnedGroup(Number(req.params.id), req.user.id);
    const uid = Number(req.params.userId);
    const pending = await query('SELECT 1 FROM group_requests WHERE group_id = $1 AND user_id = $2', [group.id, uid]);
    if (!pending.rowCount) throw new HttpError(404, 'No such request');
    const taken = await query('SELECT 1 FROM group_members WHERE user_id = $1', [uid]);
    if (taken.rowCount) {
      await query('DELETE FROM group_requests WHERE user_id = $1', [uid]);
      throw new HttpError(409, 'That student has already joined another group');
    }
    await query('INSERT INTO group_members (group_id, user_id) VALUES ($1,$2)', [group.id, uid]);
    await query('DELETE FROM group_requests WHERE user_id = $1', [uid]);
    res.status(204).end();
  })
);

// Owner: reject a request
router.delete(
  '/:id/requests/:userId',
  requireRole('student'),
  asyncHandler(async (req, res) => {
    const group = await getOwnedGroup(Number(req.params.id), req.user.id);
    await query('DELETE FROM group_requests WHERE group_id = $1 AND user_id = $2', [group.id, Number(req.params.userId)]);
    res.status(204).end();
  })
);

const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  members: z.array(z.string().trim().min(1)).max(10).default([]),
});

// Student: create a group (creator becomes owner) and optionally add members
router.post(
  '/',
  requireRole('student'),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const { name, members } = req.body;
    const already = await query('SELECT 1 FROM group_members WHERE user_id = $1', [req.user.id]);
    if (already.rowCount) throw new HttpError(409, 'You are already in a group');

    const users = [];
    for (const ident of members) {
      const u = await findStudent(ident);
      if (u.id === req.user.id || users.some((x) => x.id === u.id)) continue;
      const taken = await query('SELECT 1 FROM group_members WHERE user_id = $1', [u.id]);
      if (taken.rowCount) throw new HttpError(409, `${u.name} is already in another group`);
      users.push(u);
    }

    const client = await pool.connect();
    let groupId;
    try {
      await client.query('BEGIN');
      const g = await client.query('INSERT INTO groups (name, owner_id) VALUES ($1,$2) RETURNING id', [
        name,
        req.user.id,
      ]);
      groupId = g.rows[0].id;
      for (const uid of [req.user.id, ...users.map((u) => u.id)]) {
        await client.query('INSERT INTO group_members (group_id, user_id) VALUES ($1,$2)', [groupId, uid]);
      }
      await client.query('DELETE FROM group_requests WHERE user_id = ANY($1::int[])', [[req.user.id, ...users.map((u) => u.id)]]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') throw new HttpError(409, 'A group with that name already exists');
      throw err;
    } finally {
      client.release();
    }
    const [group] = await loadGroups([groupId]);
    res.status(201).json({ group });
  })
);

const addSchema = z.object({ identifier: z.string().trim().min(1) });

// Owner: add a member by email or student ID
router.post(
  '/:id/members',
  requireRole('student'),
  validate(addSchema),
  asyncHandler(async (req, res) => {
    const group = await getOwnedGroup(Number(req.params.id), req.user.id);
    const user = await findStudent(req.body.identifier);
    const taken = await query('SELECT 1 FROM group_members WHERE user_id = $1', [user.id]);
    if (taken.rowCount) throw new HttpError(409, `${user.name} is already in a group`);
    await query('INSERT INTO group_members (group_id, user_id) VALUES ($1,$2)', [group.id, user.id]);
    await query('DELETE FROM group_requests WHERE user_id = $1', [user.id]);
    const [updated] = await loadGroups([group.id]);
    res.status(201).json({ group: updated });
  })
);

// Owner removes a member / a member leaves
router.delete(
  '/:id/members/:userId',
  requireRole('student'),
  asyncHandler(async (req, res) => {
    const groupId = Number(req.params.id);
    const targetId = Number(req.params.userId);
    const { rows } = await query('SELECT * FROM groups WHERE id = $1', [groupId]);
    const group = rows[0];
    if (!group) throw new HttpError(404, 'Group not found');
    if (targetId === group.owner_id) {
      throw new HttpError(400, 'The owner cannot be removed. Delete the group instead.');
    }
    if (req.user.id !== group.owner_id && req.user.id !== targetId) {
      throw new HttpError(403, 'Not allowed');
    }
    const del = await query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, targetId]);
    if (!del.rowCount) throw new HttpError(404, 'Member not in group');
    res.status(204).end();
  })
);

// Owner deletes the group
router.delete(
  '/:id',
  requireRole('student'),
  asyncHandler(async (req, res) => {
    const group = await getOwnedGroup(Number(req.params.id), req.user.id);
    await query('DELETE FROM groups WHERE id = $1', [group.id]);
    res.status(204).end();
  })
);

module.exports = router;
