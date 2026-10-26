import assert from "node:assert/strict";
import test from "node:test";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { MagnetStack } from "./magnet-stack.js";

const template = Template.fromStack(new MagnetStack(new App(), "LnkzProduction"));

test("public service is opt-in and uses production auth, verified TLS and runtime secrets", () => {
  template.hasParameter("EnableAppRunner", { Default: "false", AllowedValues: ["true", "false"] });
  template.hasResource("AWS::AppRunner::Service", { Condition: "EnableAppRunnerCondition" });
  template.hasResourceProperties("AWS::AppRunner::Service", {
    SourceConfiguration: {
      AutoDeploymentsEnabled: false,
      ImageRepository: {
        ImageConfiguration: {
          RuntimeEnvironmentVariables: Match.arrayWith([{ Name: "NODE_ENV", Value: "production" }, { Name: "DATABASE_SSL", Value: "true" }]),
          RuntimeEnvironmentSecrets: Match.arrayWith([{ Name: "DATABASE_SECRET_JSON", Value: Match.anyValue() }, { Name: "MAGNET_API_KEY", Value: Match.anyValue() }]),
        },
      },
    },
    HealthCheckConfiguration: Match.objectLike({ Protocol: "HTTP", Path: "/ready" }),
  });
});

test("stateful resources are private, encrypted and retained", () => {
  template.hasResourceProperties("AWS::RDS::DBInstance", {
    PubliclyAccessible: false, StorageEncrypted: true, DeletionProtection: true, BackupRetentionPeriod: 7,
  });
  template.hasResource("AWS::RDS::DBInstance", { DeletionPolicy: "Retain" });
  template.hasResourceProperties("AWS::S3::Bucket", {
    PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true },
  });
  template.hasResourceProperties("AWS::ECR::Repository", { ImageScanningConfiguration: { ScanOnPush: true } });
  template.hasResourceProperties("AWS::KMS::Key", { EnableKeyRotation: true });
});

test("runtime IAM cannot read the migration credential", () => {
  const policies = Object.values(template.findResources("AWS::IAM::Policy"));
  const runtime = policies.find((policy) => JSON.stringify(policy.Properties.Roles).includes("AppRunnerInstanceRole"));
  assert.ok(runtime);
  const text = JSON.stringify(runtime.Properties.PolicyDocument);
  assert.ok(text.includes("ApplicationDatabaseSecret"));
  const migrator = Object.entries(template.findResources("AWS::SecretsManager::Secret"))
    .find(([, resource]) => resource.Properties.Name === "LnkzProduction/migration-database")?.[0];
  assert.ok(migrator);
  assert.ok(!text.includes(migrator));
});

test("CloudWatch Logs KMS access is restricted to the provisioned log group", () => {
  const key = Object.values(template.findResources("AWS::KMS::Key"))[0];
  const statements = key.Properties.KeyPolicy.Statement as Array<Record<string, any>>;
  const grant = statements.find((statement) => JSON.stringify(statement.Principal?.Service ?? "").includes("logs."));
  assert.ok(grant, "CloudWatch needs a service principal grant to use this key");
  assert.ok(JSON.stringify(grant.Condition?.ArnEquals?.["kms:EncryptionContext:aws:logs:arn"]).includes("/aws/apprunner/LnkzProduction"));
});
