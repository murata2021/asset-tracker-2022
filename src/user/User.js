const Sequelize = require("sequelize");
const sequelize = require("../config/database");
const Admin = require("../SystemAdmins/Admin");
const AssetGroup = require("../assetGroup/AssetGroup");
const Status = require("../status/Status");
const Vendor = require("../vendor/Vendor");

const Model = Sequelize.Model;

class User extends Model {}

User.init(
  {
    username: {
      type: Sequelize.STRING,
      //   allowNull: false
    },
    fullName: {
      type: Sequelize.STRING,
    },
    email: {
      type: Sequelize.STRING,
      //   allowNull: false,
      // unique: true
    },
    password: {
      type: Sequelize.STRING,
      //   allowNull: false
    },
    inactive: {
      type: Sequelize.BOOLEAN,
      //   allowNull: false,
      defaultValue: false,
    },
    companyId: {
      type: Sequelize.INTEGER,
    },
    isAdmin: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
  },
  //first parameter is the connection instance
  //second parameter is for table name,sequelize makes it plural
  { sequelize, modelName: "user", tableName: "users" }
);
User.hasMany(AssetGroup, { onDelete: "cascade", foreignKey: "userId" });
AssetGroup.belongsTo(User);

User.hasMany(Status, { onDelete: "cascade", foreignKey: "userId" });
Status.belongsTo(User);

User.hasOne(Admin, { onDelete: "cascade", foreignKey: "userId" });
Admin.belongsTo(User);

User.hasMany(Vendor, { onDelete: "cascade", foreignKey: "userId" });
Vendor.belongsTo(User);

module.exports = User;
