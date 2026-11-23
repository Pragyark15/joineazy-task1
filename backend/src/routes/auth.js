const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const config = require('../config');
const { query } = require('../db');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6).max(100),
  role: z.enum(['student', 'admin']).default('student'),
  adminCode: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });
const signToken = (u) => jwt.sign({ id: u.id, role: u.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, role, adminCode } = req.body;
    if (role === 'admin' && adminCode !== config.adminSignupCode) {
      throw new HttpError(403, 'Invalid professor signup code');
    }
    const exists = await query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (exists.rowCount) throw new HttpError(409, 'Email already registered');

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, email, hash, role]
    );
    res.status(201).json({ token: signToken(rows[0]), user: publicUser(rows[0]) });
  })
);

router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new HttpError(401, 'Invalid email or password');
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (!rows[0]) throw new HttpError(401, 'User no longer exists');
    res.json({ user: publicUser(rows[0]) });
  })
);

module.exports = router;
