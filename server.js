const app = require("./src/app");
const config = require("config");

const sequelize = require("./src/config/database");

const sync = async () => {
  await sequelize.sync({ force: true });
  //     // Code here
  console.log("All models were synchronized successfully.");
};

sync();

console.log("env: " + process.env.NODE_ENV);
const PORT=process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`LISTENING on ${PORT}`);
  console.log(config);
});
