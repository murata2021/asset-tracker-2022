const request = require("supertest");
const app = require("../src/app");
const sequelize = require("../src/config/database");
const User = require("../src/user/User");
const Company = require("../src/company/Company");
const bcrypt = require("bcrypt");

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

  await postCompany();
});
afterAll(async () => {
  await sequelize.close();
});

const postCompany = async (account = validCompanyRegistration) => {
  return await request(app).post("/api/1.0/companies").send(account);
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

const patchCompany = async (companyId, body = null, options = {}) => {
  let agent = request(app);
  let token;
  try {
    if (options.auth) {
      const response = await agent.post("/api/1.0/auth").send(options.auth);
      token = response.body.token;
    }
    agent = request(app).patch(`/api/1.0/companies/${companyId}`);
    if (token) {
      agent.set("Authorization", `Bearer ${token}`);
    }
    if (options.token) {
      agent.set("Authorization", `Bearer ${options.token}`);
    }
    return agent.send(body);
  } catch (error) {
  }
};

describe("Company Update", () => {
  it("returns unauthorized when request sent without basic authorization", async () => {
    const response = await patchCompany(1);
    expect(response.status).toBe(401);
  });

  it("returns error body with message for unauthorized request ", async () => {
    const nowInMillis = new Date().getTime();
    const response = await patchCompany(1);
    const error = response.body;
    expect(error.path).toBe(`/api/1.0/companies/1`);
    expect(error.timestamp).toBeGreaterThan(nowInMillis);
    expect(error.message).toBe("Unauthorized");
  });

  it("returns unauthorized when request sent with incorrect email in basic authorization", async () => {
    const userInDb = await User.findOne({
      where: { email: validCompanyRegistration.email },
    });
    const { companyId, id } = userInDb;
    const response = await patchCompany(companyId, null, {
      auth: { email: "user1000@mail.com", password: "P4ssword" },
    });
    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Unauthorized");
  });

  it("returns unauthorized when request sent with incorrect password in basic authorization", async () => {
    const userInDb = await User.findOne({
      where: { email: validCompanyRegistration.email },
    });
    const { companyId, id, email } = userInDb;
    const response = await patchCompany(companyId, null, {
      auth: { email, password: "F4keP4ssword" },
    });
    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Unauthorized");
  });

  it("returns unauthorized when update request is sent with correct credentials (admin) but for different company", async () => {
    const companyAdmin = await User.findOne({
      where: { email: validCompanyRegistration.email },
    });
    await addUsers(companyAdmin.companyId, 5);
    const userToBeUpdated = await User.findOne({
      where: { email: "user2@mail.com" },
    });
    // const { companyId, id } = userToBeUpdated;
    const response = await patchCompany(2, null, {
      auth: { email: companyAdmin.email, password: "P4ssword" },
    });
    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Unauthorized");
  });

  it("returns forbidden 403 when update request is sent with correct credentials (non-admin)", async () => {
    const companyAdmin = await User.findOne({
      where: { email: validCompanyRegistration.email },
    });
    await addUsers(companyAdmin.companyId, 5);
    const userToBeUpdated = await User.findOne({
      where: { email: "user2@mail.com" },
    });
    const { companyId, id, email } = userToBeUpdated;
    const response = await patchCompany(companyAdmin.id, null, {
      auth: { email, password: "P4ssword" },
    });
    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "You are not allowed to perform this operation"
    );
  });

  it("returns 200 ok when valid update request sent from authorized user (admin)", async () => {
    const companyAdmin = await User.findOne({
      where: { email: validCompanyRegistration.email },
    });
    const { companyId, email } = companyAdmin;
    const validUpdate = { companyName: "validCompany" };
    const response = await patchCompany(companyId, validUpdate, {
      auth: { email, password: validCompanyRegistration.password },
    });
    expect(response.status).toBe(200);
  });

  it("updates companyName in database when valid update request is sent from authorized user", async () => {
    const companyAdmin = await User.findOne({
      where: { email: validCompanyRegistration.email },
    });
    const { companyId, email } = companyAdmin;
    const validUpdate = { companyName: "validCompany" };
    const response = await patchCompany(companyId, validUpdate, {
      auth: { email, password: validCompanyRegistration.password },
    });
    expect(response.status).toBe(200);

    const inDBCompany = await Company.findOne({
      where: { id: companyAdmin.companyId },
    });
    expect(inDBCompany.companyName).toBe(validUpdate.companyName);
  }, 10000);

  it("returns success body having only id, companyName and companyAdmin id", async () => {
    const companyAdmin = await User.findOne({
      where: { email: validCompanyRegistration.email },
    });
    const { companyId, email } = companyAdmin;
    const validUpdate = { companyName: "validCompany" };
    const response = await patchCompany(companyId, validUpdate, {
      auth: { email, password: validCompanyRegistration.password },
    });

    expect(Object.keys(response.body)).toEqual([
      "id",
      "companyName",
      "companyAdmin",
    ]);
  });

  it.each`
    value             | expectedMessage
    ${""}             | ${"Company name cannot be null"}
    ${"       "}      | ${"Company name cannot be null"}
    ${"a".repeat(52)} | ${"Must have min 1 and max 50 characters"}
  `(
    "returns bad request with $expectedMessage when the companyName is updated with $value",
    async ({ value, expectedMessage }) => {
      const companyAdmin = await User.findOne({
        where: { email: validCompanyRegistration.email },
      });
      const { companyId, email } = companyAdmin;
      const invalidUpdate = { companyName: value };
      const response = await patchCompany(companyId, invalidUpdate, {
        auth: { email, password: validCompanyRegistration.password },
      });
      expect(response.status).toBe(400);
      expect(response.body.validationErrors.companyName).toBe(expectedMessage);
    }
  );
});
