const ForbiddenException = require("../error/ForbiddenException");
const UnauthorizedError = require("../error/UnauthorizedError");

const ensureCorrectUserOrAdmin = (req, res, next) => {
  try {
    if (!req.authenticatedUser) throw new UnauthorizedError();

    if (req.authenticatedUser) {
      if (req.authenticatedUser.companyId !== +req.params.companyId)
        throw new UnauthorizedError();

      if (
        !(
          req.authenticatedUser.userId === +req.params.userId ||
          req.authenticatedUser.isAdmin
        )
      )
        throw new ForbiddenException(
          "You are not allowed to perform this operation"
        );
    }

    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = { ensureCorrectUserOrAdmin };
