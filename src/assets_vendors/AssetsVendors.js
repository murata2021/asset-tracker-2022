const Sequelize = require("sequelize");
const sequelize = require("../config/database");

const Model = Sequelize.Model;

class AssetsVendors extends Model {}

AssetsVendors.init(
  {
    vendorId: {
      type: Sequelize.INTEGER,
    },
    assetId: {
      type: Sequelize.INTEGER,
    },
    notes: {
      type: Sequelize.STRING,
    },
    contact: {
      type: Sequelize.STRING,
    },
    companyId: {
      type: Sequelize.INTEGER,
    },
  },
  {
    sequelize,
    modelName: "assetvendor",
    tableName: "assets_vendors",
    underscored: true,
  }
);

module.exports = AssetsVendors;
