# Release operations

## Release boundary

`ci.yml` checks pushes to `main`, pull requests and manual runs. It installs the frozen pnpm toolchain, runs the package gate (including a clean temporary npm consumer), and uploads the tarball plus `pack.json` as `npm-package-<commit SHA>` for 14 days. The default branch and GitHub-hosted runner are authoritative; local checkouts need no npm publishing credentials.

`publish.yml` runs on pushes to `main`. It reads `package.json` and checks the public registry: existing versions skip release; an unpublished version calls that same verification workflow, downloads its own run's artifact, verifies name/version/SHA-512, dry-runs and publishes with provenance. Registry/network or malformed-response errors fail closed. Ordinary commits still run CI but release nothing unless the manifest version is unpublished. Versions are not bumped automatically; pushing/merging a version bump authorizes its release.

Manual dispatch on `main` remains available with an exact `version` and `publish=false` by default. Only `publish=true` publishes in manual mode. A manual run for an existing version verifies/builds source and validates the artifact, but skips npm's dry-run because npm rejects even dry-run republishing. Explicit manual publication of an existing version is rejected by the guard. Wrong versions and non-main refs fail before publication. Publication attempts are serialized without cancellation; tags and PRs do not publish.

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

1. Change `package.json` to the next unused version and update release-facing documentation. Run checks and review before pushing/merging to `main`: that push automatically releases an unpublished version after verification.
2. Watch the Publish workflow. If checks fail, fix the source and push again with the same unpublished version; no additional version bump is needed.
3. Check the run, the public npm version, integrity and provenance. Verify installation from the registry in a fresh consumer. Manual dry-runs remain available but cannot pause or replace automatic publication of a version bump on `main`.

If publishing reports that the version already exists, inspect the registry before retrying; do not blindly bump or rerun. Never remove or overwrite a published version to repair a workflow. If verification fails, fix the source/workflow and obtain a new successful verification run before publishing.
