const User = require("./User");

const bcrypt = require("bcrypt");

const sequelize = require("../config/database");
const { createToken } = require("../helpers/createToken");

const Sequelize = require("sequelize");
const Admin = require("../SystemAdmins/Admin");
const Company = require("../company/Company");
const UserNotFoundException = require("../error/UserNotFoundException");
const ForbiddenException = require("../error/ForbiddenException");
const { Console } = require("winston/lib/winston/transports");
const AuthenticationException = require("../error/AuthenticationException");

const createUser = async (body, companyId) => {
  const { email, password, username, fullName } = body;

  let fullNameAdjustment;
  fullNameAdjustment = fullName === "" ? null : fullName;

  const hashedPwd = await bcrypt.hash(password, 12);

  const transaction = await sequelize.transaction();

  try {
    const user = await User.create(
      {
        companyId,
        username,
        email,
        fullName: fullNameAdjustment,
        password: hashedPwd,
      },
      { transaction }
    );
    await transaction.commit();
    const token = await createToken(user);
    return token;
  } catch (e) {
    await transaction.rollback();
  }
};

const listUsersFromCompany = async (page, size, authenticatedUser, search) => {
  const companyAdmin = await Admin.findOne({
    where: { companyId: authenticatedUser.companyId },
  });

  const usersWithCount = await User.findAndCountAll({
    where: {
      companyId: authenticatedUser.companyId,
      inactive: {
        [Sequelize.Op.not]:
          companyAdmin.userId === authenticatedUser.userId ? null : true,
      },
      username: {
        [Sequelize.Op.iLike]: "%" + search + "%",
      },
    },
    attributes: ["id", "username", "email", "fullName", "inactive", "isAdmin"],
    offset: page * size,
    limit: size,
    order: [
      ["inactive", "ASC"],
      ["id", "ASC"],
    ],
  });
  return {
    content: usersWithCount.rows,
    page,
    size,
    totalUser: usersWithCount.count,
    totalPages: Math.ceil(usersWithCount.count / size),
  };
};

const checkUsernameDuplicateInCompany = async (companyId, username) => {
  return await User.findOne({ where: { companyId, username } });
};

const getUserFromCompany = async (companyId, userId, getPassword = false) => {
  if (!Number.isInteger(+userId)) throw new UserNotFoundException();
  let user;
  if (!getPassword) {
    user = await User.findOne({
      where: {
        companyId,
        id: userId,
        // inactive: false,
      },
      attributes: [
        "id",
        "username",
        "email",
        "fullName",
        "companyId",
        "inactive",
        "isAdmin",
      ],
    });
  } else if (getPassword) {
    user = await User.findOne({
      where: {
        companyId,
        id: userId,
        // inactive: false,
      },
      attributes: [
        "id",
        "username",
        "email",
        "fullName",
        "companyId",
        "inactive",
        "isAdmin",
        "password",
      ],
    });
  }

  if (!user) throw new UserNotFoundException();

  return user;
};

const findByEmail = async (email) => {
  return await User.findOne({ where: { email } });
};

const updateUser = async (userId, updatedBody) => {
  const user = await User.findOne({ where: { id: userId } });
  if (updatedBody.username) {
    user.username = updatedBody.username;
  }
  if (typeof updatedBody.fullName !== undefined) {
    if (updatedBody.fullName === "") {
      user.fullName = null;
    } else {
      user.fullName = updatedBody.fullName;
    }
  }
  if (updatedBody.email) {
    user.email = updatedBody.email;
  }

  await user.save();

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    companyId: user.companyId,
    fullName: user.fullName,
    isAdmin: user.isAdmin,
    inactive: user.inactive,
  };
};

const updateUserPassword = async (userId, updatedBody) => {
  const user = await User.findOne({ where: { id: userId } });

  const { newPassword, oldPassword } = updatedBody;

  if (newPassword) {
    const hashedPwd = await bcrypt.hash(newPassword, 12);
    user.password = hashedPwd;
  }

  await user.save();

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    companyId: user.companyId,
    fullName: user.fullName,
    isAdmin: user.isAdmin,
    inactive: user.inactive,
  };
};

const deleteUser = async (companyId, userId) => {
  const user = await getUserFromCompany(companyId, userId);

  const systemAdmin = await Admin.findOne({
    where: { userId: user.id, companyId: user.companyId },
  });

  if (!systemAdmin) {
    if (user.inactive) {
      throw new ForbiddenException();
    }

    user.inactive = true;
    await user.save();
  } else {
    await Company.destroy({ where: { id: systemAdmin.companyId } });
    return;
  }
};

const deactivateUser = async (userId) => {
  const user = await User.findOne({ where: { id: userId } });
  user.inactive = false;
  await user.save();

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    companyId: user.companyId,
  };
};

module.exports = {
  findByEmail,
  createUser,
  listUsersFromCompany,
  getUserFromCompany,
  checkUsernameDuplicateInCompany,
  deleteUser,
  updateUser,
  deactivateUser,
  updateUserPassword,
};
