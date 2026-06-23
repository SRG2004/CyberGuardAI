import logger from '../utils/logger.js';

const errorHandler = (err, req, res, next) => {
  logger.error(`${req.method} ${req.path}`, { error: err.message, stack: err.stack });

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: err.message },
    });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ID', message: 'Invalid resource ID.' },
    });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      success: false,
      error: { code: 'DUPLICATE_ENTRY', message: `${field} already exists.` },
    });
  }
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid authentication token.' },
    });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message,
    },
  });
};

export default errorHandler;
