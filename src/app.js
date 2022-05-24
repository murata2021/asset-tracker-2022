

const express = require("express");
const cors = require('cors')


const CompanyRouter = require("./company/CompanyRouter");
const UserRouter = require("./user/UserRouter");
const AuthRouter=require("./auth/AuthRouter")
const AssetGroupRouter=require("./assetGroup/AssetGroupRouter")
const StatusRouter=require("./status/StatusRouter")
const VendorRouter=require("./vendor/VendorRouter")
const AssetRouter=require("./asset/AssetRouter")



const ErrorHandler=require("../src/error/ErrorHandler");
const { tokenAuthentication } = require("./middlewares/tokenAuthentication");


const app = express();
//to parsing incoming data
app.use(express.json());
app.use(cors())
app.use(tokenAuthentication)

app.use(CompanyRouter)
app.use(UserRouter)
app.use(AuthRouter)
app.use(AssetGroupRouter)
app.use(StatusRouter)
app.use(VendorRouter)

app.use(AssetRouter)



app.use(ErrorHandler);

module.exports = app;
