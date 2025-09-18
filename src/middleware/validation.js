const { validationResult } = require('express-validator');
const { HTTP_STATUS } = require('../utils/constants');
const { formatResponse } = require('../utils/helpers');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
    }));

    return res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json(
      formatResponse(false, 'Validation failed', { errors: formattedErrors })
    );
  }

  next();
};

module.exports = {
  handleValidationErrors,
};
