// Demo data: 1 professor, 6 students, 2 groups, 3 assignments, a few confirmations.
const bcrypt = require('bcryptjs');
const { pool, migrate, waitForDb } = require('./db');

(async () => {
  await waitForDb();
  await migrate();
  // --if-empty: only seed a fresh database (used on deploy so restarts never wipe real data)
  if (process.argv.includes('--if-empty')) {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM users');
    if (rows[0].n > 0) {
      console.log('Database already has users; skipping seed.');
      await pool.end();
      return;
    }
  }
  await pool.query(
    'TRUNCATE submissions, assignment_groups, assignments, group_members, groups, users RESTART IDENTITY CASCADE'
  );
  const hash = await bcrypt.hash('password123', 10);
  const add = async (name, email, role) =>
    (
      await pool.query(
        'INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4) RETURNING id',
        [name, email, hash, role]
      )
    ).rows[0].id;

  const prof = await add('Prof. Meera Rao', 'professor@joineazy.com', 'admin');
  const s = [];
  const students = [
    ['Aarav Shah', 'aarav'],
    ['Diya Nair', 'diya'],
    ['Rohan Gupta', 'rohan'],
    ['Sana Khan', 'sana'],
    ['Karthik Iyer', 'karthik'],
    ['Isha Verma', 'isha'],
  ];
  for (const [n, e] of students) s.push(await add(n, `${e}@student.com`, 'student'));

  const mkGroup = async (name, owner) =>
    (await pool.query('INSERT INTO groups (name, owner_id) VALUES ($1,$2) RETURNING id', [name, owner])).rows[0].id;
  const g1 = await mkGroup('Team Alpha', s[0]);
  const g2 = await mkGroup('Team Beta', s[3]);
  for (const u of [s[0], s[1], s[2]]) await pool.query('INSERT INTO group_members (group_id, user_id) VALUES ($1,$2)', [g1, u]);
  for (const u of [s[3], s[4]]) await pool.query('INSERT INTO group_members (group_id, user_id) VALUES ($1,$2)', [g2, u]);

  const day = 86400000;
  const mk = async (title, desc, offset, all) =>
    (
      await pool.query(
        'INSERT INTO assignments (title,description,due_date,onedrive_link,assign_to_all,created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        [title, desc, new Date(Date.now() + offset * day), 'https://onedrive.live.com/', all, prof]
      )
    ).rows[0].id;
  const a1 = await mk('Database Design Report', 'Design an ER diagram and normalise it to 3NF.', -2, true);
  const a2 = await mk('REST API Project', 'Build a CRUD API with JWT authentication.', 5, true);
  const a3 = await mk('UI Prototype (Team Alpha only)', 'Figma prototype for the dashboard.', 9, false);
  await pool.query('INSERT INTO assignment_groups (assignment_id, group_id) VALUES ($1,$2)', [a3, g1]);

  const sub = (a, g, u) =>
    pool.query('INSERT INTO submissions (assignment_id, group_id, confirmed_by) VALUES ($1,$2,$3)', [a, g, u]);
  await sub(a1, g1, s[0]);
  await sub(a1, g2, s[3]);
  await sub(a2, g1, s[1]);

  console.log('Seeded. Professor: professor@joineazy.com | Student: aarav@student.com | password: password123');
  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
