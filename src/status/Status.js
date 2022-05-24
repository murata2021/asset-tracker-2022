const Sequelize = require("sequelize");
const AssetsStatuses = require("../assets_statuses/AssetsStatuses");
const sequelize = require("../config/database");

const Model = Sequelize.Model;

class Status extends Model {}

Status.init(
  {
    statusName: {
      type: Sequelize.STRING,
    },
    companyId: {
      type: Sequelize.INTEGER,
    },
    userId: {
      type: Sequelize.INTEGER,
    },
  },
  { sequelize, modelName: "status" }
);

module.exports = Status;
