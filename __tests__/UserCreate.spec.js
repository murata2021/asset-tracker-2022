const request = require("supertest");
const app = require("../src/app");
const sequelize = require("../src/config/database");
const User = require("../src/user/User");
const Company = require("../src/company/Company");
const Admin = require("../src/SystemAdmins/Admin");

const CompanyService = require("../src/company/CompanyService");

const jwt = require("jsonwebtoken");

let userWithoutCompanyId;

const validRegistration = {
  username: "user1",
  email: "user1@mail.com",
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

  userWithoutCompanyId = {
    username: "user5",
    email: "user5@mail.com",
    password: "P4ssword",
  };
});

afterAll(async () => {
  await sequelize.close();
});

const postCompany = async (account = validRegistration) => {
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

describe("User Creation", () => {
  it("returns 200 OK when user creation request is valid", async () => {
    const res = await postCompany();
    const { token } = res.body;
    const response = await postUser(
      userWithoutCompanyId,
      (options = { token })
    );

    expect(response.status).toBe(200);
  });
  it("returns token and successful message when user create request is valid", async () => {
    const res = await postCompany();
    const { token } = res.body;
    const response = await postUser(
      userWithoutCompanyId,
      (options = { token })
    );
    expect(response.body.message).toBe("User is created");
    expect(response.body.token).not.toBeNull();
  });

  it("saves the user to database", async () => {
    const res = await postCompany();
    const { token } = res.body;
    const response = await postUser(
      userWithoutCompanyId,
      (options = { token })
    );
    const userInDB = await User.findOne({
      where: { email: userWithoutCompanyId.email },
    });
    expect(userInDB).not.toBeNull();
    // expect(userInDB.isAdmin).toBe(false);
  });

  //   it("creates user in inactive mode", async () => {
  //     const res = await postCompany();
  //     const { token } = res.body;
  //     const response = await postUser(
  //       userWithoutCompanyId,
  //       (options = { token })
  //     );
  //     const userInDB = await User.findOne({
  //       where: { email: userWithoutCompanyId.email },
  //     });
  //     expect(userInDB).not.toBeNull();
  //     expect(userInDB.inactive).toBe(true);
  //   });

  it("hashes the password in database", async () => {
    const res = await postCompany();
    const { token } = res.body;
    const response = await postUser(
      userWithoutCompanyId,
      (options = { token })
    );
    const userInDB = await User.findOne({
      where: { email: userWithoutCompanyId.email },
    });
    expect(userInDB.password).not.toBe("P4ssword");
  });

  it("returns 400 when username is null", async () => {
    const invalidRegistration = {
      username: null,
      email: "user1@mail.com",
      password: "P4ssword",
    };
    const res = await postCompany();
    const { token } = res.body;
    const response = await postUser(invalidRegistration, (options = { token }));

    expect(response.status).toBe(400);
  });
  it("returns validationErrors field in response body when validation error occurs", async () => {
    const invalidRegistration = {
      username: null,
      email: "user1@mail.com",
      password: "P4ssword",
    };
    const res = await postCompany();
    const { token } = res.body;
    const response = await postUser(invalidRegistration, (options = { token }));
    const body = response.body;
    expect(body.validationErrors).not.toBeUndefined();
  });
  it("returns errors for both email and username when they are null", async () => {
    const invalidRegistration = {
      username: null,
      email: null,
      password: "P4ssword",
    };
    const res = await postCompany();
    const { token } = res.body;
    const response = await postUser(invalidRegistration, (options = { token }));
    const body = response.body;
    expect(Object.keys(body.validationErrors)).toEqual(["username", "email"]);
  });

  it.each`
    field         | value              | expectedMessage
    ${"username"} | ${null}            | ${"Username cannot be null"}
    ${"username"} | ${"usr"}           | ${"Must have min 4 and max 32 characters"}
    ${"username"} | ${"a".repeat(33)}  | ${"Must have min 4 and max 32 characters"}
    ${"email"}    | ${null}            | ${"E-mail cannot be null"}
    ${"email"}    | ${"notAnEmail"}    | ${"E-mail is not valid"}
    ${"email"}    | ${"mail.com"}      | ${"E-mail is not valid"}
    ${"email"}    | ${"user@mail"}     | ${"E-mail is not valid"}
    ${"email"}    | ${"user.mail.com"} | ${"E-mail is not valid"}
    ${"password"} | ${null}            | ${"Password cannot be null"}
    ${"password"} | ${"P4ssw"}         | ${"Password must be at least 6 characters"}
    ${"password"} | ${"alllowercase"}  | ${"Password must have at least 1 uppercase, 1 lowercase letter and 1 number"}
    ${"password"} | ${"ALLUPPERCASE"}  | ${"Password must have at least 1 uppercase, 1 lowercase letter and 1 number"}
    ${"password"} | ${"123123123"}     | ${"Password must have at least 1 uppercase, 1 lowercase letter and 1 number"}
    ${"password"} | ${"lowerandUPPER"} | ${"Password must have at least 1 uppercase, 1 lowercase letter and 1 number"}
    ${"password"} | ${"lower1231231"}  | ${"Password must have at least 1 uppercase, 1 lowercase letter and 1 number"}
    ${"password"} | ${"UPPER1231231"}  | ${"Password must have at least 1 uppercase, 1 lowercase letter and 1 number"}
  `(
    `returns $expectedMessage when the $field is $value`,
    async ({ field, value, expectedMessage }) => {
      const res = await postCompany();
      const companyInDB = await Company.findOne({
        where: { companyName: "FakeCorp" },
      });
      const newAccount = {
        username: "user2",
        email: "user2@mail.com",
        password: "P4ssword",
      };
      newAccount[field] = value;

      let agent = request(app).post(
        `/api/1.0/companies/${companyInDB.id}/users`
      );
      const { token } = res.body;
      agent.set("Authorization", `Bearer ${token}`);

      const response = await agent.send(newAccount);
      const body = response.body;
      expect(body.validationErrors[field]).toBe(expectedMessage);
    }
  );

  it.each`
    value          | expectedMessage
    ${null}        | ${"Unauthorized"}
    ${"not-exist"} | ${"Unauthorized"}
    ${1.5}         | ${"Unauthorized"}
  `(
    `returns $expectedMessage when the companyId is $value`,

    async ({ value, expectedMessage }) => {
      const res = await postCompany();
      const newAccount = {
        username: "user2",
        email: "user2@mail.com",
        password: "P4ssword",
      };

      let agent = request(app).post(`/api/1.0/companies/${value}/users`);
      const { token } = res.body;
      agent.set("Authorization", `Bearer ${token}`);

      const response = await agent.send(newAccount);
      const body = response.body;
      expect(body.message).toBe(expectedMessage);
    }
  );

  it("returns E-mail in use when same email is already in use", async () => {
    const duplicateUser = {
      username: "User2",
      email: "user1@mail.com",
      password: "P4ssword",
    };
    const res = await postCompany();
    const response = await postUser(duplicateUser, { token: res.body.token });
    expect(response.body.validationErrors.email).toBe("E-mail in use");
  });

  it("returns username in use when a person from the same company uses the same username", async () => {
    const duplicateUser = {
      username: "user1",
      email: "user2@mail.com",
      password: "P4ssword",
    };
    const res = await postCompany();
    const response = await postUser(duplicateUser, { token: res.body.token });
    expect(response.body.validationErrors.username).toBe("Username in use");
  });

  it("returns 403 forbidden when a non-admin user tries to create new user", async () => {
    const res = await postCompany();
    const { token } = res.body;
    const response = await postUser(
      userWithoutCompanyId,
      (options = { token })
    );

    const companyInDB = await Company.findOne({
      where: { companyName: "FakeCorp" },
    });

    let agent = request(app).post(`/api/1.0/companies/${companyInDB.id}/users`);
    agent.set("Authorization", `Bearer ${response.body.token}`);
    let response2 = await agent.send({
      username: "user52",
      email: "user52@mail.com",
      password: "P4ssword",
    });
    expect(response2.body.message).toBe(
      "You are not allowed to perform this operation"
    );
    expect(response2.status).toBe(403);
  });

  it("returns 401 unauthorized when a admin user tries to create new user for another company", async () => {
    await postCompany(); //first company is created FakeCorp
    const account = {
      username: "newUser",
      email: "newUser@mail.com",
      password: "P4ssword",
      companyName: "Newcorp",
    };
    const res = await postCompany(account); //secondCompanyIscreated
    const { token } = res.body;
    const otherCompanyInDB = await Company.findOne({
      where: { companyName: "FakeCorp" },
    });
    let agent = request(app).post(
      `/api/1.0/companies/${otherCompanyInDB.id}/users`
    );
    agent.set("Authorization", `Bearer ${token}`);
    let response2 = await agent.send({
      username: "user5",
      email: "user5@mail.com",
      password: "P4ssword",
    });
    expect(response2.body.message).toBe("Unauthorized");
    expect(response2.status).toBe(401);
  });
});
