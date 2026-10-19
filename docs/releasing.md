# Release operations

## Release boundary

`ci.yml` checks pushes to `main`, pull requests and manual runs. It installs the frozen pnpm toolchain, runs the package gate (including a clean temporary npm consumer), and uploads the tarball plus `pack.json` as `npm-package-<commit SHA>` for 14 days. The default branch and GitHub-hosted runner are authoritative; local checkouts need no npm publishing credentials.

`publish.yml` is manually dispatched **on `main`** with an exact `version` input. It calls that same verification workflow, downloads the artifact from its own run, checks its name/version/SHA-512 integrity, and dry-runs npm publication. It only publishes when the boolean `publish` input is explicitly true. Wrong versions and non-main refs fail before publication. No push, tag or pull request automatically publishes anything. Publication attempts are serialized without cancellation.

Actions are pinned to immutable commits. The verification job has only read access; `id-token: write` is limited to the release job. Checkout does not retain Git credentials. The release job installs no package dependencies and runs no package lifecycle scripts. No `NPM_TOKEN`, `NODE_AUTH_TOKEN`, GitHub environment or repository secret is required. The repository URL in `package.json` must continue to identify this public repository for npm provenance.

A successful dry-run proves workflow execution and artifact preparation, **not** npm ownership, publishing authorization, trusted-publisher configuration or provenance issuance. Those are proven only by an actual authorized publication. The workflow currently publishes the version as `latest`; it does not create Git tags or GitHub Releases.

## One-time npm bootstrap (owner-operated)

The scoped package must exist before its npm package settings can be configured. The first publication uses the owner's interactive npm authentication; subsequent versions use trusted publishing.

1. Wait for a successful CI or Publish dry-run on the exact source commit you intend to release.
2. Download that run's `npm-package-<commit SHA>` artifact, rather than publishing an unchecked working tree. For example:

   ```sh
   RELEASE_DIR="$(mktemp -d)"
   gh run download RUN_ID --repo ZDreamer2/forge-ts-service \
     --name npm-package-COMMIT_SHA --dir "$RELEASE_DIR"
   ```

   Substitute the actual successful run ID and full commit SHA. Inspect `pack.json` for `@zdreamer/forge-ts-service`, version `0.1.0`, and the expected file allowlist. Keep the downloaded files unchanged.

3. In your own terminal, using Node 24 and npm 11.19.0:

   ```sh
   npm login --registry=https://registry.npmjs.org/
   npm whoami --registry=https://registry.npmjs.org/
   npm publish "$RELEASE_DIR"/zdreamer-forge-ts-service-0.1.0.tgz \
     --ignore-scripts --access public --registry=https://registry.npmjs.org/
   ```

   Confirm the identity is `zdreamer` before publishing, and approve npm's browser/2FA prompts yourself. Do not place passwords, tokens, OTPs or recovery codes in repository files, GitHub secrets, logs or chat. This bootstrap publication does not have CI-generated OIDC provenance. If `0.1.0` already exists, stop: npm versions are immutable and cannot be overwritten.

4. Once the bootstrap succeeds, run `npm logout --registry=https://registry.npmjs.org/` to remove local publishing access. The agent does not need a persistent local npm token.

These commands are owner instructions, not steps CI or an agent should execute without explicit publication approval.

## Configure the npm trusted publisher

Prepare the next version (normally `0.1.1`) and its successful dry-run **before** creating the publisher configuration: a new configuration must complete a successful publish within two days or be deleted and recreated. `0.1.0` cannot be republished to validate OIDC after bootstrap.

On npmjs.com, open `@zdreamer/forge-ts-service` → Settings → Trusted Publisher → GitHub Actions, then enter:

| Field | Value |
| --- | --- |
| Organization or user | `ZDreamer2` |
| Repository | `forge-ts-service` |
| Workflow filename | `publish.yml` |
| Environment | Leave empty; this workflow does not use one |

Use the workflow filename only, not `.github/workflows/publish.yml`. Save the configuration. Do not create a publishing token. GitHub Actions uses GitHub-hosted `ubuntu-24.04` runners and npm's OIDC exchange; self-hosted runners are not supported by this setup.

Reference: <https://docs.npmjs.com/trusted-publishers/>. npm does not validate this configuration on save; actual publication must establish that it works. After a successful OIDC publication, review npm's package publishing settings and restrict token-based publication as recommended there.

## Subsequent releases

1. Change `package.json` to the next unused version and update release-facing documentation as appropriate. Run checks and push/merge the reviewed changes to `main`.
2. In GitHub Actions, select **Publish → Run workflow**, select `main`, enter that exact version and leave **Publish to npm** unchecked. Wait for all jobs to pass.
3. Obtain publication approval, then run Publish again with the same version and the publish checkbox enabled. Only enable it once the npm trusted publisher is configured.
4. Check the run, the new public npm version, its integrity and provenance. Verify installation from the registry in a fresh consumer. A successful dry-run alone does not finish a release.

If publishing reports that the version already exists, inspect the registry before retrying; do not blindly bump or rerun. Never remove or overwrite a published version to repair a workflow. If verification fails, fix the source/workflow and obtain a new successful verification run before publishing.
