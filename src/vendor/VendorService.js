const sequelize = require("../config/database");
const VendorNotFoundException = require("../error/VendorNotFoundException");
const Vendor = require("./Vendor");

const Sequelize = require("sequelize");
const Asset = require("../asset/Asset");
const AssetGroup = require("../assetGroup/AssetGroup");
const Status = require("../status/Status");

const createVendor = async (body, userId, companyId) => {
  const vendorName = body.vendorName || null;
  const contactPerson = body.contactPerson || null;
  const email = body.email || null;
  const notes = body.notes || null;

  const transaction = await sequelize.transaction();

  try {
    const vendor = await Vendor.create(
      { companyId, userId, vendorName, contactPerson, email, notes },
      { transaction }
    );
    await transaction.commit();
    return vendor;
  } catch (e) {
    await transaction.rollback();
  }
};

const checkVendorNameDuplicateInCompany = async (companyId, vendorName) => {
  return await Vendor.findOne({ where: { companyId, vendorName } });
};

const listVendorsFromCompany = async (
  page,
  size,
  companyId,
  search,
  pagination = true
) => {
  if (pagination) {
    const vendorsWithCount = await Vendor.findAndCountAll({
      where: {
        companyId,
        vendorName: {
          [Sequelize.Op.iLike]: "%" + search + "%",
        },
      },
      attributes: [
        "id",
        "vendorName",
        "contactPerson",
        "email",
        "notes",
        "companyId",
        "userId",
      ],
      order: [["id", "ASC"]],

      offset: page * size,
      limit: size,
    });
    return {
      content: vendorsWithCount.rows,
      page,
      size,
      totalPages: Math.ceil(vendorsWithCount.count / size),
      totalVendors: vendorsWithCount.count,
    };
  } else {
    const vendors = await Vendor.findAll({
      where: {
        companyId,
        vendorName: {
          [Sequelize.Op.iLike]: "%" + search + "%",
        },
      },
      include: {
        model: Asset,
      },
      attributes: [
        "id",
        "vendorName",
        "contactPerson",
        "email",
        "notes",
        "companyId",
        "userId",
      ],
      order: [["id", "ASC"]],
    });
    return {
      vendors,
    };
  }
};

const getVendorFromCompany = async (companyId, vendorId) => {
  if (!Number.isInteger(+vendorId)) throw new VendorNotFoundException();

  const vendor = await Vendor.findOne({
    where: {
      companyId,
      id: vendorId,
    },
    attributes: [
      "id",
      "vendorName",
      "contactPerson",
      "email",
      "notes",
      "companyId",
      "userId",
    ],
  });

  if (!vendor) throw new VendorNotFoundException();

  return vendor;
};

const listVendorsAssets = async (vendorId, page, size, companyId, search) => {
  const assetsWithCount = await Asset.findAndCountAll({
    where: {
      companyId,
      assetName: {
        [Sequelize.Op.iLike]: "%" + search + "%",
      },
    },
    include: [
      {
        model: AssetGroup,
        attributes: ["id", "assetGroupName"],
      },
      {
        model: Status,
        as: "status",
        attributes: ["id", "statusName"],
        through: { attributes: [] },
      },
      {
        model: Vendor,
        as: "vendor",
        through: { attributes: [] },
        where: {
          id: vendorId,
        },
      },
    ],
    order: [["id", "ASC"]],

    offset: page * size,
    limit: size,
  });
  return {
    content: assetsWithCount.rows,
    page,
    size,
    totalPages: Math.ceil(assetsWithCount.count / size),
    totalAssets: assetsWithCount.count,
  };
};

const updateVendor = async (vendorId, updatedBody) => {
  const vendor = await Vendor.findOne({ where: { id: vendorId } });

  const updatedVendorName = updatedBody.vendorName || null;
  const updatedContactPerson = updatedBody.contactPerson || null;
  const updatedEmail = updatedBody.email || null;
  const updatedNotes = updatedBody.notes || null;

  vendor.vendorName = updatedVendorName;
  vendor.contactPerson = updatedContactPerson;
  vendor.email = updatedEmail;
  vendor.notes = updatedNotes;

  await vendor.save();

  const { id, vendorName, contactPerson, email, notes, companyId, userId } =
    vendor;
  return { id, vendorName, contactPerson, email, notes, companyId, userId };
};

const deleteVendor = async (companyId, vendorId) => {
  const vendor = await getVendorFromCompany(companyId, vendorId);

  return await Vendor.destroy({ where: { id: vendor.id } });
};

module.exports = {
  createVendor,
  checkVendorNameDuplicateInCompany,
  listVendorsFromCompany,
  getVendorFromCompany,
  updateVendor,
  deleteVendor,
  listVendorsAssets,
};
