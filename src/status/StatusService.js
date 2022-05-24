const sequelize = require("../config/database");

const User = require("../user/User");
const Company = require("../company/Company");
const Status = require("./Status");
const StatusNotFoundException = require("../error/StatusNotFoundException");
const Asset = require("../asset/Asset");
const AssetGroup = require("../assetGroup/AssetGroup");
const Sequelize = require("sequelize");
const Vendor = require("../vendor/Vendor");

const createStatus = async (body, userId, companyId) => {
  const { statusName } = body;

  const transaction = await sequelize.transaction();

  try {
    const assetStatus = await Status.create(
      { companyId, userId, statusName },
      { transaction }
    );
    await transaction.commit();
    return assetStatus;
  } catch (e) {
    await transaction.rollback();
  }
};

const checkStatusDuplicateInCompany = async (companyId, statusName) => {
  return await Status.findOne({ where: { companyId, statusName } });
};

const listStatusesFromCompany = async (companyId) => {
  const assetStatuses = await Status.findAll({
    where: {
      companyId,
    },
    include: {
      model: Asset,
    },
    attributes: ["id", "statusName", "companyId", "userId"],
    order: [["id", "ASC"]],
  });
  return {
    assetStatuses,
  };
};

const getStatusFromCompany = async (companyId, statusId) => {
  if (!Number.isInteger(+statusId)) throw new StatusNotFoundException();

  const assetStatus = await Status.findOne({
    where: {
      companyId,
      id: statusId,
    },

    attributes: ["id", "statusName", "companyId", "userId"],
  });

  if (!assetStatus) throw new StatusNotFoundException();

  return assetStatus;
};

const listStatusAssets = async (statusId, page, size, companyId, search) => {
  const assetsWithCount = await Asset.findAndCountAll({
    where: {
      companyId,
      assetName: {
        [Sequelize.Op.iLike]: "%" + search + "%",
      },
    },
    include: [
      {
        model: AssetGroup,
        attributes: ["id", "assetGroupName"],
      },
      {
        model: Status,
        as: "status",
        through: { attributes: [] },
        where: {
          id: statusId,
        },
      },
      {
        model: Vendor,
        as: "vendor",
        through: { attributes: [] },
      },
    ],
    offset: page * size,
    limit: size,
  });
  return {
    content: assetsWithCount.rows,
    page,
    size,
    totalPages: Math.ceil(assetsWithCount.count / size),
    totalAssets: assetsWithCount.count,
  };
};
// const updateAssetStatus = async (assetStatusId, updatedBody) => {
//   const assetStatus = await AssetStatus.findOne({
//     where: { id: assetStatusId },
//   });

//   if (updatedBody.statusName) {
//     assetStatus.statusName = updatedBody.statusName;
//   }

//   await assetStatus.save();

//   const { id, statusName, companyId, userId } = assetStatus;
//   return {
//     id,
//     statusName,
//     companyId,
//     userId,
//   };
// };

// const deleteAssetStatus = async (companyId, assetStatusId) => {
//   //checks existence of the user if user not exist throws user not found error
//   const assetstatus = await getAssetStatusFromCompany(companyId, assetStatusId);
//   return await AssetStatus.destroy({ where: { id: assetstatus.id } });
// };

module.exports = {
  createStatus,
  checkStatusDuplicateInCompany,
  listStatusesFromCompany,
  getStatusFromCompany,
  listStatusAssets,

  //   updateAssetStatus,
  //   deleteAssetStatus,
};
