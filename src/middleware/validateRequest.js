const HttpError = require('../utils/httpError');

/**
 * Validates req body/query/params based on provided schema (zod).
 * @param {{body?: ZodSchema, query?: ZodSchema, params?: ZodSchema}} schemas
 * @returns Middleware
 */
function validateRequest(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      next();
    } catch (error) {
      // Log validation error details to help debugging (include Zod issues)
      console.error('Validation error:', error?.errors || error);
      // If Zod produced an errors array, include it; otherwise include the error message
      const details = error?.errors || [{ message: error.message || String(error) }];
      // Send a 422 response with details so clients (and devtools) can see exact failure reasons
      return res.status(422).json({ status: 'error', message: 'Validation failed', details });
    }
  };
}

module.exports = validateRequest;

