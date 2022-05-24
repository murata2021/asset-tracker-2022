const Sequelize = require("sequelize");
const sequelize = require("../config/database");
const Asset = require("../asset/Asset");

const Model = Sequelize.Model;

class AssetGroup extends Model {}

AssetGroup.init(
  {
    assetGroupName: {
      type: Sequelize.STRING,
    },
    companyId: {
      type: Sequelize.INTEGER,
    },
    userId: {
      type: Sequelize.INTEGER,
    },
  },
  { sequelize, modelName: "assetgroup" }
);

AssetGroup.hasMany(Asset, { onDelete: "cascade", foreignKey: "assetgroupId" });
Asset.belongsTo(AssetGroup);

module.exports = AssetGroup;
