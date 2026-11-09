# Optional AWS infrastructure

This is LLMM's existing CDK stack, now maintained with Magnet. It defines an ECR
repository, private Postgres, App Runner, encrypted storage, and supporting
network/IAM resources. It is separate from the default SQLite/Fly deployment.

Run `pnpm infra:synth` from the repository root to synthesize the template.
Run `pnpm infra:verify` to check that service creation is opt-in, runtime
authentication/TLS remain enabled, storage stays private, and the runtime role
cannot read migration credentials. These are template assertions, not AWS tests.
`pnpm --filter @magnet/infra diff` compares it with an AWS deployment and requires
credentials. Neither the repository consolidation nor synthesis deploys resources.

Keep `LnkzProduction` and its construct IDs when updating an existing stack.
Review a diff before applying it. Creating the stack can incur AWS charges.

Before enabling App Runner:

1. Build and push the root Docker image to the stack's ECR repository.
2. Create the application database role from its dedicated secret. Give it
   runtime grants without table ownership, superuser, or BYPASSRLS privileges.
3. Run the Postgres migrations with the migration role as documented in
   [DEPLOY.md](../DEPLOY.md#postgres-release-and-tests).
4. Supply public URL, host and origin allowlists, and the image tag. Validate
   the provider's health-probe Host header against the allowlist before rollout.
5. Enable the service and run the authenticated smoke command against its URL.

The S3 export bucket is infrastructure provisioned by the inherited template;
the relay does not currently use it as a conversation store. Live AWS rollout,
network reachability and recovery must be validated in the target account.

## Release checklist

1. Run `corepack pnpm build:release`, `corepack pnpm verify:release`,
   `corepack pnpm infra:synth` and `corepack pnpm infra:verify` locally.
2. Build `docker build -t magnet:local .` and run
   `corepack pnpm verify:container magnet:local`. The image includes `/mobile/`
   and the AWS RDS CA trust bundle; TLS verification stays enabled.
3. Choose the AWS account/region and review `cdk diff`. The template creates
   billable RDS, NAT, KMS and other resources even with `EnableAppRunner=false`.
   Bootstrap CDK in that account only as an explicit deployment action.
4. Provision the stack with `EnableAppRunner=false`. Use its `RepositoryUri`
   output to authenticate Docker to ECR and push an immutable release tag
   based on the verified source commit. Do not reuse `latest` for a rollout.
5. From an authorized execution environment with private database reachability,
   create the non-owner runtime role using `ApplicationDatabaseSecretArn`, then
   migrate using `MigrationSecretArn` and `MAGNET_DATABASE_APP_ROLE=lnkz_app`.
   No bootstrap runner is provisioned by this template; this is a required
   operator step, not something template synthesis has verified.
6. Enable App Runner with `ImageTag`, `PublicBaseUrl`, `AllowedHosts` and
   `AllowedOrigins` set for the selected endpoint. Verify the health-probe Host
   header in that account before rollout; never disable host validation to make
   it pass. Configure and verify a custom domain separately if using one.
7. Use `ServiceArn` and `ServiceUrl` outputs to inspect the rollout, then run the
   authenticated smoke test, open `/mobile/`, and verify a two-device handoff.
   Retain the prior image tag and verify backups before changing schema.

Synthesis writes `cdk.out/`; CI uploads that assembly separately from the Node
archive. It contains infrastructure definitions, not deployed endpoints or
generated secret values. ECR publishing, live deployment, database bootstrap,
domain setup and hosted recovery remain account-specific release steps.
