const express = require("express");
const {
  ensureFromRightCompany,
} = require("../middlewares/ensureFromRightCompany");
const { ensureLoggedIn } = require("../middlewares/ensureLoggedIn");
const router = express.Router();

const ValidationException = require("../error/ValidationException");
const { check, validationResult } = require("express-validator");
const { pagination } = require("../middlewares/pagination");
const Vendor = require("./Vendor");

const VendorService = require("./VendorService");

router.post(
  "/api/1.0/companies/:companyId/vendors",
  ensureLoggedIn,
  ensureFromRightCompany,
  check("vendorName")
    .trim()
    .notEmpty()
    .withMessage("Vendor Name cannot be null")
    .bail()
    .isLength({ min: 1, max: 32 })
    .withMessage("Must have min 1 and max 32 characters")
    .custom(async (vendorName, { req }) => {
      let companyId = req.params.companyId;
      const vendor = await VendorService.checkVendorNameDuplicateInCompany(
        companyId,
        vendorName
      );
      if (vendor) {
        throw new Error("Vendor Name already exists");
      }
    }),
  check("email")
    .trim()
    .notEmpty()
    .withMessage("E-mail cannot be null")
    .bail()
    .isEmail()
    .withMessage("E-mail is not valid"),
  check("contactPerson")
    .trim()
    .notEmpty()
    .withMessage("Contact Person cannot be null")
    .bail()
    .isLength({ max: 50 })
    .withMessage("Must have max 50 characters"),
  check("notes")
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage("Must have max 300 characters"),

  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ValidationException(errors.array()));
    }
    const { userId, companyId } = req.authenticatedUser;
    try {
      const vendor = await VendorService.createVendor(
        req.body,
        userId,
        companyId
      );
      return res.json({ message: "Vendor is created" });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/api/1.0/companies/:companyId/vendors",
  ensureLoggedIn,
  ensureFromRightCompany,
  pagination,

  async (req, res, next) => {
    const authenticatedUser = req.authenticatedUser;
    const { size, page } = req.pagination;
    const search = req.query.search ? req.query.search : "";
    const pagination = req.query.pagination === "false" ? false : true;

    try {
      const vendors = await VendorService.listVendorsFromCompany(
        page,
        size,
        authenticatedUser.companyId,
        search,
        pagination
      );
      res.status(200).send(vendors);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/api/1.0/companies/:companyId/vendors/:vendorId",
  ensureLoggedIn,
  ensureFromRightCompany,

  async (req, res, next) => {
    try {
      const vendor = await VendorService.getVendorFromCompany(
        +req.params.companyId,
        +req.params.vendorId
      );
      return res.status(200).send(vendor);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/api/1.0/companies/:companyId/vendors/:vendorId/assets",
  ensureLoggedIn,
  ensureFromRightCompany,
  pagination,

  async (req, res, next) => {
    const authenticatedUser = req.authenticatedUser;
    const { size, page } = req.pagination;
    const search = req.query.search ? req.query.search : "";

    try {
      const vendor = await VendorService.getVendorFromCompany(
        +req.params.companyId,
        +req.params.vendorId
      );

      const assets = await VendorService.listVendorsAssets(
        vendor.id,
        page,
        size,
        authenticatedUser.companyId,
        search
      );
      res.status(200).send(assets);
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  "/api/1.0/companies/:companyId/vendors/:vendorId",
  ensureLoggedIn,
  ensureFromRightCompany,
  check("vendorName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Vendor Name cannot be null")
    .bail()
    .isLength({ min: 1, max: 32 })
    .withMessage("Must have min 1 and max 32 characters")
    .custom(async (vendorName, { req }) => {
      if (Number.isInteger(+req.params.vendorId)) {
        let companyId = +req.params.companyId;

        const vendorInDb = await Vendor.findOne({
          where: { id: +req.params.vendorId, companyId },
        });

        if (vendorInDb) {
          if (vendorInDb.vendorName !== vendorName) {
            const vendor =
              await VendorService.checkVendorNameDuplicateInCompany(
                companyId,
                vendorName
              );
            if (vendor) {
              throw new Error("Vendor Name already exists");
            }
          }
        }
      }
    }),
  check("email")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("E-mail cannot be null")
    .bail()
    .isEmail()
    .withMessage("E-mail is not valid"),
  check("contactPerson")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Contact Person cannot be null")
    .bail()
    .isLength({ max: 50 })
    .withMessage("Must have max 50 characters"),
  check("notes")
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage("Must have max 300 characters"),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ValidationException(errors.array()));
    }

    try {
      const vendorId = +req.params.vendorId;
      const companyId = +req.params.companyId;
      const vendorInDb = await VendorService.getVendorFromCompany(
        companyId,
        vendorId
      );

      const vendor = await VendorService.updateVendor(vendorInDb.id, req.body);
      return res.send(vendor);
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/api/1.0/companies/:companyId/vendors/:vendorId",
  ensureLoggedIn,
  ensureFromRightCompany,
  async (req, res, next) => {
    try {
      await VendorService.deleteVendor(
        +req.params.companyId,
        +req.params.vendorId
      );
      return res.send({ message: "Vendor is deleted" });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
