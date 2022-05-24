const sequelize = require("../config/database");
const bcrypt = require("bcrypt");

const { createToken } = require("../helpers/createToken");

const User = require("../user/User");
const Company = require("./Company");
const Admin = require("../SystemAdmins/Admin");

const AssetGroup = require("../assetGroup/AssetGroup");

const ForbiddenException = require("../error/ForbiddenException");
const Status = require("../status/Status");
const Asset = require("../asset/Asset");
const Vendor = require("../vendor/Vendor");

const UserService = require("../user/UserService");

const createAccount = async (body) => {
  const { email, companyName, password, username, fullName } = body;

  let fullNameAdjustment;
  fullNameAdjustment = fullName === "" ? null : fullName;

  const hashedPwd = await bcrypt.hash(password, 12);

  const transaction = await sequelize.transaction();

  try {
    const company = await Company.create({ companyName }, { transaction });
    const user = await User.create(
      {
        username,
        email,
        fullName: fullNameAdjustment,
        password: hashedPwd,
        companyId: company.getDataValue("id"),
        isAdmin: true,
        inactive: false,
      },
      { transaction }
    );

    await Admin.create(
      {
        userId: user.getDataValue("id"),
        companyId: company.getDataValue("id"),
      },
      { transaction }
    );
    await AssetGroup.create(
      {
        assetGroupName: "miscellaneous",
        userId: user.getDataValue("id"),
        companyId: company.getDataValue("id"),
      },
      { transaction }
    );

    const statusList = [
      "Disposed",
      "Expired",
      "In Repair",
      "In Store",
      "In Use",
    ];
    for (let statusName of statusList) {
      await Status.create(
        {
          statusName,
          userId: user.getDataValue("id"),
          companyId: company.getDataValue("id"),
        },
        { transaction }
      );
    }

    await transaction.commit();
    const token = await createToken(user);
    return {
      token,
      companyId: company.getDataValue("id"),
      userId: user.getDataValue("id"),
    };
  } catch (e) {
    await transaction.rollback();
  }
};

const findById = async (id) => {
  return Company.findOne({
    where: { id: id },
    include: [
      {
        model: Vendor,
        attributes: ["id", "vendorName"],
      },
      {
        model: User,
        attributes: ["id", "username"],
      },
      {
        model: Asset,
        attributes: ["id", "assetName"],
      },
      {
        model: AssetGroup,
        attributes: ["id", "assetGroupName"],
      },
    ],
  });
};

const updateCompany = async (userId, companyId, updatedBody) => {
  const company = await Company.findOne({ where: { id: companyId } });

  const admin = await Admin.findOne({ where: { userId, companyId } });

  if (!admin)
    throw new ForbiddenException(
      "You are not allowed to perform this operation"
    );

  if (updatedBody.companyName) {
    company.companyName = updatedBody.companyName;
  }

  await company.save();

  return {
    id: company.id,
    companyName: company.companyName,
    companyAdmin: admin.userId,
  };
};

const deleteCompany = async (companyId, userId) => {
  const user = await UserService.getUserFromCompany(companyId, userId);

  const systemAdmin = await Admin.findOne({
    where: { userId: user.id, companyId: user.companyId },
  });

  if (!systemAdmin) {
    throw new ForbiddenException();
  } else {
    await Company.destroy({ where: { id: systemAdmin.companyId } });
    return;
  }
};

module.exports = { createAccount, findById, updateCompany, deleteCompany };
