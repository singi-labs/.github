# Contributing to Barazo

Thank you for your interest in contributing to Barazo! This document explains our development process and how to get your contributions merged.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it. Report unacceptable behavior to conduct@barazo.forum.

## Getting Started

### Prerequisites

- Node.js 24 LTS
- pnpm (install: `npm install -g pnpm`)
- Docker + Docker Compose
- Git
- GitHub account

### Setup

1. **Fork the repository** (if external contributor)
   ```bash
   # Click "Fork" on GitHub, then:
   git clone https://github.com/YOUR_USERNAME/REPO_NAME.git
   cd REPO_NAME
   git remote add upstream https://github.com/singi-labs/REPO_NAME.git
   ```

2. **Clone directly** (if team member)
   ```bash
   git clone https://github.com/singi-labs/REPO_NAME.git
   cd REPO_NAME
   ```

3. **Install dependencies**
   ```bash
   pnpm install
   ```

4. **Start local environment**
   ```bash
   # Start PostgreSQL + Valkey
   docker compose -f docker-compose.dev.yml up -d
   
   # Run development server
   pnpm dev
   ```

5. **Run tests**
   ```bash
   pnpm test
   pnpm lint
   pnpm typecheck
   ```

## Development Workflow

### 1. Create a Branch

**Never commit directly to `main`.** Always work in a feature branch.

```bash
git checkout main
git pull origin main
git checkout -b TYPE/short-description
```

**Branch naming:**
- `feat/add-reactions` - New features
- `fix/xss-sanitization` - Bug fixes
- `docs/api-reference` - Documentation
- `test/topic-crud` - Tests
- `refactor/auth-middleware` - Refactoring
- `chore/update-deps` - Maintenance

### 2. Make Changes

**Follow our standards:**
- **TypeScript strict mode** - No `any`, no `@ts-ignore`
- **Tests required** - Write tests BEFORE implementation (TDD)
- **Conventional commits** - `type(scope): description`
- **Input validation** - Zod schemas on all API endpoints
- **Output sanitization** - DOMPurify for all user content
- **Accessibility** - WCAG 2.2 AA compliance
- **No console.log** - Use Pino logger

See `standards/shared.md` for full details.

### 3. Commit Your Changes

```bash
git add .
git commit -m "feat(appview): add reaction system

Implements configurable reactions per forum. Users can react to topics
and replies using forum-configured emoji sets. Reaction counts are
computed and cached.

Closes #42"
```

**Commit message format:**
```
type(scope): short description

Optional longer explanation of what and why.

Closes #123
```

**Types:** feat, fix, docs, test, refactor, chore, ci

**Scopes:** appview, frontend, lexicon, deploy, auth, moderation, etc.

### 4. Push and Create PR

```bash
git push -u origin feat/add-reactions
```

**Open PR via GitHub UI or CLI:**
```bash
gh pr create --title "feat(appview): add reaction system" \
  --body "Implements configurable reactions. Closes #42"
```

**PR checklist (complete in PR description):**
- [ ] Tests added/updated and passing
- [ ] Documentation updated
- [ ] Self-reviewed my own code
- [ ] No TypeScript errors or ESLint warnings
- [ ] CI checks pass
- [ ] Breaking changes documented (if any)

### 5. Code Review

- **Respond to feedback** - Address review comments promptly
- **Push fixups to same branch** - No force-push during review
- **CI must be green** - Fix any failing checks
- **Be patient** - Maintainers review when available

### 6. Merge

Once approved and CI passes:
- Maintainer will merge (squash and merge)
- Your branch will be auto-deleted
- Celebrate! 🎉

## What to Contribute

### Good First Issues

Look for issues labeled `good first issue`:
- Small, well-defined scope
- Clear acceptance criteria
- Ideal for learning the codebase

### Areas We Need Help

- **Documentation** - Guides, examples, API docs
- **Tests** - Increase coverage, edge cases
- **Accessibility** - a11y audits, keyboard nav improvements
- **Internationalization** - Translation infrastructure (future)
- **Performance** - Database query optimization
- **Bug fixes** - Check open issues

### What We DON'T Accept

- Code with failing tests
- Features without tests
- Breaking changes without migration path
- Security vulnerabilities
- Non-AGPL compatible code (backend) or non-MIT (frontend/lexicons)

## Development Standards

### Testing

**Write tests BEFORE implementation** (TDD):
```bash
# 1. Write failing test
pnpm test --watch

# 2. Implement feature

# 3. Test passes

# 4. Refactor
```

**Test types:**
- **Unit tests** - Business logic (Vitest)
- **Integration tests** - API endpoints (Supertest + real DB)
- **Accessibility tests** - UI components (vitest-axe + @axe-core/playwright)

**Coverage:** Aim for 80%+ on new code.

### TypeScript

**Strict mode, no compromises:**
```typescript
// ❌ Never do this
const data: any = fetchData()
// @ts-ignore
data.foo.bar()

// ✅ Do this
const data: unknown = fetchData()
if (isValidData(data)) {
  data.foo.bar()  // Type-safe
}
```

### Validation & Sanitization

**Every API endpoint:**
```typescript
// Validate input
const createTopicSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(100000),
})

fastify.post('/api/topics', async (request, reply) => {
  const body = createTopicSchema.parse(request.body)
  
  // ... business logic ...
  
  // Sanitize output
  const sanitized = DOMPurify.sanitize(markdown)
  return { content: sanitized }
})
```

### Accessibility

**For UI components:**
- Semantic HTML (`<button>` not `<div onClick>`)
- Keyboard navigable (test with Tab key)
- ARIA attributes where needed
- Visible focus indicators
- vitest-axe tests

**Example:**
```tsx
// ❌ Bad
<div onClick={handleClick}>Click me</div>

// ✅ Good
<button onClick={handleClick} aria-label="Create topic">
  Click me
</button>
```

## Dependency Management

### Adding Dependencies

**Before adding a new dependency:**
1. Check if it's really needed (can we do without it?)
2. Verify license compatibility (MIT/Apache 2.0/BSD)
3. Check maintenance status (last update, open issues)
4. Consider bundle size impact
5. Create an issue discussing the dependency first

**Install:**
```bash
pnpm add package-name
# Lockfile auto-updates
```

### Updating Dependencies

**Monthly Dependabot PRs are automated.**

**Manual updates:**
```bash
pnpm update --latest
pnpm test  # Verify nothing broke
```

## Documentation

**Update docs in the same PR as code changes:**

- **API changes** → OpenAPI spec auto-updates from Zod schemas
- **Features** → Update README or `docs/` guides
- **Breaking changes** → Migration guide required
- **Config changes** → Update `.env.example`

## Getting Help

**Stuck? Ask for help:**
- **GitHub Discussions** - Questions, ideas, general discussion
- **GitHub Issues** - Bug reports, feature requests
- **AT Protocol Discord** - `#barazo` channel
- **Email** - [hello@barazo.forum](mailto:hello@barazo.forum)

## Recognition

Contributors are listed in:
- README "Contributors" section
- GitHub contributor graph
- Release notes (if contribution is in that release)

## License

By contributing, you agree that your contributions will be licensed under:
- **barazo-api** - AGPL-3.0
- **barazo-web** - MIT
- **barazo-lexicons** - MIT
- **barazo-deploy** - MIT

See LICENSE file in each repo for details.

---

**Thank you for contributing to Barazo!** Every contribution, no matter how small, helps build a better decentralized forum platform.
