const UnauthorizedError = require("../error/UnauthorizedError");

const ensureFromRightCompany = (req, res, next) => {
  try {
    if (!req.authenticatedUser) throw new UnauthorizedError();

    if (req.authenticatedUser.companyId !== +req.params.companyId)
      throw new UnauthorizedError();

    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = { ensureFromRightCompany };
