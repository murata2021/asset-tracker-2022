const request = require("supertest");
const app = require("../src/app");
const sequelize = require("../src/config/database");
const User = require("../src/user/User");
const Company = require("../src/company/Company");
const Admin = require("../src/SystemAdmins/Admin");
const bcrypt = require("bcrypt");

const CompanyService = require("../src/company/CompanyService");

let userWithoutCompanyId;

const validCompanyRegistration = {
  username: "admin1",
  email: "admin1@mail.com",
  password: "P4ssword",
  companyName: "FakeCorp",
};
beforeAll(async () => {
  //initializing the database
  if (process.env.NODE_ENV === "test") {
    await sequelize.sync();
  }
});

beforeEach(async () => {
  //cleaning company table before each test
  await Company.destroy({ truncate: { cascade: true } });
  await User.destroy({ truncate: { cascade: true } });

  userWithoutCompanyId = {
    username: "user200",
    email: "user200@mail.com",
    password: "P4ssword",
  };

  await postCompany();
});
afterAll(async () => {
  await sequelize.close();
});

const postCompany = async (account = validCompanyRegistration) => {
  return await request(app).post("/api/1.0/companies").send(account);
};

const postUser = async (user = userWithoutCompanyId, options = {}) => {
  const companyInDB = await Company.findOne({
    where: { companyName: "FakeCorp" },
  });

  let agent = request(app).post(`/api/1.0/companies/${companyInDB.id}/users`);

  if (options.token) {
    const token = options.token;
    agent.set("Authorization", `Bearer ${token}`);
  }

  return await agent.send(user);
};

const auth = async (options = {}) => {
  let token;
  let response;
  if (options.auth) {
    response = await request(app).post("/api/1.0/auth").send(options.auth);
    //   token = response.body.token;
  }
  // return token;
  return response;
};

const addUsers = async (companyId, activeUserCount, inactiveUserCount = 0) => {
  const hashedPwd = await bcrypt.hash("P4ssword", 1);
  for (let i = 0; i < activeUserCount + inactiveUserCount; i++) {
    await User.create({
      username: `user${i + 1}`,
      email: `user${i + 1}@mail.com`,
      inactive: i >= activeUserCount,
      password: hashedPwd,
      companyId,
    });
  }
};

const deleteUser = async (companyId, userId, options = {}) => {
  let agent = request(app).delete(
    `/api/1.0/companies/${companyId}/users/${userId}`
  );
  if (options.token) {
    agent.set("Authorization", `Bearer ${options.token}`);
  }
  return agent.send();
};

describe("User Delete", () => {
  it("returns unauthorized when request not logged in user sent request", async () => {
    const response = await deleteUser(1, 1);
    expect(response.status).toBe(401);
  });

  it("returns error body with message for not logged in user sent request ", async () => {
    const nowInMillis = new Date().getTime();
    const response = await deleteUser(1, 1);
    const error = response.body;
    expect(error.path).toBe("/api/1.0/companies/1/users/1");
    expect(error.timestamp).toBeGreaterThan(nowInMillis);
    expect(error.message).toBe("Unauthorized");
  });

  it("returns forbidden when delete request is sent with correct credentials but for different company", async () => {
    const response = await postCompany({
      username: "admin2",
      email: "admin2@mail.com",
      password: "P4ssword",
      companyName: "NewCorp",
    });
    const newCompanyToken = response.body.token;

    const firstCompanyAdminInDb = await User.findOne({
      where: { email: validCompanyRegistration.email },
    });
    const { companyId, id } = firstCompanyAdminInDb;
    const res = await deleteUser(companyId, id, { token: newCompanyToken });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });

  it("returns 403 forbidden when non-admin user sends delete request", async () => {
    const { email, password } = validCompanyRegistration;
    const resp = await auth({ auth: { email, password } });
    const admin = resp.body;
    const response = await postUser(
      userWithoutCompanyId,
      (options = { token: admin.token })
    );
    const userToken = response.body.token;
    const res = await deleteUser(admin.companyId, admin.id, {
      token: userToken,
    });
    expect(res.status).toBe(403);
    expect(res.body.message).toBe(
      "You are not allowed to perform this operation"
    );
  });

  it("returns 403 forbidden when non-admin user sends delete request even for him/herself", async () => {
    const { email, password } = validCompanyRegistration;
    const resp = await auth({ auth: { email, password } });
    const admin = resp.body;
    const response = await postUser(
      userWithoutCompanyId,
      (options = { token: admin.token })
    );
    const userToken = response.body.token;
    const userInDb = await User.findOne({
      where: { email: userWithoutCompanyId.email },
    });
    const res = await deleteUser(userInDb.companyId, userInDb.id, {
      token: userToken,
    });
    expect(res.status).toBe(403);
    expect(res.body.message).toBe(
      "You are not allowed to perform this operation"
    );
  });

  it("returns 200 ok with proper delete message when the delete request is valid", async () => {
    const { email, password } = validCompanyRegistration;
    const resp = await auth({ auth: { email, password } });
    const admin = resp.body;
    const response = await postUser(
      userWithoutCompanyId,
      (options = { token: admin.token })
    );
    const userInDb = await User.findOne({
      where: { email: userWithoutCompanyId.email },
    });

    const res = await deleteUser(userInDb.companyId, userInDb.id, {
      token: admin.token,
    });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("User is deleted");
    const userInDbAfterDeleteRequest = await User.findOne({
      where: { email: userWithoutCompanyId.email },
    });
  });

  it("returns 200 ok when the delete request is valid", async () => {
    const { email, password } = validCompanyRegistration;
    const resp = await auth({ auth: { email, password } });
    const admin = resp.body;
    const response = await postUser(
      userWithoutCompanyId,
      (options = { token: admin.token })
    );
    const userInDb = await User.findOne({
      where: { email: userWithoutCompanyId.email },
    });

    const res = await deleteUser(userInDb.companyId, userInDb.id, {
      token: admin.token,
    });
    expect(res.body.message).toBe("User is deleted");
    expect(res.status).toBe(200);
  });

  it("makes deleted users inactive field true ok when the delete request is valid", async () => {
    const { email, password } = validCompanyRegistration;
    const resp = await auth({ auth: { email, password } });
    const admin = resp.body;
    const response = await postUser(
      userWithoutCompanyId,
      (options = { token: admin.token })
    );
    const userInDb = await User.findOne({
      where: { email: userWithoutCompanyId.email },
    });

    const res = await deleteUser(userInDb.companyId, userInDb.id, {
      token: admin.token,
    });
    const userInDbAfterDeleteRequest = await User.findOne({
      where: { email: userWithoutCompanyId.email },
    });
    expect(userInDbAfterDeleteRequest.inactive).toBe(true);
  });

  it("completely deletes the company and everything belongs to it when the system admin account is deleted", async () => {
    const { email, password } = validCompanyRegistration;
    const resp = await auth({ auth: { email, password } });
    const admin = resp.body;
    await addUsers(admin.companyId, 20);
    const res = await deleteUser(admin.companyId, admin.id, {
      token: admin.token,
    });
    const userList = await User.findAll({
      where: { companyId: admin.companyId },
    });
    const deletedCompany = await Company.findOne({
      where: { id: admin.companyId },
    });
    expect(userList.length).toBe(0);
    expect(deletedCompany).toBeNull();
  });

  it.each`
    value
    ${null}
    ${"not-exist"}
    ${1.5}
    ${-1000}
    ${99999999999}
  `(
    `returns user not found when the userId is $value`,

    async ({ value }) => {
      const { email, password } = validCompanyRegistration;
      const resp = await auth({ auth: { email, password } });
      const admin = resp.body;
      const res = await deleteUser(admin.companyId, value, {
        token: admin.token,
      });

      expect(res.body.message).toBe("User not found");
      expect(res.status).toBe(404);
    }
  );

  it("Sends a 403 forbidden when delete request with valid admin credentials is sent for already inactive user", async () => {
    const { email, password } = validCompanyRegistration;
    const resp = await auth({ auth: { email, password } });
    const admin = resp.body;
    await addUsers(admin.companyId, 0, 1);

    const inactiveUserInDb = await User.findOne({
      where: { companyId: admin.companyId, inactive: true },
    });

    const res = await deleteUser(
      inactiveUserInDb.companyId,
      inactiveUserInDb.id,
      {
        token: admin.token,
      }
    );

    expect(res.body.message).toBe("User is inactive");
    expect(res.status).toBe(403);
  });
});
