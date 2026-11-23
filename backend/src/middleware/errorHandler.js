module.exports = (err, _req, res, _next) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  // Postgres unique violation
  if (err.code === '23505') return res.status(409).json({ error: 'Resource already exists' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};
