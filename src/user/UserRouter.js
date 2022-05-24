const express = require("express");
const router = express.Router();

const CompanyService = require("../company/CompanyService");
const UserService = require("./UserService");

const ValidationException = require("../error/ValidationException");

const { check, validationResult } = require("express-validator");

const { ensureLoggedIn } = require("../middlewares/ensureLoggedIn");
const { ensureCompanyAdmin } = require("../middlewares/ensureCompanyAdmin");
const {
  ensureFromRightCompany,
} = require("../middlewares/ensureFromRightCompany");
const {
  ensureCorrectUserOrAdmin,
} = require("../middlewares/ensureCorrectUserOrAdmin");

const { pagination } = require("../middlewares/pagination");
const User = require("./User");
const Admin = require("../SystemAdmins/Admin");
const Company = require("../company/Company");
const ForbiddenException = require("../error/ForbiddenException");
const AuthenticationException = require("../error/AuthenticationException");

const bcrypt = require("bcrypt");

router.post(
  "/api/1.0/companies/:companyId/users",
  ensureLoggedIn,
  ensureCompanyAdmin,

  check("username")
    .trim()
    .notEmpty()
    .withMessage("Username cannot be null")
    .bail()
    .isLength({ min: 4, max: 32 })
    .withMessage("Must have min 4 and max 32 characters")
    .custom(async (username, { req }) => {
      let companyId = req.params.companyId;

      const user = await UserService.checkUsernameDuplicateInCompany(
        companyId,
        username
      );
      if (user) {
        throw new Error("Username in use");
      }
    }),
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
      let companyId = +req.params.companyId;

      const token = await UserService.createUser(req.body, companyId);
      return res.status(200).send({ token, message: "User is created" });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/api/1.0/companies/:companyId/users",
  ensureLoggedIn,
  ensureFromRightCompany,
  pagination,
  async (req, res, next) => {
    const authenticatedUser = req.authenticatedUser;
    const { size, page } = req.pagination;
    const search = req.query.search ? req.query.search : "";

    try {
      const users = await UserService.listUsersFromCompany(
        page,
        size,
        authenticatedUser,
        search
      );
      res.status(200).send(users);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/api/1.0/companies/:companyId/users/:userId",
  ensureLoggedIn,
  ensureFromRightCompany,

  async (req, res, next) => {
    try {
      const user = await UserService.getUserFromCompany(
        +req.params.companyId,
        +req.params.userId
      );
      return res.status(200).send(user);
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  "/api/1.0/companies/:companyId/users/:userId",
  ensureLoggedIn,
  ensureCorrectUserOrAdmin,
  check("email")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("E-mail cannot be null")
    .bail()
    .isEmail()
    .withMessage("E-mail is not valid")
    .bail()
    .custom(async (email, { req }) => {
      const user = await UserService.findByEmail(email);
      if (user && user.id !== +req.params.userId) {
        throw new Error("E-mail in use");
      }
    }),
  check("username")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Username cannot be null")
    .bail()
    .isLength({ min: 4, max: 32 })
    .withMessage("Must have min 4 and max 32 characters")
    .custom(async (username, { req }) => {
      if (Number.isInteger(+req.params.userId)) {
        let companyId = req.params.companyId;
        const userInDb = await User.findOne({
          where: { id: +req.params.userId },
        });
        if (userInDb) {
          if (userInDb.username !== username) {
            const user = await UserService.checkUsernameDuplicateInCompany(
              companyId,
              username
            );
            if (user) {
              throw new Error("Username in use");
            }
          }
        }
      }
    }),
  check("fullName")
    .optional()
    .trim()
    .isLength({ max: 70 })
    .withMessage("Must have max 70 characters"),
  check("password")
    .optional()
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
      const userId = +req.params.userId;
      const companyId = +req.params.companyId;
      const userInDb = await UserService.getUserFromCompany(companyId, userId);

      if (!req.authenticatedUser.isAdmin && userInDb.inactive)
        throw new ForbiddenException();

      const user = await UserService.updateUser(userId, req.body);
      return res.send(user);
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  "/api/1.0/companies/:companyId/users/:userId/password",
  ensureLoggedIn,
  ensureCorrectUserOrAdmin,
  check("oldPassword")
    .trim()
    .notEmpty()
    .withMessage("Password cannot be null")
    .bail()
    .custom(async (oldPassword, { req }) => {
      if (Number.isInteger(+req.params.userId)) {
        let companyId = req.params.companyId;
        const userInDb = await User.findOne({
          where: { id: +req.params.userId },
        });
        if (userInDb) {
          const passwordValidation = await bcrypt.compare(
            req.body.oldPassword,
            userInDb.password
          );
          if (!passwordValidation) {
            throw new Error("Password is incorrect");
          }
        }
      }
    }),
  check("newPassword")
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
    )
    .bail()
    .custom(async (newPassword, { req }) => {
      if (Number.isInteger(+req.params.userId)) {
        let companyId = req.params.companyId;
        const userInDb = await User.findOne({
          where: { id: +req.params.userId },
        });
        if (userInDb) {
          const passwordValidation = await bcrypt.compare(
            newPassword,
            userInDb.password
          );
          if (passwordValidation) {
            throw new Error(
              "New password must be different than the previous one"
            );
          }
        }
      }
    }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ValidationException(errors.array()));
    }

    try {
      const userId = +req.params.userId;
      const companyId = +req.params.companyId;
      const userInDb = await UserService.getUserFromCompany(
        companyId,
        userId,
        (getPassword = true)
      );

      if (userInDb.inactive) {
        throw new ForbiddenException();
      }

      if (!req.authenticatedUser.isAdmin && userInDb.inactive)
        throw new ForbiddenException();

      await UserService.updateUserPassword(userId, req.body);
      return res.send({ message: "Password is changed successfully" });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  "/api/1.0/companies/:companyId/users/:userId/deactivate",
  ensureLoggedIn,
  ensureCompanyAdmin,
  async (req, res, next) => {
    try {
      const userId = +req.params.userId;
      const companyId = +req.params.companyId;
      const userInDb = await UserService.getUserFromCompany(companyId, userId);

      if (!req.authenticatedUser.isAdmin)
        throw new ForbiddenException(
          "You are not allowed to perform this operation"
        );

      if (!userInDb.inactive)
        throw new ForbiddenException("User is already active");

      if (userInDb.inactive) {
        const user = await UserService.deactivateUser(userId);
        return res.send(user);
      }
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/api/1.0/companies/:companyId/users/:userId",
  ensureLoggedIn,
  ensureCompanyAdmin,
  async (req, res, next) => {
    try {
      await UserService.deleteUser(+req.params.companyId, +req.params.userId);
      return res.send({ message: "User is deleted" });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
