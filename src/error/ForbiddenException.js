module.exports = function ForbiddenException(message='User is inactive') {
    this.status = 403;
    this.message = message;
  };
  