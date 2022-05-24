const jwt = require("jsonwebtoken");
const config = require("config");
const Admin = require("../SystemAdmins/Admin");

const SECRET_KEY = config.get("secretKey");

/** return signed JWT from user data. */

async function createToken(user) {
  const systemAdmin = await Admin.findOne({ where: { userId: user.id } });

  console.assert(
    systemAdmin !== undefined,
    "createToken passed user without isAdmin property"
  );
  let payload = {
    userId: user.id,
    isAdmin: systemAdmin ? true : false,
    companyId: user.companyId,
  };

  return jwt.sign(payload, SECRET_KEY);
}

module.exports = { createToken };
