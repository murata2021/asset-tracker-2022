const UnauthorizedError = require("../error/UnauthorizedError");

const ensureLoggedIn = (req, res, next) => {
  try {
    if (!req.authenticatedUser) throw new UnauthorizedError();
    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = { ensureLoggedIn };
