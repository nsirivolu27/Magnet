import * as cdk from "aws-cdk-lib";
import { MagnetStack } from "./magnet-stack.js";

const app = new cdk.App();
new MagnetStack(app, "LnkzProduction", {
  description: "Magnet private Postgres, App Runner service, encrypted exports, and observability",
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});