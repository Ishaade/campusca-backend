const HttpError = require('../utils/httpError');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Log the full error for debugging (use console.error to include stack)
  console.error(err);
  const statusCode = err.statusCode || 500;
  const payload = {
    status: 'error',
    message: err.message || 'Something went wrong'
  };

  if (err.details) {
    // Include validation/error details when present (Zod gives an array)
    payload.details = err.details;
  }

  if (process.env.NODE_ENV !== 'production' && statusCode === 500) {
    payload.stack = err.stack;
  }

  res.status(statusCode).json(payload);
}

function notFound(req, res, next) {
  next(new HttpError(404, `Route ${req.originalUrl} not found`));
}

module.exports = {
  errorHandler,
  notFound
};

