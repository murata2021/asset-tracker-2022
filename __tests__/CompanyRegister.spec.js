const request = require("supertest");
const app = require("../src/app");
const sequelize = require("../src/config/database");
const User = require("../src/user/User");
const Company = require("../src/company/Company");
const Admin = require("../src/SystemAdmins/Admin");

const CompanyService = require("../src/company/CompanyService");

beforeAll(async () => {
  //initializing the database
  if (process.env.NODE_ENV === "test") {
    await sequelize.sync();

  }
});

beforeEach(async () => {
  //cleaning company table before each test
  await Company.destroy({ truncate: { cascade: true } });
});

afterAll(async()=>{
  await sequelize.close()
})

const validRegistration = {
  username: "user1",
  email: "user1@mail.com",
  password: "P4ssword",
  companyName: "FakeCorp",
};

const postCompany = (account = validRegistration) => {
  return request(app).post("/api/1.0/companies").send(account);
};

describe("Company Registration", () => {
  it("returns 200 OK when registration request is valid", async () => {
    const response = await postCompany();
    expect(response.status).toBe(200);
  });
  it("returns token and successful message when registration request is valid", async () => {
    const response = await postCompany();
    expect(response.body.message).toBe("Account is created");
    expect(response.body.token).not.toBeNull();
  });

  it("saves the company to database", async () => {
    await postCompany();
    const companyList = await Company.findAll();
    expect(companyList.length).toBe(1);
    expect(companyList[0].companyName).toBe("FakeCorp");
  });

  it("saves the user who registers company as a system admin to the database", async () => {
    await postCompany();
    const savedUser = await User.findOne({
      where: { email: validRegistration.email },
    });
    expect(savedUser).not.toBeNull();
    // expect(savedUser.isAdmin).toBe(true);
    expect(savedUser.inactive).toBe(false);

    const systemAdmin = await Admin.findOne({
      where: { userId: savedUser.id },
    });
    expect(systemAdmin).not.toBeNull();
    expect(savedUser.companyId).toBe(systemAdmin.companyId);
    expect(savedUser.id).toBe(systemAdmin.userId);

  });

  it("hashes the password in database", async () => {
    await postCompany();
    const userList = await User.findAll();
    const savedUser = userList[0];
    expect(savedUser.password).not.toBe("P4ssword");
  });

  it("returns 400 when username is null", async () => {
    const invalidRegistration = {
      username: null,
      email: "user1@mail.com",
      password: "P4ssword",
      companyName: "FakeCorp",
    };
    const response = await postCompany(invalidRegistration);
    expect(response.status).toBe(400);
  });
  it("returns validationErrors field in response body when validation error occurs", async () => {
    const invalidRegistration = {
      username: null,
      email: "user1@mail.com",
      password: "P4ssword",
      companyName: "FakeCorp",
    };
    const response = await postCompany(invalidRegistration);
    const body = response.body;
    expect(body.validationErrors).not.toBeUndefined();
  });
  it("returns errors for both email and username when they are null", async () => {
    const invalidRegistration = {
      username: null,
      email: null,
      password: "P4ssword",
      companyName: "FakeCorp",
    };
    const response = await postCompany(invalidRegistration);
    const body = response.body;
    expect(Object.keys(body.validationErrors)).toEqual(["username", "email"]);
  });

  it.each`
    field            | value              | expectedMessage
    ${"companyName"} | ${null}            | ${"Company name cannot be null"}
    ${"companyName"} | ${"    "}          | ${"Company name cannot be null"}
    ${"username"}    | ${null}            | ${"Username cannot be null"}
    ${"username"}    | ${"usr"}           | ${"Must have min 4 and max 32 characters"}
    ${"username"}    | ${"a".repeat(33)}  | ${"Must have min 4 and max 32 characters"}
    ${"email"}       | ${null}            | ${"E-mail cannot be null"}
    ${"email"}       | ${"notAnEmail"}    | ${"E-mail is not valid"}
    ${"email"}       | ${"mail.com"}      | ${"E-mail is not valid"}
    ${"email"}       | ${"user@mail"}     | ${"E-mail is not valid"}
    ${"email"}       | ${"user.mail.com"} | ${"E-mail is not valid"}
    ${"password"}    | ${null}            | ${"Password cannot be null"}
    ${"password"}    | ${"P4ssw"}         | ${"Password must be at least 6 characters"}
    ${"password"}    | ${"alllowercase"}  | ${"Password must have at least 1 uppercase, 1 lowercase letter and 1 number"}
    ${"password"}    | ${"ALLUPPERCASE"}  | ${"Password must have at least 1 uppercase, 1 lowercase letter and 1 number"}
    ${"password"}    | ${"123123123"}     | ${"Password must have at least 1 uppercase, 1 lowercase letter and 1 number"}
    ${"password"}    | ${"lowerandUPPER"} | ${"Password must have at least 1 uppercase, 1 lowercase letter and 1 number"}
    ${"password"}    | ${"lower1231231"}  | ${"Password must have at least 1 uppercase, 1 lowercase letter and 1 number"}
    ${"password"}    | ${"UPPER1231231"}  | ${"Password must have at least 1 uppercase, 1 lowercase letter and 1 number"}
  `(
    "returns $expectedMessage when the $field is $value",
    async ({ field, value, expectedMessage }) => {
      const newAccount = {
        username: "user1",
        email: "user1@mail.com",
        password: "P4ssword",
        companyName: "FakeCorp",
      };

      newAccount[field] = value;
      const response = await postCompany(newAccount);
      const body = response.body;
      expect(body.validationErrors[field]).toBe(expectedMessage);
    }
  );

  it("returns E-mail in use when same email is already in use", async () => {
    const duplicateUser = {
      username: "User2",
      email: "user1@mail.com",
      password: "P4ssword",
      companyName: "FakeCorp2",
    };

    await postCompany((account = duplicateUser));
    const response = await postCompany();
    expect(response.body.validationErrors.email).toBe("E-mail in use");
  });
});

describe('Error Model', () => {
  it('returns path, timestamp, message and validationErrors in response when validation failure', async () => {
    const response = await postCompany({ ...validRegistration, username: null });
    const body = response.body;
    expect(Object.keys(body)).toEqual(['path', 'timestamp', 'message', 'validationErrors']);
  });

  // it('returns path, timestamp and message in response when request fails other than validation errors', async () => {
  //   await postUser();
  //   const token = 'this-token-does-not-exist';
  //   const response = await request(app)
  //     .post('/api/1.0/users/token/' + token)
  //     .send();
  //   const body = response.body;
  //   expect(Object.keys(body)).toEqual(['path', 'timestamp', 'message']);
  // });

  // it('returns path in error body', async () => {
  //   await postUser();
  //   const token = 'this-token-does-not-exist';
  //   const response = await request(app)
  //     .post('/api/1.0/users/token/' + token)
  //     .send();
  //   const body = response.body;
  //   expect(body.path).toEqual('/api/1.0/users/token/' + token);
  // });

  // it('returns timestamp in milliseconds within 5 seconds value in error body ', async () => {
  //   const nowInMillis = new Date().getTime();
  //   const fiveSecondsLater=nowInMillis+5*1000
  //   await postUser();
  //   const token = 'this-token-does-not-exist';
  //   const response = await request(app)
  //     .post('/api/1.0/users/token/' + token)
  //     .send();
  //   const body = response.body;
  //   expect(body.timestamp).toBeGreaterThan(nowInMillis);
  //   expect(body.timestamp).toBeLessThan(fiveSecondsLater);

  // });
});
