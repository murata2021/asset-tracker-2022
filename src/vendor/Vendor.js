const Sequelize = require("sequelize");

const Asset = require("../asset/Asset");
const AssetsVendors = require("../assets_vendors/AssetsVendors");
const sequelize = require("../config/database");

const Model = Sequelize.Model;

class Vendor extends Model {}

Vendor.init(
  {
    vendorName: {
      type: Sequelize.STRING,
    },
    companyId: {
      type: Sequelize.INTEGER,
    },
    userId: {
      type: Sequelize.INTEGER,
    },
    contactPerson: {
      type: Sequelize.STRING,
    },
    email: {
      type: Sequelize.STRING,
    },
    notes: {
      type: Sequelize.STRING,
    },
  },
  { sequelize, modelName: "vendor" }
);

module.exports = Vendor;
