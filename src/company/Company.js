const Sequelize = require("sequelize");
const sequelize = require("../config/database");
const Admin = require("../SystemAdmins/Admin");
const User = require("../user/User");
const AssetGroup = require("../assetGroup/AssetGroup");
const Status = require("../status/Status");
const Vendor = require("../vendor/Vendor");
const AssetsStatuses = require("../assets_statuses/AssetsStatuses");
const Asset = require("../asset/Asset");
const AssetsVendors = require("../assets_vendors/AssetsVendors");

const Model = Sequelize.Model;

class Company extends Model {}

Company.init(
  {
    companyName: {
      type: Sequelize.STRING,
    },
  },
  { sequelize, modelName: "company", tableName: "companies" }
);

Company.hasMany(User, { onDelete: "cascade", foreignKey: "companyId" });
User.belongsTo(Company);

Company.hasMany(Asset, { onDelete: "cascade", foreignKey: "companyId" });
Asset.belongsTo(Company);

Company.hasOne(Admin, { onDelete: "cascade", foreignKey: "companyId" });
Admin.belongsTo(Company);

Company.hasMany(AssetGroup, { onDelete: "cascade", foreignKey: "companyId" });
AssetGroup.belongsTo(Company);

Company.hasMany(Status, { onDelete: "cascade", foreignKey: "companyId" });
Status.belongsTo(Company);

Company.hasMany(Vendor, { onDelete: "cascade", foreignKey: "companyId" });
Vendor.belongsTo(Company);

Company.hasMany(AssetsStatuses, {
  onDelete: "cascade",
  foreignKey: "companyId",
});
AssetsStatuses.belongsTo(Company);

Company.hasMany(AssetsVendors, {
  onDelete: "cascade",
  foreignKey: "companyId",
});
AssetsVendors.belongsTo(Company);

module.exports = Company;
