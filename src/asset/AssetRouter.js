const express = require("express");
const router = express.Router();

const AssetService = require("./AssetService");
const ValidationException = require("../error/ValidationException");
const StatusService = require("../status/StatusService");
const VendorService = require("../vendor/VendorService");
const AssetGroupService = require("../assetGroup/AssetGroupService");

const { check, validationResult } = require("express-validator");
const { ensureLoggedIn } = require("../middlewares/ensureLoggedIn");
const {
  ensureFromRightCompany,
} = require("../middlewares/ensureFromRightCompany");
const { pagination } = require("../middlewares/pagination");
const Asset = require("./Asset");

router.post(
  "/api/1.0/companies/:companyId/assets",
  ensureLoggedIn,
  ensureFromRightCompany,
  check("assetName")
    .trim()
    .notEmpty()
    .withMessage("Asset name cannot be null")
    .bail()
    .isLength({ min: 1, max: 32 })
    .withMessage("Must have min 1 and max 32 characters"),
  check("serialCode")
    .optional()
    .trim()
    .custom(async (serialCode, { req }) => {
      let companyId = req.params.companyId;
      const asset = await AssetService.checkAssetSerialCodeDuplicateInCompany(
        companyId,
        serialCode
      );
      if (asset) {
        throw new Error("Asset with given serial code already exists");
      }
    }),
  check("statusCode")
    .trim()
    .notEmpty()
    .withMessage("Status cannot be null")
    .bail()
    .custom(async (statusCode, { req }) => {
      let companyId = req.params.companyId;
      let status;
      try {
        status = await StatusService.getStatusFromCompany(
          companyId,
          +statusCode
        );
      } catch (error) {}
      if (!status) throw new Error("Status does not exist");
    }),
  check("vendorId")
    .trim()
    .optional()
    //   .notEmpty()
    // .withMessage("Vendor cannot be null")
    // .bail()
    .custom(async (vendorId, { req }) => {
      let companyId = req.params.companyId;
      let vendor;
      if (vendorId && vendorId !== null) {
        try {
          vendor = await VendorService.getVendorFromCompany(
            companyId,
            +vendorId
          );
        } catch (error) {}
        if (!vendor) throw new Error("Vendor does not exist");
      }
    }),
  check("assetgroupId")
    .trim()
    .notEmpty()
    .withMessage("Asset Group cannot be null")
    .bail()
    .custom(async (assetgroupId, { req }) => {
      let companyId = req.params.companyId;
      let assetGroup;
      try {
        assetGroup = await AssetGroupService.getAssetGroupFromCompany(
          companyId,
          +assetgroupId
        );
      } catch (error) {}
      if (!assetGroup) throw new Error("Asset Group does not exist");
    }),

  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ValidationException(errors.array()));
    }
    const { userId, companyId } = req.authenticatedUser;

    try {
      const asset = await AssetService.createAsset(req.body, userId, companyId);
      return res.json({ message: "Asset is created" });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/api/1.0/companies/:companyId/assets",
  ensureLoggedIn,
  ensureFromRightCompany,
  pagination,

  async (req, res, next) => {
    const authenticatedUser = req.authenticatedUser;
    const { size, page } = req.pagination;
    const search = req.query.search ? req.query.search : "";
    try {
      const assets = await AssetService.listAssetsFromCompany(
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

router.get(
  "/api/1.0/companies/:companyId/assets/:assetId",
  ensureLoggedIn,
  ensureFromRightCompany,

  async (req, res, next) => {
    try {
      const asset = await AssetService.getAssetFromCompany(
        +req.params.companyId,
        +req.params.assetId
      );
      return res.status(200).send(asset);
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  "/api/1.0/companies/:companyId/assets/:assetId",
  ensureLoggedIn,
  ensureFromRightCompany,
  check("assetName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Asset name cannot be null")
    .bail()
    .isLength({ min: 1, max: 32 })
    .withMessage("Must have min 1 and max 32 characters"),
  check("serialCode")
    .optional()
    .trim()
    // .isLength({ min: 1, max: 32 })
    // .withMessage("Must have min 1 and max 32 characters")
    .custom(async (serialCode, { req }) => {
      if (Number.isInteger(+req.params.assetId)) {
        let companyId = req.params.companyId;
        const assetInDb = await Asset.findOne({
          where: { id: +req.params.assetId },
        });
        if (assetInDb && serialCode !== "") {
          if (assetInDb.serialCode !== serialCode) {
            const asset =
              await AssetService.checkAssetSerialCodeDuplicateInCompany(
                companyId,
                serialCode
              );
            if (asset) {
              throw new Error("Asset with given serial code already exists");
            }
          }
        }
      }
    }),
  check("statusCode")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Status cannot be null")
    .bail()
    .custom(async (statusCode, { req }) => {
      let companyId = req.params.companyId;
      let status;
      try {
        status = await StatusService.getStatusFromCompany(
          companyId,
          +statusCode
        );
      } catch (error) {}
      if (!status) throw new Error("Status does not exist");
    }),
  check("vendorId")
    .trim()
    .optional()
    .custom(async (vendorId, { req }) => {
      let companyId = req.params.companyId;
      let vendor;
      if (vendorId && vendorId !== null) {
        try {
          vendor = await VendorService.getVendorFromCompany(
            companyId,
            +vendorId
          );
        } catch (error) {}
        if (!vendor) throw new Error("Vendor does not exist");
      }
    }),
  check("assetgroupId")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Asset Group cannot be null")
    .bail()
    .custom(async (assetgroupId, { req }) => {
      let companyId = req.params.companyId;
      let assetGroup;
      try {
        assetGroup = await AssetGroupService.getAssetGroupFromCompany(
          companyId,
          +assetgroupId
        );
      } catch (error) {}
      if (!assetGroup) throw new Error("Asset Group does not exist");
    }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ValidationException(errors.array()));
    }

    try {
      const assetId = +req.params.assetId;
      const companyId = +req.params.companyId;
      const assetInDb = await AssetService.getAssetFromCompany(
        companyId,
        assetId
      );
      const asset = await AssetService.updateAsset(assetInDb.id, req.body);
      return res.send(asset);
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/api/1.0/companies/:companyId/assets/:assetId",
  ensureLoggedIn,
  ensureFromRightCompany,
  async (req, res, next) => {
    try {
      await AssetService.deleteAsset(
        +req.params.companyId,
        +req.params.assetId
      );
      return res.send({ message: "Asset is deleted" });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
