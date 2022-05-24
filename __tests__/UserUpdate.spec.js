const request = require("supertest");
const app = require("../src/app");
const sequelize = require("../src/config/database");
const User = require("../src/user/User");
const Company = require("../src/company/Company");
const bcrypt = require("bcrypt");
const { Console } = require("winston/lib/winston/transports");

const validCompanyRegistration = {
  username: "admin1",
  email: "admin1@mail.com",
  password: "P4ssword",
  companyName: "FakeCorp",
};
beforeAll(async () => {
  //initializing the database
  if (process.env.NODE_ENV === "test") {
    await sequelize.sync({ force: true });
  }
});

beforeEach(async () => {
  //cleaning company table before each test
  await Company.destroy({ truncate: { cascade: true } });
  await User.destroy({ truncate: { cascade: true } });

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

const patchUser = async (companyId, userId, body = null, options = {}) => {
  let agent = request(app);
  let token;
  try {
    if (options.auth) {
      const response = await agent.post("/api/1.0/auth").send(options.auth);
      token = response.body.token;
    }
    agent = request(app).patch(
      `/api/1.0/companies/${companyId}/users/${userId}`
    );
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

describe("User Update", () => {
  it("returns unauthorized when request sent without basic authorization", async () => {
    const response = await patchUser(1, 1);
    expect(response.status).toBe(401);
  });

  it("returns error body with message for unauthorized request ", async () => {
    const nowInMillis = new Date().getTime();
    const response = await patchUser(1, 1);
    const error = response.body;
    expect(error.path).toBe(`/api/1.0/companies/1/users/1`);
    expect(error.timestamp).toBeGreaterThan(nowInMillis);
    expect(error.message).toBe("Unauthorized");
  });

  it("returns unauthorized when request sent with incorrect email in basic authorization", async () => {
    const userInDb = await User.findOne({
      where: { email: validCompanyRegistration.email },
    });
    const { companyId, id } = userInDb;
    const response = await patchUser(companyId, id, null, {
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
    const response = await patchUser(companyId, id, null, {
      auth: { email, password: "F4keP4ssword" },
    });
    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Unauthorized");
  });

  it("returns forbidden when update request is sent with correct credentials (non-admin) but for different user in the company", async () => {
    const companyAdmin = await User.findOne({
      where: { email: validCompanyRegistration.email },
    });
    await addUsers(companyAdmin.companyId, 5);
    const userToBeUpdated = await User.findOne({
      where: { email: "user2@mail.com" },
    });
    const { companyId, id } = userToBeUpdated;
    const response = await patchUser(companyId, id, null, {
      auth: { email: "user1@mail.com", password: "P4ssword" },
    });
    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "You are not allowed to perform this operation"
    );
  });

  it("returns unauthorized when update request is sent with correct credentials  but for an user in the different company", async () => {
    const secondCompanyRegistration = {
      username: "admin2",
      email: "admin2@mail.com",
      password: "P4ssword",
      companyName: "NewCo",
    };
    await postCompany(secondCompanyRegistration);
    const companyAdmin2 = await User.findOne({
      where: { email: secondCompanyRegistration.email },
    });
    await addUsers(companyAdmin2.companyId, 5);

    const userToBeUpdated = await User.findOne({
      where: { email: "user1@mail.com" },
    });
    const { companyId, id } = userToBeUpdated;
    const response = await patchUser(companyId, id, null, {
      auth: {
        email: validCompanyRegistration.email,
        password: validCompanyRegistration.password,
      },
    });
    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Unauthorized");
  });

  it("returns 200 ok when valid update request sent from authorized user (admin updating him/herself)", async () => {
    const companyAdmin = await User.findOne({
      where: { email: validCompanyRegistration.email },
    });
    // const savedUser = await addUser();
    const { companyId, id, email } = companyAdmin;
    const validUpdate = { username: "admin1-updated" };
    const response = await patchUser(companyId, id, validUpdate, {
      auth: { email, password: validCompanyRegistration.password },
    });
    expect(response.status).toBe(200);
  });

  it("returns 200 ok when valid update request sent from authorized user (admin updating another user in the same company)", async () => {
    const companyAdmin = await User.findOne({
      where: { email: validCompanyRegistration.email },
    });
    const { companyId, id, email } = companyAdmin;

    await addUsers(companyId, 4);
    const validUpdate = { username: "user1-updated" };
    const userToBeUpdated = await User.findOne({
      where: { email: "user1@mail.com" },
    });
    const response = await patchUser(
      userToBeUpdated.companyId,
      userToBeUpdated.id,
      validUpdate,
      {
        auth: { email, password: validCompanyRegistration.password },
      }
    );
    expect(response.status).toBe(200);
  });

  it("returns 200 ok when valid update request sent from authorized user (non-admin updating him/herself)", async () => {
    const companyAdmin = await User.findOne({
      where: { email: validCompanyRegistration.email },
    });
    const { companyId } = companyAdmin;

    await addUsers(companyId, 4);
    const validUpdate = { username: "user1-updated" };
    const userToBeUpdated = await User.findOne({
      where: { email: "user1@mail.com" },
    });
    const response = await patchUser(
      userToBeUpdated.companyId,
      userToBeUpdated.id,
      validUpdate,
      {
        auth: { email: userToBeUpdated.email, password: "P4ssword" },
      }
    );
    expect(response.status).toBe(200);
  });

  it("updates username and fullName in database when valid update request is sent from authorized user", async () => {
    const companyAdmin = await User.findOne({
      where: { email: validCompanyRegistration.email },
    });
    const { companyId } = companyAdmin;

    await addUsers(companyId, 4);
    const validUpdate = {
      username: "user1-updated",
      fullName: "UpdatedFullName",
    };
    const userToBeUpdated = await User.findOne({
      where: { email: "user1@mail.com" },
    });
    await patchUser(
      userToBeUpdated.companyId,
      userToBeUpdated.id,
      validUpdate,
      {
        auth: { email: userToBeUpdated.email, password: "P4ssword" },
      }
    );
    const inDBUser = await User.findOne({ where: { id: userToBeUpdated.id } });
    expect(inDBUser.username).toBe(validUpdate.username);
    expect(inDBUser.fullName).toBe(validUpdate.fullName);
  }, 10000);

  it("returns success body having  id, username,email,isAdmin and inactive", async () => {
    const companyAdmin = await User.findOne({
      where: { email: validCompanyRegistration.email },
    });
    const { companyId } = companyAdmin;

    await addUsers(companyId, 4);
    const validUpdate = { username: "user1-updated" };
    const userToBeUpdated = await User.findOne({
      where: { email: "user1@mail.com" },
    });
    const response = await patchUser(
      userToBeUpdated.companyId,
      userToBeUpdated.id,
      validUpdate,
      {
        auth: { email: userToBeUpdated.email, password: "P4ssword" },
      }
    );
    expect(Object.keys(response.body)).toEqual([
      "id",
      "username",
      "email",
      "companyId",
      "isAdmin",
      "inactive"
    ]);
  });

  it.each`
    value             | expectedMessage
    ${"admin1"}       | ${"Username in use"}
    ${""}             | ${"Username cannot be null"}
    ${"usr"}          | ${"Must have min 4 and max 32 characters"}
    ${"a".repeat(33)} | ${"Must have min 4 and max 32 characters"}
  `(
    "returns bad request with $expectedMessage when the username is updated with $value",
    async ({ value, expectedMessage }) => {
      const companyAdmin = await User.findOne({
        where: { email: validCompanyRegistration.email },
      });
      const { companyId } = companyAdmin;

      await addUsers(companyId, 4);
      const invalidUpdate = { username: value };
      const userToBeUpdated = await User.findOne({
        where: { email: "user1@mail.com" },
      });
      const response = await patchUser(
        userToBeUpdated.companyId,
        userToBeUpdated.id,
        invalidUpdate,
        {
          auth: { email: userToBeUpdated.email, password: "P4ssword" },
        }
      );

      expect(response.status).toBe(400);
      expect(response.body.validationErrors.username).toBe(expectedMessage);
    }
  );

  it.each`
    value             | expectedMessage
    ${"a".repeat(71)} | ${"Must have max 70 characters"}
  `(
    "returns bad request with $expectedMessage when the fullName is updated with $value",
    async ({ value, expectedMessage }) => {
      const companyAdmin = await User.findOne({
        where: { email: validCompanyRegistration.email },
      });
      const { companyId } = companyAdmin;
      await addUsers(companyId, 4);
      const invalidUpdate = { fullName: value };
      const userToBeUpdated = await User.findOne({
        where: { email: "user1@mail.com" },
      });
      const response = await patchUser(
        userToBeUpdated.companyId,
        userToBeUpdated.id,
        invalidUpdate,
        {
          auth: { email: userToBeUpdated.email, password: "P4ssword" },
        }
      );
      expect(response.status).toBe(400);
      expect(response.body.validationErrors.fullName).toBe(expectedMessage);
    }
  );

  it.each`
    value              | expectedMessage
    ${null}            | ${"Password cannot be null"}
    ${"P4ssw"}         | ${"Password must be at least 6 characters"}
    ${"alllowercase"}  | ${"Password must have at least 1 uppercase, 1 lowercase letter and 1 number"}
    ${"ALLUPPERCASE"}  | ${"Password must have at least 1 uppercase, 1 lowercase letter and 1 number"}
    ${"123123123"}     | ${"Password must have at least 1 uppercase, 1 lowercase letter and 1 number"}
    ${"lowerandUPPER"} | ${"Password must have at least 1 uppercase, 1 lowercase letter and 1 number"}
    ${"lower1231231"}  | ${"Password must have at least 1 uppercase, 1 lowercase letter and 1 number"}
    ${"UPPER1231231"}  | ${"Password must have at least 1 uppercase, 1 lowercase letter and 1 number"}
  `(
    "returns password validation error $expectedMessage when the new password value is set to $value",
    async ({ value, expectedMessage }) => {
      const companyAdmin = await User.findOne({
        where: { email: validCompanyRegistration.email },
      });
      const { companyId } = companyAdmin;
      await addUsers(companyId, 4);
      const invalidUpdate = { password: value };
      const userToBeUpdated = await User.findOne({
        where: { email: "user1@mail.com" },
      });
      const response = await patchUser(
        userToBeUpdated.companyId,
        userToBeUpdated.id,
        invalidUpdate,
        {
          auth: { email: userToBeUpdated.email, password: "P4ssword" },
        }
      );
      expect(response.body.validationErrors.password).toBe(expectedMessage);
    }
  );

  it("returns 200 when valid password is sent by authorized user", async () => {
    const companyAdmin = await User.findOne({
      where: { email: validCompanyRegistration.email },
    });
    const { companyId } = companyAdmin;
    await addUsers(companyId, 4);
    const validUpdate = { password: "N3w-Password" };
    const userToBeUpdated = await User.findOne({
      where: { email: "user1@mail.com" },
    });
    const response = await patchUser(
      userToBeUpdated.companyId,
      userToBeUpdated.id,
      validUpdate,
      {
        auth: { email: userToBeUpdated.email, password: "P4ssword" },
      }
    );
    expect(response.status).toBe(200);
  });

  it("updates the password in database when the request is valid", async () => {
    const companyAdmin = await User.findOne({
      where: { email: validCompanyRegistration.email },
    });
    const { companyId, email, id } = companyAdmin;
    await addUsers(companyId, 4);
    const validUpdate = { password: "N3w-Password" };
    const userToBeUpdated = await User.findOne({
      where: { email: "user1@mail.com" },
    });
    const response = await patchUser(
      userToBeUpdated.companyId,
      userToBeUpdated.id,
      validUpdate,
      {
        auth: { email, password: "P4ssword" },
      }
    );
    const userInDB = await User.findOne({
      where: { email: "user1@mail.com" },
    });
    expect(userInDB.password).not.toEqual(validUpdate.password);
  });
});

describe("User Deactivate", () => {
  const deactivateUser = async (companyId, userId, options = {}) => {
    let agent = request(app);
    let token;
    try {
      if (options.auth) {
        const response = await agent.post("/api/1.0/auth").send(options.auth);
        token = response.body.token;
      }
      agent = request(app).patch(
        `/api/1.0/companies/${companyId}/users/${userId}/deactivate`
      );
      if (token) {
        agent.set("Authorization", `Bearer ${token}`);
      }
      if (options.token) {
        agent.set("Authorization", `Bearer ${options.token}`);
      }
      return agent;
    } catch (error) {
    }
  };

  it("sends 401 Unauthorized when  no auth token is provided with the request", async () => {
    const companyAdmin = await User.findOne({
      where: { email: validCompanyRegistration.email },
    });
    const { companyId } = companyAdmin;

    await addUsers(companyId, 1);

    const userToBeDeactivated = await User.findOne({
      where: { email: "user1@mail.com" },
    });

    const response = await deactivateUser(
      userToBeDeactivated.companyId,
      userToBeDeactivated.id
    );

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Unauthorized");
  });
  it("sends 403 when the user is not admin", async () => {
    const companyAdmin = await User.findOne({
      where: { email: validCompanyRegistration.email },
    });
    const { companyId } = companyAdmin;

    await addUsers(companyId, 1);

    const userToBeDeactivated = await User.findOne({
      where: { email: "user1@mail.com" },
    });

    const response = await deactivateUser(
      userToBeDeactivated.companyId,
      userToBeDeactivated.id,
      {
        auth: { email: userToBeDeactivated.email, password: "P4ssword" },
      }
    );

    expect(response.status).toBe(403);
  });

  it("sends 401 when the company admin send deactivate request for user in other company", async () => {
    const companyAdmin = await User.findOne({
      where: { email: validCompanyRegistration.email },
    });

    await postCompany({
      ...validCompanyRegistration,
      email: "Admin2@mail.com",
      username: "admin2",
      companyName: "NewCo",
    });
    const companyAdmin2 = await User.findOne({
      where: { email: "Admin2@mail.com" },
    });
    const { companyId } = companyAdmin2;

    await addUsers(companyId, 5);

    const userToBeDeactivated = await User.findOne({
      where: { email: "user4@mail.com" },
    });

    const response = await deactivateUser(
      userToBeDeactivated.companyId,
      userToBeDeactivated.id,
      {
        auth: { email: companyAdmin.email, password: "P4ssword" },
      }
    );
    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Unauthorized");
  });

  it("sends 403 when the company admin send deactivate request for an already active user in the company", async () => {
    const companyAdmin = await User.findOne({
      where: { email: validCompanyRegistration.email },
    });

    const { companyId } = companyAdmin;

    await addUsers(companyId, 5);

    const userToBeDeactivated = await User.findOne({
      where: { email: "user3@mail.com" },
    });

    const response = await deactivateUser(
      userToBeDeactivated.companyId,
      userToBeDeactivated.id,
      {
        auth: { email: companyAdmin.email, password: "P4ssword" },
      }
    );
    expect(response.status).toBe(403);
    expect(response.body.message).toBe("User is already active");
  });

  it("sends 200 ok when the company admin send deactivate request for an inactive user in the company", async () => {
    const companyAdmin = await User.findOne({
      where: { email: validCompanyRegistration.email },
    });

    const { companyId } = companyAdmin;

    await addUsers(companyId, 0, 1);

    const userToBeDeactivated = await User.findOne({
      where: { email: "user1@mail.com" },
    });

    const response = await deactivateUser(
      userToBeDeactivated.companyId,
      userToBeDeactivated.id,
      {
        auth: { email: companyAdmin.email, password: "P4ssword" },
      }
    );
    expect(response.status).toBe(200);
    expect(Object.keys(response.body)).toEqual([
      "id",
      "username",
      "email",
      "companyId",
    ]);
  });

  it("activates the inactive user and saves the new status to the database when the company admin send deactivate request for an inactive user in the company", async () => {
    const companyAdmin = await User.findOne({
      where: { email: validCompanyRegistration.email },
    });
    const { companyId } = companyAdmin;

    await addUsers(companyId, 1);

    const userToBeDeactivated = await User.findOne({
      where: { email: "user1@mail.com" },
    });

    const response = await deactivateUser(
      userToBeDeactivated.companyId,
      userToBeDeactivated.id,
      {
        auth: { email: userToBeDeactivated.email, password: "P4ssword" },
      }
    );

    const deactivatedUser = await User.findOne({
      where: { email: "user1@mail.com" },
    });
    expect(deactivatedUser.inactive).toBe(false);
  });
});
