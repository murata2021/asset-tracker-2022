const express = require("express");
const router = express.Router();

const CompanyService = require("./CompanyService");
const UserService = require("../user/UserService");

const ValidationException = require("../error/ValidationException");

const { check, validationResult } = require("express-validator");
const { ensureLoggedIn } = require("../middlewares/ensureLoggedIn");
const { ensureCompanyAdmin } = require("../middlewares/ensureCompanyAdmin");
const {
  ensureFromRightCompany,
} = require("../middlewares/ensureFromRightCompany");

router.post(
  "/api/1.0/companies",
  check("companyName")
    .trim()
    .notEmpty()
    .withMessage("Company name cannot be null")
    .bail()
    .isLength({ min: 1, max: 50 })
    .withMessage("Must have min 1 and max 50 characters"),
  check("username")
    .trim()
    .notEmpty()
    .withMessage("Username cannot be null")
    .bail()
    .isLength({ min: 4, max: 32 })
    .withMessage("Must have min 4 and max 32 characters"),
  check("email")
    .trim()
    .notEmpty()
    .withMessage("E-mail cannot be null")
    .bail()
    .isEmail()
    .withMessage("E-mail is not valid")
    .bail()
    .custom(async (email) => {
      const user = await UserService.findByEmail(email);
      if (user) {
        throw new Error("E-mail in use");
      }
    }),
  check("password")
    .trim()
    .notEmpty()
    .withMessage("Password cannot be null")
    .bail()
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters")
    .bail()
    .matches(/^(?:(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).*)$/)
    .withMessage(
      "Password must have at least 1 uppercase, 1 lowercase letter and 1 number"
    ),

  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ValidationException(errors.array()));
    }
    try {
      const { companyId, userId, token } = await CompanyService.createAccount(
        req.body
      );
      return res
        .status(200)
        .send({ companyId, userId, token, message: "Account is created" });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/api/1.0/companies/:companyId",
  ensureLoggedIn,
  ensureFromRightCompany,

  async (req, res, next) => {
    try {
      const company = await CompanyService.findById(+req.params.companyId);
      return res.status(200).send(company);
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  "/api/1.0/companies/:companyId",
  ensureLoggedIn,
  ensureCompanyAdmin,
  check("companyName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Company name cannot be null")
    .bail()
    .isLength({ min: 1, max: 50 })
    .withMessage("Must have min 1 and max 50 characters"),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ValidationException(errors.array()));
    }
    const userId = req.authenticatedUser.userId;
    try {
      const companyId = +req.params.companyId;
      const company = await CompanyService.updateCompany(
        userId,
        companyId,
        req.body
      );
      return res.send(company);
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/api/1.0/companies/:companyId",
  ensureLoggedIn,
  ensureCompanyAdmin,
  async (req, res, next) => {
    const userId = req.authenticatedUser.userId;

    try {
      await CompanyService.deleteCompany(+req.params.companyId, userId);
      return res.send({ message: "Company is deleted" });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
