# Releasing foxhole

## How releases work

Releases use [Changesets](https://github.com/changesets/changesets). The release workflow in `.github/workflows/release.yml` runs on every push to `main`:

- If changesets are present: creates or updates a "Version Packages" pull request that bumps the version, updates `CHANGELOG.md`, and regenerates `package-lock.json`.
- If no changesets are present (i.e., the version PR was merged): publishes the package to npm using OIDC trusted publishing.

The version step runs the `version` script (`changeset version && npm install --package-lock-only`) rather than `changeset version` alone. The lockfile regeneration is the reason: `changeset version` rewrites `package.json` but not `package-lock.json`, which otherwise leaves the lockfile a version behind every release.

---

## One-time bootstrap (before the first publish)

This is required once to establish the package on npm and configure trusted publishing.

**Step 1 - Create the package on npm manually:**

```bash
# On your local machine, logged in to npm as ku5ic:
npm login
npm publish --access public --dry-run   # verify the tarball looks right
npm publish --access public             # first publish, creates the package on npmjs.com
```

The package is published as `@ku5ic/foxhole`. Verify it is not yet published: `npm view @ku5ic/foxhole`.

**Step 2 - Configure trusted publishing on npmjs.com:**

1. Go to https://www.npmjs.com/package/@ku5ic/foxhole -> Settings -> Publishing access.
2. Under "Trusted publishers", add a new publisher:
   - Provider: GitHub Actions
   - Owner: `ku5ic`
   - Repository: `foxhole`
   - Workflow: `release.yml`
   - Environment: (leave blank, or set to `release` if you add one)
3. Save.

After this, pushing a version bump to `main` will trigger the workflow and publish without a token.

---

## Steady-state flow (every release after the first)

1. **Work on a branch.** When a feature or fix is ready to ship, add a changeset:

   ```bash
   npx changeset
   ```

   Follow the prompts. Choose `patch`, `minor`, or `major` based on the change. Commit the generated file in `.changeset/`.

2. **Open a PR.** The changeset travels with the code change in the same PR, or in a separate PR.

3. **Merge to main.** The release workflow runs and either:
   - Creates/updates the "Version Packages" PR (if changesets are present), or
   - Publishes to npm (if the "Version Packages" PR was just merged).

4. **Review and merge the "Version Packages" PR.** This bumps `package.json` version, updates `CHANGELOG.md`, and triggers the publish on the next workflow run.

---

## Dry run before publishing

To verify the tarball without publishing:

```bash
npm run build
npm pack
npm publish --dry-run
```

`npm pack` produces a `.tgz` file. Inspect it with:

```bash
tar -tf ku5ic-foxhole-*.tgz
```

The tarball must contain only `dist/`, `bin/`, `README.md`, `LICENSE`, `CHANGELOG.md`, and `package.json`. Delete the `.tgz` after inspection.

---

## Version bump

The version bump in `package.json` is handled by the "Version Packages" PR. Do not bump the version manually. The `1.0.0` initial bump (from `0.1.0`) is an exception: it is gated on all Phase 6 checks passing and is performed as the final pre-publish step, documented in the plan.

Specifically, do not run `npm version`. The `version` script shares its name with npm's `version` lifecycle hook, so `npm version <x>` would fire `changeset version` mid-bump and version the package twice.

---

## Troubleshooting

**Publish step fails with 401 or 403:** The trusted publisher on npmjs.com is not configured, or the workflow file name does not match what is registered. Re-check Step 2 above.

**"Version Packages" PR is not created:** The workflow did not find any changesets. Run `npx changeset status` to verify.

**`npm publish --dry-run` shows unexpected files:** Check `package.json` `files` array. Only `dist` and `bin` are included; npm auto-includes `README.md`, `LICENSE`, `CHANGELOG.md`, and `package.json`.
