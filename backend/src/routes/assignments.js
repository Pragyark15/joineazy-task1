const router = require('express').Router();
const { z } = require('zod');
const { query, pool } = require('../db');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');

router.use(authenticate);

const assignmentSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().max(5000).default(''),
    dueDate: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date'),
    onedriveLink: z.string().trim().url('Must be a valid URL').max(2000),
    assignToAll: z.boolean().default(true),
    groupIds: z.array(z.number().int()).default([]),
  })
  .refine((d) => d.assignToAll || d.groupIds.length > 0, {
    message: 'Select at least one group or assign to all',
    path: ['groupIds'],
  });

const fmt = (a) => ({
  id: a.id,
  title: a.title,
  description: a.description,
  dueDate: a.due_date,
  onedriveLink: a.onedrive_link,
  assignToAll: a.assign_to_all,
  createdAt: a.created_at,
});

async function saveTargets(client, assignmentId, assignToAll, groupIds) {
  await client.query('DELETE FROM assignment_groups WHERE assignment_id = $1', [assignmentId]);
  if (assignToAll) return;
  const valid = await client.query('SELECT id FROM groups WHERE id = ANY($1::int[])', [groupIds]);
  for (const g of valid.rows) {
    await client.query('INSERT INTO assignment_groups (assignment_id, group_id) VALUES ($1,$2)', [
      assignmentId,
      g.id,
    ]);
  }
}

// ---------- list (role-aware) ----------
router.get(
  '/',
  asyncHandler(async (req, res) => {
    if (req.user.role === 'admin') {
      const { rows } = await query(`
        SELECT a.*,
          (SELECT COUNT(*) FROM groups g WHERE a.assign_to_all
             OR EXISTS (SELECT 1 FROM assignment_groups ag WHERE ag.assignment_id = a.id AND ag.group_id = g.id))::int AS target_groups,
          (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id)::int AS submitted_groups
        FROM assignments a ORDER BY a.due_date ASC`);
      return res.json({
        assignments: rows.map((r) => ({
          ...fmt(r),
          targetGroups: r.target_groups,
          submittedGroups: r.submitted_groups,
        })),
      });
    }

    const gm = await query('SELECT group_id FROM group_members WHERE user_id = $1', [req.user.id]);
    const groupId = gm.rows[0]?.group_id ?? null;
    const { rows } = await query(
      `SELECT a.*, s.confirmed_at, u.name AS confirmed_by_name
       FROM assignments a
       LEFT JOIN submissions s ON s.assignment_id = a.id AND s.group_id = $1
       LEFT JOIN users u ON u.id = s.confirmed_by
       WHERE a.assign_to_all
          OR EXISTS (SELECT 1 FROM assignment_groups ag WHERE ag.assignment_id = a.id AND ag.group_id = $1)
       ORDER BY a.due_date ASC`,
      [groupId]
    );
    const assignments = rows.map((r) => ({
      ...fmt(r),
      submitted: !!r.confirmed_at,
      confirmedAt: r.confirmed_at,
      confirmedBy: r.confirmed_by_name,
    }));
    const done = assignments.filter((a) => a.submitted).length;
    res.json({
      assignments,
      hasGroup: groupId !== null,
      progress: {
        total: assignments.length,
        submitted: done,
        percent: assignments.length ? Math.round((done / assignments.length) * 100) : 0,
      },
    });
  })
);

// ---------- create / update / delete (admin) ----------
async function upsert(req, res, id) {
  const d = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let row;
    if (id) {
      const r = await client.query(
        `UPDATE assignments SET title=$1, description=$2, due_date=$3, onedrive_link=$4, assign_to_all=$5
         WHERE id=$6 RETURNING *`,
        [d.title, d.description, d.dueDate, d.onedriveLink, d.assignToAll, id]
      );
      if (!r.rowCount) throw new HttpError(404, 'Assignment not found');
      row = r.rows[0];
    } else {
      const r = await client.query(
        `INSERT INTO assignments (title, description, due_date, onedrive_link, assign_to_all, created_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [d.title, d.description, d.dueDate, d.onedriveLink, d.assignToAll, req.user.id]
      );
      row = r.rows[0];
    }
    await saveTargets(client, row.id, d.assignToAll, d.groupIds);
    await client.query('COMMIT');
    res.status(id ? 200 : 201).json({ assignment: fmt(row) });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

router.post('/', requireRole('admin'), validate(assignmentSchema), asyncHandler((req, res) => upsert(req, res)));
router.put(
  '/:id',
  requireRole('admin'),
  validate(assignmentSchema),
  asyncHandler((req, res) => upsert(req, res, Number(req.params.id)))
);

router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const r = await query('DELETE FROM assignments WHERE id = $1', [Number(req.params.id)]);
    if (!r.rowCount) throw new HttpError(404, 'Assignment not found');
    res.status(204).end();
  })
);

// ---------- admin detail: group-wise + student-wise confirmations ----------
router.get(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const a = await query('SELECT * FROM assignments WHERE id = $1', [id]);
    if (!a.rows[0]) throw new HttpError(404, 'Assignment not found');
    const assignment = a.rows[0];

    const targets = await query(
      `SELECT g.id, g.name, s.confirmed_at, cu.name AS confirmed_by
       FROM groups g
       LEFT JOIN submissions s ON s.group_id = g.id AND s.assignment_id = $1
       LEFT JOIN users cu ON cu.id = s.confirmed_by
       WHERE $2::boolean OR EXISTS (SELECT 1 FROM assignment_groups ag WHERE ag.assignment_id = $1 AND ag.group_id = g.id)
       ORDER BY g.name`,
      [id, assignment.assign_to_all]
    );
    const gids = targets.rows.map((g) => g.id);
    const members = await query(
      `SELECT gm.group_id, u.id, u.name, u.email FROM group_members gm JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = ANY($1::int[]) ORDER BY u.name`,
      [gids]
    );
    const due = new Date(assignment.due_date);
    const groups = targets.rows.map((g) => ({
      id: g.id,
      name: g.name,
      submitted: !!g.confirmed_at,
      confirmedAt: g.confirmed_at,
      confirmedBy: g.confirmed_by,
      late: !!g.confirmed_at && new Date(g.confirmed_at) > due,
      members: members.rows
        .filter((m) => m.group_id === g.id)
        .map((m) => ({ id: m.id, name: m.name, email: m.email })),
    }));
    const students = groups.flatMap((g) =>
      g.members.map((m) => ({
        ...m,
        groupId: g.id,
        groupName: g.name,
        submitted: g.submitted,
        confirmedAt: g.confirmedAt,
        confirmedBy: g.confirmedBy,
      }))
    );
    res.json({
      assignment: { ...fmt(assignment), groupIds: assignment.assign_to_all ? [] : gids },
      groups,
      students,
    });
  })
);

// ---------- student: server-enforced confirmation ----------
const confirmSchema = z.object({
  confirmed: z.literal(true, { errorMap: () => ({ message: 'Confirmation required' }) }),
});

router.post(
  '/:id/confirm',
  requireRole('student'),
  validate(confirmSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const gm = await query('SELECT group_id FROM group_members WHERE user_id = $1', [req.user.id]);
    if (!gm.rows[0]) throw new HttpError(400, 'Join or create a group before confirming a submission');
    const groupId = gm.rows[0].group_id;

    const visible = await query(
      `SELECT 1 FROM assignments a WHERE a.id = $1 AND (a.assign_to_all
         OR EXISTS (SELECT 1 FROM assignment_groups ag WHERE ag.assignment_id = a.id AND ag.group_id = $2))`,
      [id, groupId]
    );
    if (!visible.rowCount) throw new HttpError(404, 'Assignment not found for your group');

    const ins = await query(
      `INSERT INTO submissions (assignment_id, group_id, confirmed_by) VALUES ($1,$2,$3)
       ON CONFLICT (assignment_id, group_id) DO NOTHING RETURNING confirmed_at`,
      [id, groupId, req.user.id]
    );
    if (!ins.rowCount) throw new HttpError(409, 'Your group has already confirmed this assignment');
    res.status(201).json({ confirmedAt: ins.rows[0].confirmed_at });
  })
);

module.exports = router;
