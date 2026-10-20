# Barazo - Shared Engineering Standards

**Created:** 2026-02-09
**Status:** Active - enforce from first commit

Standards that apply to ALL repos (barazo-api, barazo-web, barazo-lexicons, barazo-deploy). These are non-negotiable.

---

## Testing Strategy

### Unit Tests (Vitest)
- All business logic must have unit tests
- Test files follow the repo's existing layout: next to the source (`foo.ts` -> `foo.test.ts`) or in a mirrored `tests/` tree
- Use `describe`/`it` blocks with descriptive names
- Mock external dependencies (AT Protocol SDK, database, Valkey)
- Target: **80%+ code coverage** from day one

### Integration Tests (Vitest + Supertest)
- All API endpoints must have integration tests
- Test against a real PostgreSQL instance (Docker, test container)
- Test authentication flows (OAuth, DPoP token validation)
- Test moderation authorization (role-based access)
- Test firehose record processing (valid records, malformed records, edge cases)

### Federation Tests (Custom Harness)
- Spin up test PDS instances via Docker Compose
- Test cross-instance posting and record resolution
- Test firehose subscription resilience (disconnect/reconnect, cursor replay)
- Test data portability scenarios (PDS migration)
- See: `research/06-skills-and-tooling.md` -> `federation-test-harness`

### Test-Driven Development
- Write tests BEFORE implementation code
- Use the `test-driven-development` skill for every feature
- Red -> Green -> Refactor cycle
- No PR merges with failing tests

### Test Infrastructure Patterns
- **Extract shared mock helpers early.** Route tests share significant mock boilerplate (mock DB, chainable query builders, request factories). Extract to `tests/helpers/` as soon as two test files need the same pattern. Deduplication prevents mock drift across test files.
- **Mock chain ordering matters.** Drizzle query mocks using `mockResolvedValueOnce` are consumed sequentially. When a new query is added to a route handler (e.g., a maturity check before the main query), all existing tests break because the mocks are consumed in the wrong order. When adding queries to handlers, audit all tests for that handler's mock sequence.
- **Single source of truth for types.** Derive shared types (e.g., `MaturityRating`) from the Zod schema, then re-export. Don't maintain parallel type definitions -- they will diverge when someone adds a new enum value. Pattern: define in Zod validation file, re-export via utility module.
- **Use partial mocks (`importOriginal`) for large modules.** When mocking a module that exports many functions (e.g., an API client), don't replace the entire module with only the functions your test needs. Use `vi.mock('@/lib/api/client', async (importOriginal) => ({ ...(await importOriginal()), yourMock: vi.fn() }))` to preserve all original exports and override only what you need. Full-replacement mocks silently break when other PRs add new exports that downstream components depend on.

---

## CI/CD (GitHub Actions)

### On Every Pull Request
1. **Lint** - ESLint with strict config (zero warnings allowed), including `eslint-plugin-jsx-a11y` in strict mode
2. **Type Check** - `tsc --noEmit` (strict TypeScript, no errors)
3. **Unit Tests** - Vitest with coverage report (includes vitest-axe accessibility tests)
4. **Integration Tests** - Against Docker PostgreSQL + Valkey
5. **Accessibility Tests** - @axe-core/playwright against rendered pages
6. **Build** - Verify production build succeeds
7. **Security Scan** - CodeQL for code vulnerabilities

### On Merge to Main
1. All PR checks pass
2. Docker image build and push (GitHub Container Registry)
3. Deployment to staging environment

### Scheduled (Nightly)
1. **Accessibility Audit** - pa11y-ci crawling all page types against staging
2. **Lighthouse CI** - Performance + accessibility scores (minimum a11y score: 95). Must run with mobile emulation (Lighthouse's default -- do not override to desktop).
3. **Mobile Viewport Tests** - Playwright test suite runs against staging at 375px viewport (in addition to desktop runs on PR). Covers all page types.
4. **Horizontal Overflow Check** - Dedicated Playwright test that loads every page type at 375px and asserts `document.documentElement.scrollWidth <= document.documentElement.clientWidth`. Catches the most common mobile layout bug.
5. **On nightly failure** - GitHub Actions workflow auto-creates an issue in barazo-workspace with failure details, screenshots, viewport size, and page URL. Labels: `bug`, `repo:web`, `mobile`.

### Scheduled (Weekly)
1. **Dependabot** - Automated dependency update PRs for all update types including majors. See "Dependency Management" section for full policy.
2. **Full security audit** - `pnpm audit` + CodeQL + Snyk (if added)

---

## Code Quality Standards

### TypeScript Configuration
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true
  }
}
```
- **No `any` type** - use `unknown` if the type is truly unknown, then narrow
- **No `@ts-ignore`** - fix the type error instead
- **No type assertions (`as`)** unless with a comment explaining why

### ESLint
- Extend: `@typescript-eslint/strict-type-checked`
- Zero warnings policy (warnings = errors in CI)
- No `console.log` in production code (use Pino logger)
- Enforce consistent import ordering

### Prettier
- Single config, no overrides
- Run on save and in CI
- Tab width: 2, single quotes, trailing commas

### Conventional Commits
- Enforced via commitlint + husky pre-commit hook
- Format: `type(scope): description`
- Types: feat, fix, docs, test, refactor, chore, ci
- Scope: appview, frontend, lexicon, deploy, etc.
- **Body (optional but recommended):** Explain the "why" behind the change
- **Footer:** Reference issues (`Closes #123`) or breaking changes (`BREAKING CHANGE: ...`)

**Examples:**
```
feat(appview): add firehose subscription with cursor persistence

Implements Tap-based subscription to Bluesky relay, filtering for
forum.barazo.* records. Cursor is persisted to PostgreSQL to survive
restarts and avoid duplicate processing.

Closes #42
```

```
fix(frontend): sanitize markdown output to prevent XSS

DOMPurify now runs on all user-generated markdown before rendering.
This prevents script injection via malicious markdown syntax.

Fixes #87
```

```
test(appview): add integration tests for topic creation API

Tests cover: valid creation, invalid input, auth failures,
and PDS write errors.
```

**Breaking changes:**
```
feat(api)!: change topic list endpoint response format

BREAKING CHANGE: GET /api/topics now returns paginated response
with { data: [], cursor: string } instead of flat array.

Migration guide: https://docs.barazo.forum/migration/v2
```

**Tools:**
- `commitlint` enforces format on commit
- `husky` runs commitlint as pre-commit hook
- GitHub Actions validates on PR

---

## Git Workflow & Contribution Process

### Branch Protection Rules

**Main branch (`main`) is protected:**
- No direct commits (even for solo development)
- All changes via Pull Requests
- CI checks must pass before merge
- At least 1 approval required (can self-approve when solo, but review your own PR)
- Conventional commit format enforced

**Why protect `main` even when solo?**
- Forces you to review your own changes (catch mistakes)
- CI runs on every PR (catch breaking changes before merge)
- Keeps commit history clean and linear
- Makes it easy for future contributors (process already established)
- GitHub Actions triggers work correctly (on PR vs on push to main)

### Branching Strategy

**Branch naming convention:**
```
<type>/<short-description>

Examples:
feat/firehose-subscription
fix/xss-sanitization
docs/api-reference
test/topic-crud
refactor/auth-middleware
chore/update-deps
```

**Types match conventional commits:** feat, fix, docs, test, refactor, chore, ci

**Branch lifecycle:**
```
Create branch → Make changes → Commit → Push → Open PR → Review → Merge → Delete branch
```

**Create branch from latest main:**
```bash
git checkout main
git pull origin main
git checkout -b feat/add-reactions
```

**Alternative: Use git worktrees** (recommended for larger features)
```bash
# From CLAUDE.md Git workflow section:
# Substantial work -> create git worktree

git worktree add ../barazo-api-reactions -b feat/add-reactions
cd ../barazo-api-reactions
# Work here, completely isolated from main
```

**Worktree branch reconciliation — never copy files manually:**
- Worktrees branch from `main` at a point in time. If other PRs merge while you work, your worktree's branch diverges from current `main`.
- **Before creating a PR**, rebase the worktree branch onto latest `main`: `git fetch origin main && git rebase origin/main`. This surfaces conflicts cleanly through git's merge machinery.
- **Never manually copy files** between a worktree and another branch to work around CI or merge issues. Manual copying bypasses conflict detection and silently drops changes from the target branch (e.g., new functions added by other PRs). Always use `git merge` or `git rebase` to reconcile diverged branches.
- If the worktree's branch is broken beyond repair (e.g., CI won't trigger), create a new branch from current `main` and **cherry-pick or rebase** the worktree commits onto it — don't copy files.

### Pull Request Process

**1. Create meaningful PR title and description**

Use the PR template (see below). Every PR should answer:
- **What** changed?
- **Why** did it change?
- **How** was it tested?
- **Any** breaking changes or migrations?

**2. Self-review before opening PR**

- Read your own diff on GitHub (fresh eyes catch issues)
- Run full test suite locally (`pnpm test`)
- Check CI passes (lint, typecheck, tests, security scan)
- Verify acceptance criteria met (if applicable)

**3. Keep PRs focused and small**

- One feature/fix per PR (easier to review)
- Aim for < 400 lines changed (large PRs are hard to review)
- If it's getting large, consider splitting into multiple PRs

**4. Update documentation in same PR**

- If you change API endpoints, update OpenAPI spec
- If you add features, update README or docs/
- If you change behavior, update relevant PRD or decision doc

**5. Respond to CI failures immediately**

- If CI fails, fix it before requesting review
- Don't merge with failing tests (even if "it works locally")

**6. Merge strategy**

- **Squash and merge** (default, keeps main history clean)
- Use for most PRs - collapses all commits into one
- Final commit message = PR title + description

- **Rebase and merge** (for clean commit history)
- Use when PR commits are already well-structured
- Preserves individual commits

- **Merge commit** (avoid)
- Creates noisy history, only use for coordinated releases

### PR Template

Create `.github/PULL_REQUEST_TEMPLATE.md` in each repo:

```markdown
## Description

<!-- What does this PR do? Why is it needed? -->

Closes #<!-- issue number -->

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactor (no functional changes)
- [ ] Dependency update

## Testing

<!-- How was this tested? -->

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed
- [ ] Accessibility tested (if UI changes)
- [ ] All tests pass locally

## Checklist

- [ ] Code follows conventional commit format
- [ ] Self-review completed (read own diff)
- [ ] No TypeScript errors or ESLint warnings
- [ ] Documentation updated (if applicable)
- [ ] Database migration included (if schema changed)
- [ ] Breaking changes documented (if applicable)
- [ ] CI checks pass

## Screenshots/Logs (if applicable)

<!-- Add screenshots for UI changes, or logs for backend changes -->
```

### Solo Development Best Practices

**Even when working alone:**

1. **Always use PRs** - Don't commit directly to `main`
2. **Write meaningful PR descriptions** - Future you will thank you
3. **Review your own PRs** - Catch mistakes before merging
4. **Wait for CI to pass** - Don't merge on red
5. **Delete branches after merge** - Keep repo clean

**Fast workflow for small changes:**
```bash
# Fix a typo in docs
git checkout -b docs/fix-typo
# Make change
git commit -m "docs: fix typo in installation guide"
git push -u origin docs/fix-typo
# Open PR via CLI
gh pr create --title "docs: fix typo in installation guide" --body "Fixes typo in step 3"
# Wait for CI (30 seconds)
gh pr merge --squash --delete-branch
```

**Use GitHub CLI (`gh`) for speed:**
```bash
# Install
brew install gh

# Authenticate
gh auth login

# Create PR
gh pr create

# View PR status
gh pr status

# Merge when ready
gh pr merge --squash --delete-branch
```

### Review Guidelines (Self-Review for Solo Dev)

**When reviewing your own PR, check:**

**Code quality:**
- [ ] No commented-out code
- [ ] No debug statements (`console.log`)
- [ ] No TODOs without issue numbers
- [ ] No hard-coded values (use env vars)
- [ ] No secrets or credentials
- [ ] Consistent code style (Prettier ran)

**Testing:**
- [ ] New features have tests
- [ ] Bug fixes have regression tests
- [ ] Tests are meaningful (not just coverage padding)
- [ ] Edge cases covered

**Security:**
- [ ] User input validated
- [ ] Output sanitized
- [ ] No SQL injection vectors (using ORM)
- [ ] No XSS vectors (DOMPurify for markdown)
- [ ] Auth checks on protected routes

**Accessibility (if UI changes):**
- [ ] Semantic HTML used
- [ ] Keyboard navigable
- [ ] ARIA attributes where needed
- [ ] Focus indicators visible
- [ ] vitest-axe tests pass

**Documentation:**
- [ ] API changes reflected in OpenAPI spec
- [ ] README updated if setup changed
- [ ] Comments explain "why", not "what"

### Commit Discipline

**Commit frequently, push often:**
- Small commits are easier to review and revert
- Push to your branch regularly (backup)
- Each commit should be a logical unit of work

**Amending commits (use sparingly):**
```bash
# Only amend if:
# 1. Commit not yet pushed, OR
# 2. You're the only one on the branch

git commit --amend --no-edit  # Fix without changing message
git commit --amend            # Fix and change message
```

**Squashing before merge:**
- PR will be squashed anyway (if using squash-merge)
- Don't worry about messy WIP commits during development
- Clean them up in PR description, not by force-pushing

### When to Break the Rules

**Direct commits to `main` are acceptable for:**
- Emergency hotfixes in production (fix first, PR later for review)
- README typos or trivial doc fixes (< 5 lines, no code)
- Automated commits (Dependabot, release bots)

**If you do commit directly:**
1. Create a follow-up PR documenting what you did and why
2. Tag it `hotfix` or `emergency`
3. Link to incident report or issue

### Branch Cleanup

**After PR merge:**
```bash
# GitHub can auto-delete on merge (enable in repo settings)
# Or manually:
git checkout main
git pull
git branch -d feat/add-reactions  # Delete local
git push origin --delete feat/add-reactions  # Delete remote (if not auto-deleted)
```

**Stale branches (older than 30 days, not merged):**
- Review monthly
- Close PR if no longer relevant
- Delete branch if abandoned

### Release Branches (Future - P2+)

**When supporting multiple versions:**
```
main          (active development, becomes next major)
release/v2    (v2.x maintenance, backport fixes)
release/v1    (v1.x maintenance, security only)
```

**For now (pre-1.0):** Only `main` exists. No backports, only forward.

---

## Dependency Management

### Version Policy

**Rule: latest stable, always.** This is a new project. There is no legacy to maintain. Every dependency must be on the latest stable release unless there is a documented, specific technical blocker.

- **Latest stable version** for all new dependencies. No exceptions.
- **Never more than 1 minor version behind** on any package. If a package has a new stable major, upgrade to it within one month.
- **LTS versions preferred** when a package offers an LTS track (e.g., Node.js 24 LTS).
- **Pre-release versions (alpha, beta, RC) are not used** unless the package has no stable release and is required.
- **Security patches are always applied to the latest version**, not backported to old majors.

### pnpm Catalogs (Cross-Workspace Consistency)

Dependencies shared across multiple workspace packages must be defined in the `catalog:` section of `pnpm-workspace.yaml`. Individual `package.json` files reference them with `catalog:` instead of version specifiers.

**Why:** Prevents version drift where the same dependency resolves to different majors in different packages (e.g., zod v3 in web, zod v4 in api).

**Catalog candidates** (shared across 2+ packages):

```yaml
# pnpm-workspace.yaml
catalog:
  zod: "^4.3.6"
  vitest: "^4.0.18"
  typescript: "^5.9.3"
  typescript-eslint: "^8.55.0"
  eslint: "^9.39.2"
  "@types/node": "^25.2.3"
  "@commitlint/cli": "^20.4.1"
  "@commitlint/config-conventional": "^20.4.1"
  "@vitest/coverage-v8": "^4.0.18"
  husky: "^9.1.7"
  multiformats: "^13.4.2"
```

**Usage in package.json:**
```json
{
  "dependencies": {
    "zod": "catalog:"
  },
  "devDependencies": {
    "vitest": "catalog:",
    "typescript": "catalog:"
  }
}
```

**When adding a new shared dependency:** Add it to the catalog first, then reference `catalog:` in each package.json.

### Adding New Dependencies

Before adding any dependency:

1. **Check if it already exists** in another workspace package. If so, use the same version (via catalog).
2. **Use `pnpm add <package>@latest`** to get the latest stable version. Never copy a version specifier from a tutorial, blog post, or template without verifying it is current.
3. **Verify the package is actively maintained.** Check: last publish date (< 6 months), open issues trend, Node.js version support.
4. **Prefer packages with fewer transitive dependencies.** Run `pnpm why <package>` after install to understand the dependency tree.
5. **Add to the pnpm catalog** if the dependency will be used in 2+ workspace packages.

### Dependabot Configuration

Dependabot is configured on all repos. The following rules apply:

- **All update types enabled** including major versions. Do not ignore major updates.
- **Weekly schedule** for dependency updates.
- **Group minor/patch updates** into single PRs for reduced noise.
- **Major updates get individual PRs** for easier review.
- **Security updates are always auto-created** regardless of schedule.
- **Auto-merge** minor/patch updates when CI passes (via GitHub auto-merge rules).

### Monthly Dependency Review

On the **first working day of each month**, run a dependency review:

1. Run `pnpm outdated -r` in the workspace root.
2. For each outdated package:
   - **Patch/minor behind:** Update immediately (should have been caught by Dependabot).
   - **Major behind:** Check the changelog for breaking changes, create a PR with necessary code changes.
   - **Intentionally held back:** Document the reason in this section under "Version Exceptions."
3. Run `pnpm audit` to check for known vulnerabilities.
4. Verify all Dependabot PRs are processed (merged or closed with reason).

### CI Dependency Freshness Check

A CI step runs `pnpm outdated -r --format json` and posts a warning comment on PRs when dependencies are outdated. This does not block merges but provides visibility.

### Version Exceptions

Packages intentionally held at an older version. Each entry must have a reason and a target date for resolution.

| Package | Held at | Latest | Reason | Target date |
|---|---|---|---|---|
| `eslint` | 9.x | 10.x | Ecosystem not ready (typescript-eslint, eslint-config-next) | Re-evaluate March 2026 |
| `isomorphic-dompurify` | 2.x | 3.0.0-rc.2 | No stable v3 release | Upgrade when 3.0.0 stable ships |

---

## Development Environment

### Required Tools
- Node.js 24 LTS
- Docker + Docker Compose (for PostgreSQL, Valkey, test PDS)
- pnpm (fast, disk-efficient package manager)

### Local Setup
- `docker compose up -d` for database and cache
- `pnpm install` for dependencies
- `pnpm dev` for development server with hot reload
- `pnpm test` for test suite
- `pnpm lint` for linting
- `pnpm typecheck` for TypeScript verification

### Environment Variables
- `.env.example` committed (with placeholder values)
- `.env` in `.gitignore` (never committed)
- Zod schema validation for all env vars at startup (fail fast on missing config)
- No secrets in code or config files

---

## Code Review Checklist

Every PR must be reviewed against:

- [ ] Tests written (unit + integration where applicable)
- [ ] Tests pass locally and in CI
- [ ] No TypeScript errors or ESLint warnings
- [ ] Input validation on all new endpoints/handlers
- [ ] Output sanitization for user-generated content
- [ ] No raw SQL (use ORM)
- [ ] No `any` types
- [ ] No `console.log` (use logger)
- [ ] No secrets or credentials
- [ ] Conventional commit message
- [ ] Database migration included (if schema changed)
- [ ] API documentation updated (if endpoints changed)
- [ ] Accessibility: semantic HTML, keyboard navigable, ARIA attributes where needed
- [ ] Accessibility: vitest-axe tests for new components
- [ ] SEO: JSON-LD structured data on new page types
- [ ] SEO: meta tags (title, description, canonical, OpenGraph) on new pages
- [ ] Dependencies: new packages added at latest stable version
- [ ] Dependencies: shared packages use `catalog:` from pnpm-workspace.yaml

---

## Language Standards

### Gender-Neutral Writing

All documentation, code examples, mock data, test fixtures, and user-facing text must use gender-neutral language.

- **Example account:** `jay.bsky.team` (not alice.bsky.social). Jay is the Bluesky CEO's handle -- a fun insider reference that's also gender-neutral.
- **Pronouns in docs:** Use "they/them/their" when referring to a hypothetical user. Never "he/she" or gendered pronouns.
- **Example names in mock data and tests:** Use gender-neutral names. Preferred set: Jay, Alex, Sam, Robin, Morgan. Avoid gendered placeholder names (Alice, Bob, Carol, etc.).
- **Variable names:** Match the example name (e.g., `didJay`, not `didAlice`).
- **Inclusive phrasing:** "the user configures their profile" not "the user configures his or her profile".

---

## Documentation Strategy

### Principle: docs that can't go stale

Documentation is generated from code wherever possible. Manual docs are flagged for staleness in CI.

### Auto-generated (zero maintenance)
- **API docs:** @fastify/swagger generates OpenAPI 3.0 spec from Fastify routes + Zod schemas. Served interactively via @scalar/fastify-api-reference at `/docs`.
- **TypeScript types:** Generated from lexicon JSON schemas via @atproto/lex-cli.
- **Database schema:** Drizzle ORM schema files ARE the documentation.
- **Lexicon format:** JSON schema files in barazo-lexicons repo.

### Staleness detection (GitHub Action)
- CI checks if code changes in `src/routes/` without corresponding docs changes.
- Flags PR with a warning: "API code changed but docs not updated."
- No LLM, no cost - just pattern matching.

### npm Package Links
- When referencing Barazo npm packages in docs, READMEs, or guides, link to `npmx.dev` instead of `npmjs.com`.
- Example: `https://npmx.dev/package/@barazo/plugin-signatures`
- Does not apply to CI configs, install commands, or registry API calls.

### Manual docs (in repo, reviewed in PRs)
- Architecture docs, guides, and README live in `docs/` directory.
- Updated in the same PR as the code they describe.
- ADRs (below) for significant technical decisions.

### Future: LLM-assisted updates (P2+)
- GitHub Action sends diffs to LLM on PR merge.
- Opens draft PR with suggested doc updates.
- Human reviews and merges.
- Can use local Ollama or cheap API call.

---

## Architecture Decision Records (ADRs)

Significant technical decisions should be documented as ADRs in `docs/adr/`:

```
docs/adr/
  001-fastify-over-express.md
  002-drizzle-orm-selection.md
  003-reaction-system-design.md
  ...
```

Format:
- **Status:** Proposed / Accepted / Deprecated / Superseded
- **Context:** What is the issue?
- **Decision:** What did we decide?
- **Consequences:** What are the trade-offs?

---

## Versioning & Release Strategy

### Semantic Versioning

All repos follow **strict semver** (MAJOR.MINOR.PATCH):

- **MAJOR** - Breaking changes (e.g., lexicon field removals, API endpoint changes, database migrations requiring manual intervention)
- **MINOR** - New features, backward-compatible (e.g., new endpoints, new optional lexicon fields)
- **PATCH** - Bug fixes, no new features

**Starting version:** All repos start at `0.1.0` (pre-1.0 signals "not production-ready yet")

### Version Alignment Strategy

**Question:** Should all 4 repos share the same version number?

**Decision:** **Hybrid approach - coordinated majors, independent minors/patches**

| Repo | Versioning Strategy | Example |
|------|---------------------|---------|
| **barazo-lexicons** | Independent semver (lexicon changes don't align with app releases) | `1.2.0` |
| **barazo-api** | Coordinated majors with barazo-web, independent minors/patches | `2.5.3` |
| **barazo-web** | Coordinated majors with barazo-api, independent minors/patches | `2.4.1` |
| **barazo-deploy** | Coordinated majors with API+Web, independent minors/patches | `2.1.0` |

**Rationale:**

1. **Lexicons are independent** - Schema changes happen on their own timeline. A new optional field (`MINOR` bump) doesn't require app releases. Apps declare which lexicon versions they support.

2. **API and Web share majors** - Breaking API changes (v1 → v2) usually require frontend changes. Coordinating major versions signals compatibility.

3. **Independent minors/patches** - API can release bug fixes (2.5.3) without forcing a frontend release. Frontend can add UI features (2.4.1) without requiring API changes.

4. **Deploy follows API+Web** - Major infra changes (Docker Compose v2) align with app majors, but minor tweaks (new env vars, docs) don't.

### Version Compatibility Matrix

Maintained in root README of each repo:

**barazo-api `2.5.3` compatibility:**
- Requires: `barazo-lexicons` `^1.0.0` (any 1.x version)
- Compatible with: `barazo-web` `^2.0.0` (any 2.x version)
- Requires: `barazo-deploy` `^2.0.0`

**barazo-web `2.4.1` compatibility:**
- Requires: `barazo-api` `^2.0.0` (any 2.x version)

**barazo-deploy `2.1.0` supports:**
- `barazo-api` `^2.0.0`
- `barazo-web` `^2.0.0`

### GitHub Releases

**When to create a release:**
- Every merge to `main` (automated via GitHub Actions)
- Tag format: `v{MAJOR}.{MINOR}.{PATCH}` (e.g., `v0.1.0`, `v1.2.3`)

**What's in a release:**
- **Release notes** (auto-generated from conventional commits)
- **Docker images** (pushed to GitHub Container Registry)
- **npm package** (for barazo-lexicons only)
- **Source code** (automatic GitHub archive)

**Release automation (GitHub Actions):**

```yaml
# .github/workflows/release.yml
on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    - Extract version from tag
    - Build Docker image (API/Web only)
    - Push to ghcr.io/barazo-forum/{repo}:latest
    - Push to ghcr.io/barazo-forum/{repo}:{version}
    - Generate changelog from commits since last tag
    - Create GitHub Release with changelog
    - (Lexicons only) Publish to GitHub Packages npm registry
```

### GitHub Packages

**What gets published as packages:**

| Repo | Package Type | Registry | Package Name |
|------|-------------|----------|--------------|
| barazo-lexicons | npm | GitHub Packages | `@singi-labs/barazo-lexicons` |
| barazo-api | Docker | GitHub Container Registry | `ghcr.io/barazo-forum/barazo-api` |
| barazo-web | Docker | GitHub Container Registry | `ghcr.io/barazo-forum/barazo-web` |
| barazo-deploy | None | N/A | Git clone only |

**Why GitHub Packages (not npmjs.com)?**
- Free for public repos
- Integrated with GitHub permissions
- Same auth as Docker registry
- Can switch to npmjs.com later if desired (namespace already reserved: `@barazo`)

**npm package setup (barazo-lexicons only):**

```json
// package.json
{
  "name": "@singi-labs/barazo-lexicons",
  "version": "1.2.0",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

**Installing from GitHub Packages:**

```bash
# One-time setup: configure npm to use GitHub Packages for @barazo-forum scope
echo "@barazo-forum:registry=https://npm.pkg.github.com" >> .npmrc

# Install (works in barazo-api and barazo-web)
pnpm add @singi-labs/barazo-lexicons
```

### Docker Image Tagging Strategy

**Tags pushed on each release:**

```bash
# Example: releasing barazo-api v2.5.3
ghcr.io/barazo-forum/barazo-api:latest        # Always points to most recent release
ghcr.io/barazo-forum/barazo-api:2             # Latest 2.x version
ghcr.io/barazo-forum/barazo-api:2.5           # Latest 2.5.x version
ghcr.io/barazo-forum/barazo-api:2.5.3         # Exact version (immutable)
```

**Staging always uses `latest`:**
```yaml
# docker-compose.staging.yml
services:
  barazo-api:
    image: ghcr.io/barazo-forum/barazo-api:latest
```

**Production uses pinned versions:**
```yaml
# docker-compose.yml (user deploys)
services:
  barazo-api:
    image: ghcr.io/barazo-forum/barazo-api:2.5.3
```

**Why pin in production?**
- Prevents surprise breakage from `latest` updates
- Users explicitly upgrade via `docker compose pull` + tag change
- Rollback is trivial (change tag back)

### Coordinated Major Release Process

**When releasing a breaking change (e.g., v1 → v2):**

1. **Plan the release** - What's breaking? Which repos need updates?
2. **Version bumps** - Coordinate `package.json` version bumps in same PR or same day
3. **Tag all repos** - Tag on the same day:
   ```bash
   # barazo-api
   git tag v2.0.0 && git push origin v2.0.0
   
   # barazo-web
   git tag v2.0.0 && git push origin v2.0.0
   
   # barazo-deploy
   git tag v2.0.0 && git push origin v2.0.0
   
   # barazo-lexicons (if breaking schema change)
   git tag v2.0.0 && git push origin v2.0.0
   ```
4. **Release notes** - Coordinated release announcement (blog post, Bluesky)
5. **Migration guide** - Document upgrade path (database migrations, config changes)

**GitHub Releases convention for coordinated majors:**
- Title: `v2.0.0 - Barazo Major Release` (all repos use same title)
- Body includes: breaking changes, migration guide, compatibility matrix

### Pre-1.0 Versioning (MVP P1)

**During P1 (pre-production):**
- Versions: `0.1.0`, `0.2.0`, `0.3.0`, etc.
- Breaking changes = `MINOR` bump (not `MAJOR`)
- This is standard semver behavior for 0.x versions

**When to go 1.0.0:**
- P2 launch (self-hosting release)
- Signals: "production-ready, stable API, semver guarantees enforced"

**Pre-1.0 example timeline:**
```
v0.1.0  - Initial proof-of-concept (firehose works)
v0.2.0  - MVP features complete (topics, replies, reactions)
v0.3.0  - Staging deployed, OAuth working
v0.5.0  - All P1 milestones complete
v1.0.0  - P2 launch (self-hosting documentation, stable API)
```

### Changelog Generation

**Automated via conventional commits:**

GitHub Actions uses commit messages to generate changelogs:

```bash
# Extracts commits since last tag
git log v0.4.0..HEAD --format="%s"

# Groups by type
feat(appview): add firehose subscription
fix(frontend): sanitize markdown output
docs(api): update OAuth setup guide
```

**Rendered in GitHub Release:**
```markdown
## Features
- **appview**: add firehose subscription (#42)

## Bug Fixes
- **frontend**: sanitize markdown output (#43)

## Documentation
- **api**: update OAuth setup guide (#44)
```

**Tool:** `conventional-changelog` or GitHub's auto-generated release notes

### Version Bumping Workflow

**Manual bump (for now):**
```bash
# Update package.json version
pnpm version minor  # or major, or patch

# Creates commit + tag automatically
# Push to trigger release
git push && git push --tags
```

**Future automation (P2+):**
- Use `semantic-release` to auto-bump based on conventional commits
- PR merged with `feat:` → auto-bump minor, tag, release
- PR merged with `BREAKING CHANGE:` → auto-bump major

### Rollback Strategy

**If a release breaks production:**

1. **Immediate fix** - Revert to previous Docker tag:
   ```bash
   # In docker-compose.yml
   image: ghcr.io/barazo-forum/barazo-api:2.5.2  # Was 2.5.3
   docker compose up -d
   ```

2. **Fix forward** - Patch the bug, release `2.5.4`

3. **GitHub Release** - Mark broken release as "Pre-release" or add warning

**Database migration rollback:**
- Drizzle migrations are forward-only (no automatic rollback)
- Critical: test migrations on staging first
- Emergency: restore from backup, re-run migrations up to working version

### Version Communication

**Where versions are visible:**

| Location | Purpose |
|----------|---------|
| GitHub Releases | Changelog, download links |
| Docker tags | Deployment |
| API response | `GET /api/health` returns `{ version: "2.5.3" }` |
| Frontend footer | "Powered by Barazo v2.5.3" |
| npm package | `@singi-labs/barazo-lexicons@1.2.0` |

**Health endpoint includes versions:**
```json
GET /api/health
{
  "status": "healthy",
  "version": "2.5.3",
  "lexicons": "^1.0.0",
  "uptime": 86400
}
```

### Future: Monorepo Consideration

**Not now, but possible later:**

If cross-repo coordination becomes painful:
- Move all 4 repos into a monorepo (pnpm workspaces or Turborepo)
- Single version number for all packages
- Easier to coordinate breaking changes
- Shared tooling (ESLint, TypeScript config, CI)

**Defer until:** We have real pain from multi-repo coordination (probably not until P3+)

---

## References

- AT Protocol Security: https://atproto.com/guides/security
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Drizzle ORM: https://orm.drizzle.team/
- Valkey: https://valkey.io/
