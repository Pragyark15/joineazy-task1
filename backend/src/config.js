require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT) || 5000,
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/joineazy',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  adminSignupCode: process.env.ADMIN_SIGNUP_CODE || 'PROF-2026',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};
