const Sequelize = require("sequelize");
const sequelize = require("../config/database");

const AssetsStatuses = require("../assets_statuses/AssetsStatuses");
const AssetsVendors = require("../assets_vendors/AssetsVendors");
const Vendor = require("../vendor/Vendor");
const Status = require("../status/Status");

const Model = Sequelize.Model;

class Asset extends Model {}

Asset.init(
  {
    assetName: {
      type: Sequelize.STRING,
    },
    assetgroupId: {
      type: Sequelize.INTEGER,
    },
    companyId: {
      type: Sequelize.INTEGER,
    },
    serialCode: {
      type: Sequelize.STRING,
    },
    userId: {
      type: Sequelize.INTEGER,
    },
    purchasingCost: {
      type: Sequelize.FLOAT,
    },
    currentValue: {
      type: Sequelize.FLOAT,
    },
    acquisitionDate: {
      type: Sequelize.DATE,
    },
    saleDate: {
      type: Sequelize.DATE,
    },
  },
  { sequelize, modelName: "asset" }
);

Status.belongsToMany(Asset, {
  through: AssetsStatuses,
  foreignKey: "statusId",
});
Asset.belongsToMany(Status, {
  as: "status",
  through: AssetsStatuses,
  foreignKey: "assetId",
});

Vendor.belongsToMany(Asset, { through: AssetsVendors, foreignKey: "vendorId" });
Asset.belongsToMany(Vendor, {
  as: "vendor",
  through: AssetsVendors,
  foreignKey: "assetId",
});

module.exports = Asset;
