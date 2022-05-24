const AssetGroup = require("../assetGroup/AssetGroup");
const AssetsStatuses = require("../assets_statuses/AssetsStatuses");
const AssetsVendors = require("../assets_vendors/AssetsVendors");
const sequelize = require("../config/database");
const AssetNotFoundException = require("../error/AssetNotFoundException");
const Asset = require("./Asset");

const Sequelize = require("sequelize");
const Vendor = require("../vendor/Vendor");
const Status = require("../status/Status");

const createAsset = async (body, userId, companyId) => {
  const serialCode = body.serialCode || null;
  const vendorId = body.vendorId || null;
  const purchasingCost = body.purchasingCost || null;
  const currentValue = body.currentValue || null;
  const acquisitionDate = body.acquisitionDate || null;
  const saleDate = body.saleDate || null;

  const { assetgroupId, assetName, statusCode } = body;

  const transaction = await sequelize.transaction();

  try {
    const asset = await Asset.create(
      {
        assetName,
        companyId,
        userId,
        serialCode,
        assetgroupId,
        purchasingCost,
        currentValue,
        acquisitionDate,
        saleDate,
      },
      { transaction }
    );

    await AssetsStatuses.create(
      { statusId: +statusCode, companyId, assetId: asset.getDataValue("id") },
      { transaction }
    );
    if (vendorId) {
      await AssetsVendors.create(
        { vendorId, companyId, assetId: asset.getDataValue("id") },
        { transaction }
      );
    }

    await transaction.commit();
    return asset;
  } catch (e) {
    await transaction.rollback();
  }
};

const checkAssetSerialCodeDuplicateInCompany = async (
  companyId,
  serialCode
) => {
  return await Asset.findOne({ where: { companyId, serialCode } });
};

const listAssetsFromCompany = async (page, size, companyId, search) => {
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
        attributes: ["id", "statusName"],
        through: { attributes: [] },
      },
      {
        model: Vendor,
        as: "vendor",
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

const getAssetFromCompany = async (companyId, assetId) => {
  if (!Number.isInteger(+assetId)) throw new AssetNotFoundException();

  const asset = await Asset.findOne({
    where: {
      companyId,
      id: assetId,
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
  });

  if (!asset) throw new AssetNotFoundException();

  return asset;
};

const updateAsset = async (assetId, updatedBody) => {
  const transaction = await sequelize.transaction();

  try {
    const asset = await Asset.findOne(
      { where: { id: assetId } },
      { transaction }
    );

    const updatedAssetName = updatedBody.assetName || null;
    const updatedAssetGroupId = updatedBody.assetgroupId || null;
    const updatedSerialCode = updatedBody.serialCode || null;
    const updatedPurchasingCost = updatedBody.purchasingCost || null;
    const updatedCurrentValue = updatedBody.currentValue || null;
    const updatedacquisitionDate = updatedBody.acquisitionDate || null;
    const updatedSaleDate = updatedBody.saleDate || null;

    const updatedStatusCode = updatedBody.statusCode || null;

    const updatedVendorId = updatedBody.vendorId;

    asset.assetName = updatedAssetName;
    asset.assetgroupId = updatedAssetGroupId;
    asset.serialCode = updatedSerialCode;
    asset.purchasingCost = updatedPurchasingCost;
    asset.currentValue = updatedCurrentValue;
    asset.acquisitionDate = updatedacquisitionDate;
    asset.saleDate = updatedSaleDate;

    if (updatedVendorId !== undefined) {
      let assetVendor = await AssetsVendors.findOne({
        where: { assetId: asset.id },
      });

      if (!assetVendor) {
        const res = await AssetsVendors.create(
          {
            vendorId: +updatedVendorId,
            assetId: asset.id,
            companyId: asset.companyId,
          },
          { transaction }
        );
      } else if (updatedVendorId === null || updatedVendorId === "") {
        await AssetsVendors.destroy(
          { where: { assetId: asset.id } },
          { transaction }
        );
      } else {
        await AssetsVendors.update(
          { vendorId: +updatedVendorId },
          { where: { assetId: asset.id } },
          { transaction }
        );
      }
    }

    if (updatedStatusCode !== null) {
      await AssetsStatuses.update(
        { statusId: updatedStatusCode },
        { where: { assetId: asset.id } },
        { transaction }
      );
    }

    await asset.save();
    await transaction.commit();
    return asset;
  } catch (e) {
    await transaction.rollback();
  }
};

const deleteAsset = async (companyId, assetId) => {
  const asset = await getAssetFromCompany(companyId, assetId);
  return await Asset.destroy({ where: { id: asset.id } });
};

module.exports = {
  createAsset,
  checkAssetSerialCodeDuplicateInCompany,
  listAssetsFromCompany,
  getAssetFromCompany,
  updateAsset,
  deleteAsset,
};
