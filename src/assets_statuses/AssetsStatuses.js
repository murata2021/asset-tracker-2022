const Sequelize = require("sequelize");
const sequelize = require("../config/database");

const Model = Sequelize.Model;

class AssetsStatuses extends Model {}

AssetsStatuses.init(
  {
    statusId: {
      type: Sequelize.INTEGER,
    },
    assetId: {
      type: Sequelize.INTEGER,
    },
    notes: {
      type: Sequelize.STRING,
    },
    companyId: {
      type: Sequelize.INTEGER,
    },
  },
  {
    sequelize,
    modelName: "assetstatus",
    tableName: "assets_statuses",
    underscored: true,
  }
);

module.exports = AssetsStatuses;
