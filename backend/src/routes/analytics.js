const router = require('express').Router();
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(authenticate, requireRole('admin'));

// "targets" = every (assignment, group) pair the professor expects a confirmation for.
const TARGETS = `
  WITH targets AS (
    SELECT a.id AS assignment_id, g.id AS group_id
    FROM assignments a
    JOIN groups g ON a.assign_to_all
      OR EXISTS (SELECT 1 FROM assignment_groups ag WHERE ag.assignment_id = a.id AND ag.group_id = g.id)
  )`;

const pct = (s, t) => (t ? Math.round((s / t) * 100) : 0);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [counts, perAssignment, perGroup, overall] = await Promise.all([
      query(`SELECT
        (SELECT COUNT(*) FROM users WHERE role='student')::int AS students,
        (SELECT COUNT(*) FROM groups)::int AS groups,
        (SELECT COUNT(*) FROM assignments)::int AS assignments,
        (SELECT COUNT(*) FROM assignments WHERE due_date < now())::int AS overdue`),
      query(`${TARGETS}
        SELECT a.id, a.title, a.due_date,
          COUNT(t.group_id)::int AS targeted,
          COUNT(s.id)::int AS submitted
        FROM assignments a
        LEFT JOIN targets t ON t.assignment_id = a.id
        LEFT JOIN submissions s ON s.assignment_id = t.assignment_id AND s.group_id = t.group_id
        GROUP BY a.id ORDER BY a.due_date`),
      query(`${TARGETS}
        SELECT g.id, g.name,
          (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id)::int AS members,
          COUNT(t.assignment_id)::int AS targeted,
          COUNT(s.id)::int AS submitted
        FROM groups g
        LEFT JOIN targets t ON t.group_id = g.id
        LEFT JOIN submissions s ON s.assignment_id = t.assignment_id AND s.group_id = t.group_id
        GROUP BY g.id ORDER BY g.name`),
      query(`${TARGETS}
        SELECT COUNT(*)::int AS targeted,
          (SELECT COUNT(*) FROM submissions s JOIN targets t USING (assignment_id, group_id))::int AS submitted
        FROM targets`),
    ]);

    const o = overall.rows[0];
    res.json({
      summary: {
        ...counts.rows[0],
        completionRate: pct(o.submitted, o.targeted),
        totalSubmitted: o.submitted,
        totalExpected: o.targeted,
      },
      assignments: perAssignment.rows.map((r) => ({
        id: r.id,
        title: r.title,
        dueDate: r.due_date,
        targeted: r.targeted,
        submitted: r.submitted,
        pending: r.targeted - r.submitted,
        percent: pct(r.submitted, r.targeted),
      })),
      groups: perGroup.rows.map((r) => ({
        id: r.id,
        name: r.name,
        members: r.members,
        targeted: r.targeted,
        submitted: r.submitted,
        percent: pct(r.submitted, r.targeted),
      })),
    });
  })
);

module.exports = router;
