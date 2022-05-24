module.exports = (err, req, res, next) => {
    const {  message, errors } = err;
    let validationErrors;

    const status = err.status || 500;

    if (errors) {
      validationErrors = {};
      errors.forEach((error) => (validationErrors[error.param] = error.msg));
    }
    res.status(status).send({
      path: req.originalUrl,
      timestamp: new Date().getTime(),
      message,
      validationErrors,
    });
  };
  