const express = require("express");
const router = new express.Router();

const UserService = require("../user/UserService");

const AuthenticationException = require("../error/AuthenticationException");
const ForbiddenException = require("../error/ForbiddenException");

const bcrypt = require("bcrypt");
const { check, validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const { createToken } = require("../helpers/createToken");

router.post(
  "/api/1.0/auth",
  check("email").isEmail(),
  check("password").notEmpty().withMessage("Password cannot be null").bail(),
  async (req, res, next) => {
    const errors = validationResult(req);
    const { email, password } = req.body;

    try {
      if (!errors.isEmpty()) {
        throw new AuthenticationException();
      }

      const user = await UserService.findByEmail(email);
      if (!user) {
        throw new AuthenticationException();
      }
      const passwordValidation = await bcrypt.compare(password, user.password);
      if (!passwordValidation) {
        throw new AuthenticationException();
      }
      if (user.inactive) {
        throw new ForbiddenException();
      }

      const token = await createToken(user);

      return res.send({
        id: user.id,
        username: user.username,
        companyId: user.companyId,
        isAdmin: user.isAdmin,
        token,
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
