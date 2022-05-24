const request = require("supertest");
const app = require("../src/app");
const User = require("../src/user/User");
const sequelize = require("../src/config/database");
const bcrypt = require("bcrypt");
const Company = require("../src/company/Company");

let userWithoutCompanyId;

const validRegistration = {
  username: "user1",
  email: "user1@mail.com",
  password: "P4ssword",
  companyName: "FakeCorp",
};

const newCompany = {
  username: "user10",
  email: "user10@mail.com",
  password: "P4ssword",
  companyName: "NewCo",
};

const companyCredentials = {
  email: validRegistration.email,
  password: validRegistration.password,
};

const postCompany = async (account = validRegistration) => {
  return await request(app).post("/api/1.0/companies").send(account);
};

beforeAll(async () => {
  if (process.env.NODE_ENV === "test") {
    await sequelize.sync();
  }
});

beforeEach(async () => {
  await Company.destroy({ truncate: { cascade: true } });

  userWithoutCompanyId = {
    username: "user5",
    email: "user5@mail.com",
    password: "P4ssword",
  };

  await postCompany();
});

const createUser = async (user = userWithoutCompanyId) => {
  const res = await postCompany(newCompany);
  const companyInDB = await Company.findOne({
    where: { companyName: "NewCo" },
  });

  let agent = request(app).post(`/api/1.0/companies/${companyInDB.id}/users`);

  agent.set("Authorization", `Bearer ${res.body.token}`);

  return await agent.send(user);
};

const postAuthentication = async (credentials) => {
  return request(app).post("/api/1.0/auth").send(credentials);
};

describe("Authentication", () => {
  it("returns 200 when credentials are correct", async () => {
    const response = await postAuthentication(companyCredentials);
    expect(response.status).toBe(200);
  });

  it("returns only user id, username,isAdmin, token and companyId when login success", async () => {
    const response = await postAuthentication(companyCredentials);
    expect(response.body.id).toEqual(expect.any(Number));
    expect(response.body.username).toBe(validRegistration.username);
    expect(Object.keys(response.body)).toEqual([
      "id",
      "username",
      "companyId",
      "isAdmin",
      "token",
    ]);
  });

  it("returns 200 and proper response body when non-admin users' credentials are correct", async () => {
    await createUser();
    const { email, password, username } = userWithoutCompanyId;
    const response = await postAuthentication({ email, password });
    expect(response.status).toBe(200);
    expect(response.body.id).toEqual(expect.any(Number));
    expect(response.body.username).toBe(username);
    expect(Object.keys(response.body)).toEqual([
      "id",
      "username",
      "companyId",
      "isAdmin",
      "token",
    ]);
  });

  it("returns 401 when user does not exist", async () => {
    const response = await postAuthentication({
      email: "non-user@mail.com",
      password: "F4keUser!",
    });
    expect(response.status).toBe(401);
  });

  it("returns proper error body when authentication fails", async () => {
    const nowInMillis = new Date().getTime();
    const response = await postAuthentication({
      email: "non-user@mail.com",
      password: "F4keUser!",
    });
    const error = response.body;
    expect(error.path).toBe("/api/1.0/auth");
    expect(error.timestamp).toBeGreaterThan(nowInMillis);
    expect(Object.keys(error)).toEqual(["path", "timestamp", "message"]);
  });

  it("returns message when authentication fails", async () => {
    const response = await postAuthentication({
      email: "non-user@mail.com",
      password: "F4keUser!",
    });
    const error = response.body;
    expect(error.message).toBe("Incorrect credentials");
  });

  it("returns 401 when the password is wrong", async () => {
    const { email } = validRegistration;
    const response = await postAuthentication({
      email,
      password: "WrongP4ssword",
    });
    const error = response.body;
    expect(response.status).toBe(401);
    expect(error.message).toBe("Incorrect credentials");
  });

  it("returns 403 when logging in with an inactive account", async () => {
    const { email, password } = userWithoutCompanyId;
    await createUser();

    const userInDB = await User.findOne({ where: { email } });
    userInDB.inactive = true;
    await userInDB.save();

    const response = await postAuthentication({ email, password });
    expect(response.status).toBe(403);
  });

  it("returns proper error body when inactive user authentication fails", async () => {
    const nowInMillis = new Date().getTime();
    const { email, password } = userWithoutCompanyId;
    await createUser();
    const userInDB = await User.findOne({ where: { email } });
    userInDB.inactive = true;
    await userInDB.save();

    const response = await postAuthentication({ email, password });
    const error = response.body;
    expect(error.path).toBe("/api/1.0/auth");
    expect(error.timestamp).toBeGreaterThan(nowInMillis);
    expect(Object.keys(error)).toEqual(["path", "timestamp", "message"]);
  });

  it("returns message when authentication fails for inactive account", async () => {
    const { email, password } = userWithoutCompanyId;
    await createUser();
    const userInDB = await User.findOne({ where: { email } });
    userInDB.inactive = true;
    await userInDB.save();

    const response = await postAuthentication({ email, password });
    const error = response.body;
    expect(error.message).toBe("User is inactive");
  });

  it("returns 401 when e-mail is not valid", async () => {
    const response = await postAuthentication({ password: "P4ssword" });
    expect(response.status).toBe(401);
  });
  it("returns 401 when password is not valid", async () => {
    const response = await postAuthentication({ email: "user1@mail.com" });
    expect(response.status).toBe(401);
  });
  it("returns 401 when the body is empty", async () => {
    const response = await postAuthentication();
    expect(response.status).toBe(401);
  });
});
