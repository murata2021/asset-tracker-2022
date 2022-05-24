const express = require("express");
const {
  ensureFromRightCompany,
} = require("../middlewares/ensureFromRightCompany");
const { ensureLoggedIn } = require("../middlewares/ensureLoggedIn");
const router = express.Router();

const StatusService = require("./StatusService");
const ValidationException = require("../error/ValidationException");
const { check, validationResult } = require("express-validator");
const CompanyService = require("../company/CompanyService");
const { pagination } = require("../middlewares/pagination");
const Status = require("./Status");
const User = require("../user/User");

// router.post(
//   "/api/1.0/companies/:companyId/asset-status",
//   ensureLoggedIn,
//   ensureFromRightCompany,
//   check("statusName")
//     .trim()
//     .toLowerCase()
//     .notEmpty()
//     .withMessage("Status Name cannot be null")
//     .bail()
//     .isLength({ min: 1, max: 32 })
//     .withMessage("Must have min 1 and max 32 characters")
//     .custom(async (statusName, { req }) => {
//       let companyId = req.params.companyId;
//       const assetStatus =
//         await StatusService.checkAssetStatusDuplicateInCompany(
//           companyId,
//           statusName
//         );
//       if (assetStatus) {
//         throw new Error("Asset Status Name in use");
//       }
//     }),
//   async (req, res, next) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return next(new ValidationException(errors.array()));
//     }
//     const { userId, companyId } = req.authenticatedUser;
//     try {
//       const assetStatus = await StatusService.createAssetStatus(
//         req.body,
//         userId,
//         companyId
//       );
//       return res.json({ message: "Asset Status is created" });
//     } catch (error) {
//       next(error);
//     }
//   }
// );

// router.get(
//   "/api/1.0/companies/:companyId/asset-status",
//   ensureLoggedIn,
//   ensureFromRightCompany,
// //   pagination,

//   async (req, res, next) => {
//     const authenticatedUser = req.authenticatedUser;
//     // const { size, page } = req.pagination;
//     try {
//       const assetStatuses =
//         await StatusService.listAssetStatutesFromCompany(
//           page,
//           size,
//           authenticatedUser.companyId
//         );
//       res.status(200).send(assetStatuses);
//     } catch (error) {
//       next(error);
//     }
//   }
// );

router.get(
  "/api/1.0/companies/:companyId/asset-status",
  ensureLoggedIn,
  ensureFromRightCompany,

  async (req, res, next) => {
    const authenticatedUser = req.authenticatedUser;
    try {
      const assetStatuses = await StatusService.listStatusesFromCompany(
        authenticatedUser.companyId
      );
      res.status(200).send(assetStatuses);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/api/1.0/companies/:companyId/asset-status/:statusId",
  ensureLoggedIn,
  ensureFromRightCompany,

  async (req, res, next) => {
    try {
      const assetStatus = await StatusService.getStatusFromCompany(
        +req.params.companyId,
        +req.params.statusId
      );
      return res.status(200).send(assetStatus);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/api/1.0/companies/:companyId/asset-status/:statusId/assets",
  ensureLoggedIn,
  ensureFromRightCompany,
  pagination,

  async (req, res, next) => {
    const authenticatedUser = req.authenticatedUser;
    const { size, page } = req.pagination;
    const search = req.query.search ? req.query.search : "";

    try {
      const status = await StatusService.getStatusFromCompany(
        +req.params.companyId,
        +req.params.statusId
      );

      const assets = await StatusService.listStatusAssets(
        status.id,
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

// router.patch(
//   "/api/1.0/companies/:companyId/asset-status/:assetStatusId",
//   ensureLoggedIn,
//   ensureFromRightCompany,

//   check("statusName")
//     .optional()
//     .trim()
//     .toLowerCase()
//     .notEmpty()
//     .withMessage("Status Name cannot be null")
//     .bail()
//     .isLength({ min: 1, max: 32 })
//     .withMessage("Must have min 1 and max 32 characters")
//     .custom(async (statusName, { req }) => {
//       if (Number.isInteger(+req.params.assetStatusId)) {
//         let companyId = +req.params.companyId;

//         const statusInDb = await AssetStatus.findOne({
//           where: { id: +req.params.assetStatusId, companyId },
//         });

//         if (statusInDb) {
//           if (statusInDb.statusName !== statusName) {
//             const assetStatus =
//               await StatusService.checkAssetStatusDuplicateInCompany(
//                 companyId,
//                 statusName
//               );
//             if (assetStatus) {
//               throw new Error("Asset Status Name in use");
//             }
//           }
//         }
//       }
//     }),
//   async (req, res, next) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return next(new ValidationException(errors.array()));
//     }

//     try {
//       const assetStatusId = +req.params.assetStatusId;
//       const companyId = +req.params.companyId;
//       const assetStatusInDb =
//         await StatusService.getAssetStatusFromCompany(
//           companyId,
//           assetStatusId
//         );

//       const assetStatus = await StatusService.updateAssetStatus(
//         assetStatusInDb.id,
//         req.body
//       );
//       return res.send(assetStatus);
//     } catch (error) {
//       console.log(error);
//       next(error);
//     }
//   }
// );

// router.delete(
//   "/api/1.0/companies/:companyId/asset-status/:assetStatusId",
//   ensureLoggedIn,
//   ensureFromRightCompany,
//   async (req, res, next) => {
//     try {
//       await StatusService.deleteAssetStatus(
//         +req.params.companyId,
//         +req.params.assetStatusId
//       );
//       return res.send({ message: "Asset Status is deleted" });
//     } catch (error) {
//       console.log(error);
//       next(error);
//     }
//   }
// );

module.exports = router;
