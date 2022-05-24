const Sequelize = require("sequelize");
const sequelize = require("../config/database");

const Model = Sequelize.Model;

class Admin extends Model {}

Admin.init(
  {
    userId: {
      type: Sequelize.INTEGER,
    },
    companyId: {
      type: Sequelize.INTEGER,
    },
  },
  //first parameter is the connection instance
  //second parameter is for table name,sequelize makes it plural
  { sequelize, modelName: "admin", tableName: "admins", underscored: true }
);

module.exports = Admin;
