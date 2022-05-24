const request = require("supertest");
const app = require("../src/app");
const sequelize = require("../src/config/database");
const User = require("../src/user/User");
const Company = require("../src/company/Company");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const validRegistration = {
  username: "admin1",
  email: "admin1@mail.com",
  password: "P4ssword",
  companyName: "FakeCorp",
};

const postCompany = (account = validRegistration) => {
  return request(app).post("/api/1.0/companies").send(account);
};

beforeAll(async () => {
  if (process.env.NODE_ENV === "test") {
    await sequelize.sync({ force: true });
  }
});

beforeEach(async () => {
  await Company.destroy({ truncate: { cascade: true } });
  await User.destroy({ truncate: { cascade: true } });

  await postCompany();
});

const auth = async (options = {}) => {
  let token;
  if (options.auth) {
    const response = await request(app)
      .post("/api/1.0/auth")
      .send(options.auth);
    token = response.body.token;
  }
  return token;
};

const getUsers = (companyId, options = {}) => {
  const agent = request(app).get(`/api/1.0/companies/${companyId}/users`);
  if (options.token) {
    agent.set("Authorization", `Bearer ${options.token}`);
  }
  return agent;
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

describe("Listing Users", () => {
  it("returns 200 ok when there are no user in database and request is coming from authorized user", async () => {
    const companyInDb = await Company.findOne({
      where: { companyName: "FakeCorp" },
    });
    const { email, password } = validRegistration;
    const token = await auth({ auth: { email, password } });
    const response = await getUsers(companyInDb.id, { token });
    expect(response.status).toBe(200);
  });

  it("returns 401 unauthorized when the request is coming from unauthorized user", async () => {
    const companyInDb = await Company.findOne({
      where: { companyName: "FakeCorp" },
    });
    const response = await getUsers(companyInDb.id);
    expect(response.status).toBe(401);
  });

  it("returns 401 unauthorized when user from a company sends request for a different company", async () => {
    const resp = await postCompany({
      ...validRegistration,
      email: "newco@mail.com",
      companyName: "NewCo",
    });
    const companyInDb = await Company.findOne({
      where: { companyName: "FakeCorp" },
    });
    const response = await getUsers(companyInDb.id, { token: resp.body.token });
    expect(response.status).toBe(401);
  });

  it("returns page object as response body", async () => {
    const companyInDb = await Company.findOne({
      where: { companyName: "FakeCorp" },
    });
    const { email, password } = validRegistration;
    const token = await auth({ auth: { email, password } });
    const response = await getUsers(companyInDb.id, { token });

    expect(Object.keys(response.body)).toEqual([
      "content",
      "page",
      "size",
      "totalUser",
      "totalPages",
    ]);
  });

  it("returns 10 users in page content when there are 11 users in database for the company", async () => {
    const companyInDb = await Company.findOne({
      where: { companyName: "FakeCorp" },
    });

    const { email, password } = validRegistration;
    const token = await auth({ auth: { email, password } });
    await addUsers(companyInDb.id, 11);
    const response = await getUsers(companyInDb.id, { token });
    expect(response.body.content.length).toBe(10);
  });

  it("returns only id, username, email,fullName, inactive, isAdmin in content array for each user", async () => {
    const companyInDb = await Company.findOne({
      where: { companyName: "FakeCorp" },
    });
    const { email, password } = validRegistration;
    const token = await auth({ auth: { email, password } });
    await addUsers(companyInDb.id, 11);
    const response = await getUsers(companyInDb.id, { token });
    const user = response.body.content[0];
    expect(Object.keys(user)).toEqual([
      "id",
      "username",
      "email",
      "fullName",
      "inactive",
      "isAdmin",
    ]);
  });

  it("returns 3 as totalPages when there are 15 active users and 7 inactive users", async () => {
    const companyInDb = await Company.findOne({
      where: { companyName: "FakeCorp" },
    });
    const { email, password } = validRegistration;
    const token = await auth({ auth: { email, password } });
    await addUsers(companyInDb.id, 15, 7);
    const response = await getUsers(companyInDb.id, { token });
    expect(response.body.totalPages).toBe(3);
  });

  it("returns second page users and page indicator when page is set as 1 in request parameter", async () => {
    const companyInDb = await Company.findOne({
      where: { companyName: "FakeCorp" },
    });
    const { email, password } = validRegistration;
    const token = await auth({ auth: { email, password } });
    await addUsers(companyInDb.id, 15, 7);
    const response = await getUsers(companyInDb.id, { token }).query({
      page: 1,
    });
    //first one is admin
    expect(response.body.content[0].email).toBe("user10@mail.com");
    expect(response.body.page).toBe(1);
  });

  it("returns first page when page is set below zero as a request parameter ", async () => {
    const companyInDb = await Company.findOne({
      where: { companyName: "FakeCorp" },
    });
    const { email, password } = validRegistration;
    const token = await auth({ auth: { email, password } });
    await addUsers(companyInDb.id, 15, 7);
    const response = await getUsers(companyInDb.id, { token }).query({
      page: -2,
    });
    expect(response.body.page).toBe(0);
  });

  it("returns 5 users and corresponding size indicator when size is set as 5 in request parameter", async () => {
    const companyInDb = await Company.findOne({
      where: { companyName: "FakeCorp" },
    });
    const { email, password } = validRegistration;
    const token = await auth({ auth: { email, password } });
    await addUsers(companyInDb.id, 15, 7);
    const response = await getUsers(companyInDb.id, { token }).query({
      size: 5,
    });
    expect(response.body.content.length).toBe(5);
    expect(response.body.size).toBe(5);
  });

  it("returns 10 users and corresponding size indicator when size is set 1000", async () => {
    const companyInDb = await Company.findOne({
      where: { companyName: "FakeCorp" },
    });
    const { email, password } = validRegistration;
    const token = await auth({ auth: { email, password } });
    await addUsers(companyInDb.id, 15, 7);
    const response = await getUsers(companyInDb.id, { token }).query({
      size: 1000,
    });
    expect(response.body.content.length).toBe(10);
    expect(response.body.size).toBe(10);
  });

  it("returns page as zero and size as 10 when non-numeric query params provided for both", async () => {
    const companyInDb = await Company.findOne({
      where: { companyName: "FakeCorp" },
    });
    const { email, password } = validRegistration;
    const token = await auth({ auth: { email, password } });
    await addUsers(companyInDb.id, 15, 7);
    const response = await getUsers(companyInDb.id, { token }).query({
      page: "page",
      size: "size",
    });
    expect(response.body.size).toBe(10);
    expect(response.body.page).toBe(0);
  });

  it("does not show the other companies' users in the user list", async () => {
    const resp = await postCompany({
      ...validRegistration,
      email: "newco@mail.com",
      companyName: "NewCo",
    });
    const otherCompanyInDb = await Company.findOne({
      where: { companyName: "FakeCorp" },
    });
    const companyInDb = await Company.findOne({
      where: { companyName: "NewCo" },
    });
    await addUsers(companyInDb.id, 32);
    await addUsers(otherCompanyInDb.id, 15);
    const response = await getUsers(companyInDb.id, { token: resp.body.token });
    expect(response.body.totalPages).toBe(4); //Math.ceil(32/10)=>4
  });

  it("shows user list as well when non-admin user sends listing request ", async () => {
    const resp = await postCompany({
      ...validRegistration,
      email: "newco@mail.com",
      companyName: "NewCo",
    });
    const otherCompanyInDb = await Company.findOne({
      where: { companyName: "FakeCorp" },
    });
    const companyInDb = await Company.findOne({
      where: { companyName: "NewCo" },
    });
    await addUsers(companyInDb.id, 22);
    await addUsers(otherCompanyInDb.id, 9);
    const token = await auth({
      auth: { email: "user1@mail.com", password: "P4ssword" },
    });

    const response = await getUsers(companyInDb.id, { token });
    expect(response.body.totalPages).toBe(3); //Math.ceil(22/10)=>3
  });
});

describe("Get User", () => {
  const getUser = (companyId, userId, options = {}) => {
    let agent = request(app).get(
      `/api/1.0/companies/${companyId}/users/${userId}`
    );
    if (options.token) {
      agent.set(`Authorization`, `Bearer ${options.token}`);
    }
    return agent.send();
  };

  it("returns 404 and proper error body when user not found", async () => {
    const nonExistUserId = 1000;
    const { email, password } = validRegistration;
    const companyInDb = await Company.findOne({
      where: { companyName: "FakeCorp" },
    });
    const token = await auth({ auth: { email, password } });
    const nowInMillis = new Date().getTime();
    const response = await getUser(companyInDb.id, nonExistUserId, {
      token,
    });
    const error = response.body;
    expect(response.status).toBe(404);
    expect(error.timestamp).toBeGreaterThan(nowInMillis);
    expect(error.message).toBe("User not found");
    expect(error.path).toBe(
      `/api/1.0/companies/${companyInDb.id}/users/${nonExistUserId}`
    );
    expect(Object.keys(error)).toEqual(["path", "timestamp", "message"]);
  });

  it("returns 401 unauthorized and proper error body when unauthorized user sends a request", async () => {
    const nowInMillis = new Date().getTime();
    const companyInDb = await Company.findOne({
      where: { companyName: "FakeCorp" },
    });
    const response = await getUser(companyInDb.id, 1);
    const error = response.body;
    expect(response.status).toBe(401);
    expect(error.timestamp).toBeGreaterThan(nowInMillis);
    expect(error.message).toBe("Unauthorized");
    expect(error.path).toBe(`/api/1.0/companies/${companyInDb.id}/users/1`);
    expect(Object.keys(error)).toEqual(["path", "timestamp", "message"]);
  });

  it("returns 401 unauthorized when user from another company sends a request", async () => {
    const token = await postCompany({
      ...validRegistration,
      email: "admin2@mail.com",
      companyName: "NewCo",
    });
    const companyInDb = await Company.findOne({
      where: { companyName: "FakeCorp" },
    });
    const response = await getUser(companyInDb.id, 1, { token });
    const error = response.body;
    expect(response.status).toBe(401);
    expect(error.message).toBe("Unauthorized");
  });

  it("returns 200 OK when user exists and request is coming from authorized user", async () => {
    const companyInDb = await Company.findOne({
      where: { companyName: "FakeCorp" },
    });
    const { email, password } = validRegistration;
    const token = await auth({ auth: { email, password } });
    await addUsers(companyInDb.id, 10);
    const user = await User.findOne({ where: { email: "user1@mail.com" } });
    const response = await getUser(companyInDb.id, user.id, { token });
    expect(response.status).toBe(200);
  });

  it("returns id, username, fullName email, companyId, inactive and isAdmin in response body when user exists and request is coming from authorized user", async () => {
    const companyInDb = await Company.findOne({
      where: { companyName: "FakeCorp" },
    });
    const { email, password } = validRegistration;
    const token = await auth({ auth: { email, password } });
    await addUsers(companyInDb.id, 10);
    const user = await User.findOne({ where: { email: "user1@mail.com" } });
    const response = await getUser(companyInDb.id, user.id, { token });
    expect(Object.keys(response.body)).toEqual([
      "id",
      "username",
      "email",
      "fullName",
      "companyId",
      "inactive",
      "isAdmin",
    ]);
  });
});
