# Quality, Security & Reliability Measures

**Applies to:** All Singi Labs products (Barazo, Sifa)
**Purpose:** Comprehensive overview of every measure in place to keep code quality, security, and reliability high. Useful as reference for blog posts, investor conversations, and onboarding.

---

## 1. Code Quality

### Strict TypeScript
- `strict: true` with additional flags: `noUncheckedIndexedAccess`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, `exactOptionalPropertyTypes`
- No `any` type (use `unknown` + narrowing)
- No `@ts-ignore` or `@ts-expect-error`
- No type assertions (`as`) without a comment explaining why

### Linting
- ESLint with `@typescript-eslint/strict-type-checked`
- Zero warnings policy (warnings = errors in CI)
- `eslint-plugin-jsx-a11y` in strict mode for accessibility
- `eslint-plugin-tailwindcss` for CSS class ordering
- No `console.log` in production code (enforced by lint rule)

### Formatting
- Prettier with single config, no overrides
- Run on save and enforced in CI
- Consistent across all repos (tab width: 2, single quotes, trailing commas)

### Code Style
- Named exports over default exports
- Small components (max ~150 lines, then split)
- No inline styles (all styling via Tailwind utility classes)
- Server Components by default; `"use client"` requires justification comment
- AT Protocol interactions through dedicated service layer (never direct from components)
- Error boundaries on all network-dependent UI

---

## 2. Testing

### Test-Driven Development (TDD)
- Write tests BEFORE implementation code (Red -> Green -> Refactor)
- Enforced via dedicated `test-driven-development` skill
- No PR merges with failing tests

### Unit Tests (Vitest)
- All business logic has unit tests
- Test files co-located with source (`foo.ts` -> `foo.test.ts`)
- Target: 80%+ code coverage
- Mock external dependencies (AT Protocol SDK, database, Valkey)

### Integration Tests (Vitest + Supertest)
- All API endpoints have integration tests
- Test against real PostgreSQL + Valkey (Docker)
- Test authentication flows (OAuth, DPoP)
- Test firehose record processing (valid, malformed, edge cases)

### Accessibility Tests (3 tiers)
- **Tier 1 (every PR):** `eslint-plugin-jsx-a11y` strict + `vitest-axe` component tests + `@axe-core/playwright` page tests
- **Tier 2 (nightly):** `pa11y-ci` crawling all page types + Lighthouse CI (min a11y score: 95)
- **Tier 3 (before release):** Manual VoiceOver + Safari testing, keyboard-only walkthrough

### Mobile Tests (nightly)
- Playwright test suite at 375px viewport against staging
- Horizontal overflow check on every page type
- Auto-creates GitHub issue on failure with screenshots

### Federation Tests
- Test PDS instances via Docker Compose
- Cross-instance posting and record resolution
- Firehose subscription resilience (disconnect/reconnect, cursor replay)

---

## 3. Security

### Input Validation
- Every API endpoint validates input with Zod schemas
- Every firehose record validated against lexicon schema before indexing
- Environment variables validated with Zod at startup (fail fast)
- Unicode NFC normalization on all text input; strip bidirectional override characters

### Output Sanitization
- DOMPurify on all user-generated HTML/markdown (restrictive ALLOWED_TAGS/ALLOWED_ATTR)
- Sanitization order: markdown -> HTML conversion first, then DOMPurify
- Server-side only (jsdom, NOT happy-dom — known XSS vectors)
- AT Protocol display names and profile data sanitized before display

### HTTP Security Headers (Helmet)
- Content-Security-Policy (strict, no inline scripts)
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Strict-Transport-Security (HSTS)
- Referrer-Policy: strict-origin-when-cross-origin

### Rate Limiting
- Per-IP rate limiting on all API endpoints
- Per-DID rate limiting for authenticated requests (harder to bypass than IP)
- Stricter limits on write endpoints, auth endpoints, and search
- New account rate limiting (< 7 days activity = stricter write limits)
- Per-post mention limit (max 10 unique @mentions)
- Exponential backoff on repeated violations

### Authentication & Authorization
- AT Protocol OAuth with DPoP token binding
- PKCE required on all OAuth flows (S256)
- Cryptographically random state parameter (min 32 bytes, 5-minute expiry)
- Refresh token: HTTP-only, Secure, SameSite=Strict cookie
- Access token: short-lived (15 minutes), memory-only (never localStorage)
- DID ownership verified on every authenticated request
- Role-based authorization for moderation actions

### Database Security
- No raw SQL — Drizzle ORM with parameterized queries only
- Database role separation: `migrator` (DDL), `app` (DML), `readonly` (SELECT)
- `statement_timeout` on app role (30s general, 5s for search queries)
- `idle_in_transaction_session_timeout`: 60 seconds
- Audit log table: append-only (no UPDATE/DELETE for app role)
- Multi-tenant query safety: every query includes `communityDid` in WHERE clause

### Encryption
- AES-256-GCM for sensitive data at rest (BYOK API keys, OAuth refresh tokens)
- HKDF key derivation with per-community salt
- Master key in environment variable, never in database
- Documented key rotation procedures (zero-downtime)

### Valkey (Cache) Security
- Authentication required (`requirepass`)
- Dangerous commands disabled (`FLUSHALL`, `FLUSHDB`, `CONFIG`, `DEBUG`, `KEYS`)
- Memory policy: `volatile-lru` (evict only keys with TTL)
- Never cache raw Bearer tokens (hash or reference only)
- TLS required for managed hosting

### CORS
- Explicitly configured allowed origins (no wildcard `*` in production)
- Credentials mode properly configured for OAuth flow

### Dependency Security
- Dependabot enabled with weekly schedule on all repos
- `pnpm audit` in CI pipeline (fail on high/critical)
- Lock file committed and integrity-checked
- Monthly manual dependency review (`pnpm outdated -r`)

### Secret Management
- `.env` in `.gitignore` (never committed), `.env.example` committed
- Documented rotation procedures for every secret type
- Zero-downtime rotation: accept old + new credentials during rotation window
- Monitor logs for credential exposure patterns

---

## 4. Git Workflow & Branch Protection

### Branch Protection (GitHub)
- Main branch protected: no direct commits
- All changes via Pull Requests
- CI checks must pass before merge
- Conventional commit format enforced

### Branch Protection (Local)
- Pre-commit hook blocks commits on `main` in all repos
- Enforced via husky (committed, shared) or `.git/hooks/` (local)

### Conventional Commits
- Format: `type(scope): description`
- Enforced via commitlint + husky commit-msg hook
- Validated in CI via GitHub Actions

### Pre-push Validation
- Pre-push hook runs `lint && typecheck && build` before allowing push (sifa-sdk: build only). The full test suite runs in CI, where it is a required check.
- Catches CI failures locally before they reach GitHub Actions

### Worktree Isolation (Multi-Session Safety)
- Every feature branch gets its own git worktree
- Never reuse an existing worktree from another session
- Check for uncommitted changes before creating a worktree
- One branch = one feature (no mixed changes)

### PR Process
- Self-review before opening (read own diff on GitHub)
- Keep PRs focused and small (< 400 lines, one feature/fix per PR)
- Wait for CI to pass before requesting review
- Squash and merge (default)
- Delete branch after merge

---

## 5. CI/CD (GitHub Actions)

### On Every Pull Request
1. Lint (ESLint strict, zero warnings)
2. Type check (`tsc --noEmit`, strict mode)
3. Unit tests (Vitest with coverage report)
4. Integration tests (against Docker PostgreSQL + Valkey)
5. Accessibility tests (`@axe-core/playwright`)
6. Build verification (production build succeeds)
7. Security scan (CodeQL)

### On Merge to Main
1. All PR checks pass
2. Docker image build and push (GitHub Container Registry)
3. Deployment to staging

### Nightly
1. Accessibility audit (`pa11y-ci` crawling all page types)
2. Lighthouse CI (performance + accessibility, min a11y: 95)
3. Mobile viewport tests (375px Playwright suite)
4. Horizontal overflow check (all page types at 375px)
5. Auto-creates GitHub issue on failure

### Weekly
1. Dependabot automated dependency update PRs
2. Full security audit (`pnpm audit` + CodeQL)

---

## 6. Monitoring & Observability

### Error Monitoring (GlitchTip)
- Self-hosted (Sentry SDK-compatible, all data on own infrastructure)
- Captures unhandled exceptions and rejections
- Performance monitoring for API endpoint latency
- Source maps uploaded during build
- Environment separation (dev, staging, production)
- Alerts on new error types

### Structured Logging (Pino)
- JSON structured logs in production
- Request ID correlation across log entries
- No sensitive data in logs (no tokens, no PII)
- Log levels: error, warn, info, debug

### Health Checks
- `/health`: basic liveness (server running)
- `/health/ready`: readiness (database, Valkey, firehose connected)
- Used by Docker HEALTHCHECK and load balancer
- Returns version info for deployment verification

### Alerting
- Error rate spike (> 5% of requests)
- API latency spike (p95 > 2s)
- Firehose subscription disconnect
- Database connection failures
- Disk/memory threshold warnings

---

## 7. Accessibility (WCAG 2.2 AA)

- Semantic HTML with proper landmarks on every page
- Heading hierarchy enforced
- Keyboard navigation on all interactive elements
- Visible focus indicators (Tailwind `focus-visible:ring-*`)
- Skip links ("Skip to main content")
- Minimum target size: 24x24 CSS px (AA), prefer 44x44 (AAA)
- `aria-live` regions for dynamic content
- Pagination by default (infinite scroll opt-in only)
- Dark/light mode with `prefers-color-scheme` respect
- Contrast ratios: 4.5:1 normal text, 3:1 large text
- `prefers-reduced-motion` respected
- Accessibility statement published at launch

---

## 8. SEO

- JSON-LD structured data (Schema.org types per page)
- OpenGraph + Twitter Card meta tags
- Dynamic sitemaps via Next.js
- Canonical URLs on all pages
- `robots.txt` with AI crawler blocking
- Server-side rendering for all public content
- Content maturity affects indexing (Adult pages: `noindex, nofollow`)

---

## 9. Privacy & Data Protection

- No tracking, no ads, no profiling
- No third-party analytics (self-hosted Umami for marketing site only)
- All infrastructure EU-based (Hetzner, Germany/Finland)
- Data stored on user's PDS (AT Protocol — user owns their data)
- GDPR-compliant data deletion (firehose deletion events + direct request mechanism)
- Backup deletions applied within 30 days
- Age requirement: 16+ (Dutch UAVG threshold)
- Encryption at rest for sensitive data
- No cookies for forum end-users (token in memory)

---

## 10. Infrastructure & Deployment

- Hosting: Hetzner VPS (EU) + Bunny.net CDN (Slovenia)
- Reverse proxy: Caddy (automatic TLS)
- Deployment: Docker Compose
- Database: PostgreSQL with connection pooling, role separation, statement timeouts
- Cache: Valkey with authentication, dangerous commands disabled
- Docker image tagging: semver (pinned in production, `latest` in staging)
- Rollback: change Docker tag, `docker compose up -d`

---

## 11. Documentation & Process

- Architecture Decision Records (ADRs) for significant technical decisions
- Auto-generated API docs from Fastify routes + Zod schemas (OpenAPI 3.0)
- Staleness detection: CI flags PRs that change API code without updating docs
- READMEs follow shared template across all repos
- Conventional commit messages auto-generate changelogs

---

**Created:** 2026-03-14
**Sources:** `standards/shared.md`, `standards/backend.md`, `standards/frontend.md`, product CLAUDE.md files
