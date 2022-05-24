const express = require("express");
const {
  ensureFromRightCompany,
} = require("../middlewares/ensureFromRightCompany");
const { ensureLoggedIn } = require("../middlewares/ensureLoggedIn");
const router = express.Router();

const AssetGroupService = require("./AssetGroupService");

const ValidationException = require("../error/ValidationException");
const { check, validationResult } = require("express-validator");
const CompanyService = require("../company/CompanyService");
const { pagination } = require("../middlewares/pagination");
const AssetGroup = require("./AssetGroup");
const User = require("../user/User");

router.post(
  "/api/1.0/companies/:companyId/asset-groups",
  ensureLoggedIn,
  ensureFromRightCompany,
  check("assetGroupName")
    .trim()
    .notEmpty()
    .withMessage("Asset Group Name cannot be null")
    .bail()
    .isLength({ min: 1, max: 32 })
    .withMessage("Must have min 1 and max 32 characters")
    .custom(async (assetGroupName, { req }) => {
      let companyId = req.params.companyId;
      const assetGroup =
        await AssetGroupService.checkAssetGroupNameDuplicateInCompany(
          companyId,
          assetGroupName
        );
      if (assetGroup) {
        throw new Error("Asset Group Name in use");
      }
    }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ValidationException(errors.array()));
    }
    const { userId, companyId } = req.authenticatedUser;
    try {
      const assetGroup = await AssetGroupService.createAssetGroup(
        req.body,
        userId,
        companyId
      );
      return res.json({ message: "Asset Group is created" });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/api/1.0/companies/:companyId/asset-groups",
  ensureLoggedIn,
  ensureFromRightCompany,
  pagination,

  async (req, res, next) => {
    const authenticatedUser = req.authenticatedUser;
    const { size, page } = req.pagination;
    const search = req.query.search ? req.query.search : "";
    const pagination = req.query.pagination === "false" ? false : true;

    try {
      const assetGroups = await AssetGroupService.listAssetGroupsFromCompany(
        page,
        size,
        authenticatedUser.companyId,
        search,
        pagination
      );
      res.status(200).send(assetGroups);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/api/1.0/companies/:companyId/asset-groups/:assetGroupId",
  ensureLoggedIn,
  ensureFromRightCompany,

  async (req, res, next) => {
    try {
      const assetGroup = await AssetGroupService.getAssetGroupFromCompany(
        +req.params.companyId,
        +req.params.assetGroupId
      );
      return res.status(200).send(assetGroup);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/api/1.0/companies/:companyId/asset-groups/:assetGroupId/assets",
  ensureLoggedIn,
  ensureFromRightCompany,
  pagination,

  async (req, res, next) => {
    const authenticatedUser = req.authenticatedUser;
    const { size, page } = req.pagination;
    const search = req.query.search ? req.query.search : "";

    try {
      //checks assetGroup exists
      const assetGroup = await AssetGroupService.getAssetGroupFromCompany(
        +req.params.companyId,
        +req.params.assetGroupId
      );

      const assets = await AssetGroupService.listAssetGroupsAssets(
        assetGroup.id,
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
  "/api/1.0/companies/:companyId/asset-groups/:assetGroupId",
  ensureLoggedIn,
  ensureFromRightCompany,

  check("assetGroupName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Asset Group Name cannot be null")
    .bail()
    .isLength({ min: 1, max: 32 })
    .withMessage("Must have min 1 and max 32 characters")
    .custom(async (assetGroupName, { req }) => {
      if (Number.isInteger(+req.params.assetGroupId)) {
        let companyId = +req.params.companyId;

        const assetGroupInDb = await AssetGroup.findOne({
          where: { id: +req.params.assetGroupId, companyId },
        });

        if (assetGroupInDb) {
          if (assetGroupInDb.assetGroupName !== assetGroupName) {
            const assetGroup =
              await AssetGroupService.checkAssetGroupNameDuplicateInCompany(
                companyId,
                assetGroupName
              );
            if (assetGroup) {
              throw new Error("Asset Group Name in use");
            }
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
      const assetGroupId = +req.params.assetGroupId;
      const companyId = +req.params.companyId;
      const assetGroupInDb = await AssetGroupService.getAssetGroupFromCompany(
        companyId,
        assetGroupId
      );

      const assetGroup = await AssetGroupService.updateAssetGroup(
        assetGroupInDb.id,
        req.body
      );
      return res.send(assetGroup);
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/api/1.0/companies/:companyId/asset-groups/:assetGroupId",
  ensureLoggedIn,
  ensureFromRightCompany,
  async (req, res, next) => {
    try {
      await AssetGroupService.deleteAssetGroup(
        +req.params.companyId,
        +req.params.assetGroupId
      );
      return res.send({ message: "Asset Group is deleted" });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
