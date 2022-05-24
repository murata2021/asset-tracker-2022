const bcrypt = require("bcrypt");
const UserService = require("../user/UserService");
const config = require("config");
const jwt = require("jsonwebtoken");
const Company = require("../company/Company");
const User = require("../user/User");
const SECRET_KEY = config.get("secretKey");

const tokenAuthentication = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (authorization) {
    const token = authorization.substring(7);
    try {
      const user = jwt.verify(token, SECRET_KEY);
      //cross -check with the db
      const userInDb = await User.findOne({
        where: { id: user.userId, inactive: false },
      });
      if (userInDb) {
        req.authenticatedUser = user;
      }
    } catch (err) {}
  }
  next();
};

module.exports = { tokenAuthentication };
