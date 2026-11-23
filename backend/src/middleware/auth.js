const jwt = require('jsonwebtoken');
const config = require('../config');
const HttpError = require('../utils/httpError');

function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Authentication required'));
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired token'));
  }
}

const requireRole = (role) => (req, _res, next) =>
  req.user && req.user.role === role ? next() : next(new HttpError(403, `${role} access only`));

module.exports = { authenticate, requireRole };
