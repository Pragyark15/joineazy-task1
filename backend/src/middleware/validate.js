const HttpError = require('../utils/httpError');

// Validates req.body against a zod schema and replaces it with the parsed value.
module.exports = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const msg = result.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
    return next(new HttpError(400, msg));
  }
  req.body = result.data;
  next();
};
