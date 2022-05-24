const sequelize = require("../config/database");
const Sequelize = require("sequelize");

const AssetGroup = require("./AssetGroup");
const AssetGroupNotFoundException = require("../error/AssetGroupNotFoundException");
const ForbiddenException = require("../error/ForbiddenException");
const Asset = require("../asset/Asset");
const Status = require("../status/Status");
const Vendor = require("../vendor/Vendor");

const createAssetGroup = async (body, userId, companyId) => {
  const { assetGroupName } = body;

  const transaction = await sequelize.transaction();

  try {
    const assetgroup = await AssetGroup.create(
      { companyId, userId, assetGroupName },
      { transaction }
    );
    await transaction.commit();
    return assetgroup;
  } catch (e) {
    await transaction.rollback();
  }
};

const checkAssetGroupNameDuplicateInCompany = async (
  companyId,
  assetGroupName
) => {
  return await AssetGroup.findOne({ where: { companyId, assetGroupName } });
};

const listAssetGroupsFromCompany = async (
  page,
  size,
  companyId,
  search,
  pagination = true
) => {
  if (pagination) {
    const assetGroupsWithCount = await AssetGroup.findAndCountAll({
      where: {
        companyId,
        assetGroupName: {
          [Sequelize.Op.iLike]: "%" + search + "%",
        },
      },
      include: {
        model: Asset,
        attributes: ["id", "assetName"],
      },
      attributes: ["id", "assetGroupName", "companyId", "userId"],
      order: [["id", "ASC"]],

      offset: page * size,
      limit: size,
    });
    return {
      content: assetGroupsWithCount.rows,
      page,
      size,
      totalPages: Math.ceil(assetGroupsWithCount.count / size),
      totalAssetGroups: assetGroupsWithCount.count,
    };
  } else {
    const assetGroups = await AssetGroup.findAll({
      where: {
        companyId,
        assetGroupName: {
          [Sequelize.Op.iLike]: "%" + search + "%",
        },
      },
      include: {
        model: Asset,
        attributes: ["id", "assetName"],
      },
      attributes: ["id", "assetGroupName", "companyId", "userId"],
      order: [["id", "ASC"]],
    });
    return {
      assetGroups,
    };
  }
};
const getAssetGroupFromCompany = async (companyId, assetGroupId) => {
  if (!Number.isInteger(+assetGroupId)) throw new AssetGroupNotFoundException();

  const assetGroup = await AssetGroup.findOne({
    where: {
      companyId,
      id: assetGroupId,
    },
    include: {
      model: Asset,
      attributes: ["id", "assetName"],
    },
    attributes: ["id", "assetGroupName", "companyId", "userId"],
  });

  if (!assetGroup) throw new AssetGroupNotFoundException();

  return assetGroup;
};

const listAssetGroupsAssets = async (
  assetgroupId,
  page,
  size,
  companyId,
  search
) => {
  const assetsWithCount = await Asset.findAndCountAll({
    where: {
      assetgroupId,
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
        attributes: ["id", "statusName"],
        through: { attributes: [] },
      },
      {
        model: Vendor,
        as: "vendor",
        through: { attributes: [] },
      },
    ],
    order: [["id", "ASC"]],

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

const updateAssetGroup = async (assetGroupId, updatedBody) => {
  const assetGroup = await AssetGroup.findOne({ where: { id: assetGroupId } });

  if (updatedBody.assetGroupName) {
    if (assetGroup.assetGroupName === "miscellaneous")
      throw new ForbiddenException(
        "miscellaneous category's asset group name cannot be updated"
      );
    assetGroup.assetGroupName = updatedBody.assetGroupName;
  }

  await assetGroup.save();

  const { id, assetGroupName, companyId, userId } = assetGroup;
  return {
    id,
    assetGroupName,
    companyId,
    userId,
  };
};

const deleteAssetGroup = async (companyId, assetGroupId) => {
  const assetgroup = await getAssetGroupFromCompany(companyId, assetGroupId);

  if (assetgroup.assetGroupName === "miscellaneous")
    throw new ForbiddenException("miscellaneous category cannot be deleted");

  const miscCategory = await AssetGroup.findOne({
    where: { assetGroupName: "miscellaneous" },
  });
  await Asset.update(
    { assetgroupId: miscCategory.id },
    { where: { assetgroupId: assetgroup.id } }
  );

  return await AssetGroup.destroy({ where: { id: assetgroup.id } });
};

module.exports = {
  createAssetGroup,
  checkAssetGroupNameDuplicateInCompany,
  listAssetGroupsFromCompany,
  getAssetGroupFromCompany,
  updateAssetGroup,
  deleteAssetGroup,
  listAssetGroupsAssets,
};
