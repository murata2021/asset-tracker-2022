const ForbiddenException = require("../error/ForbiddenException");
const UnauthorizedError = require("../error/UnauthorizedError");

const ensureCompanyAdmin = (req, res, next) => {
  try {
    if (!req.authenticatedUser) throw new UnauthorizedError();
    if (!req.authenticatedUser.isAdmin)
      throw new ForbiddenException(
        "You are not allowed to perform this operation"
      );
    if (req.authenticatedUser) {
      if (req.authenticatedUser.companyId !== +req.params.companyId)
        throw new UnauthorizedError();
    }

    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = { ensureCompanyAdmin };
