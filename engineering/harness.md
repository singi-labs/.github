# The Engineering Harness

How Singi Labs builds software with AI agents: the shared operating model that
surrounds every model, applied across **Barazo** and **Sifa**. This is the
reference a contributor (or their coding agent) reads once to understand how we
work and what keeps quality high.

## Agent = Model + Harness

A useful frame (after Google's *The New SDLC with Vibe Coding*, 2026): an agent is
`Model + Harness`. The model is the reasoning engine, but most of the behaviour
you actually experience comes from the **harness** — the instructions, tools,
guardrails, feedback loops, and review gates wrapped around it. When an agent does
something wrong, the cause is usually not the model; it is a missing rule, an
absent guardrail, or a vague spec. So we invest in the harness, and we version it
like code.

The harness has **two halves**, and the second one is the one that actually holds:

| Half | What it is | How it reaches you | What enforces it |
|---|---|---|---|
| **Instructions (prose)** | this doc, `AGENTS.md`, the standards, conventions | docs + the agent file in your clone | the agent reading it (fallible) |
| **Guardrails (executable)** | git hooks, CI checks, secret scanning, branch protection, the automated reviewer | committed in the repo + org workflows + rulesets | runs whether or not anyone read the docs |

Prose tells you the rules. The executable half enforces them deterministically, so
correctness never depends on a human — or an agent — remembering. If you only read
one section, read that distinction.

## The operating model

The developer's real output is not code; it is the system that produces and
verifies code. Ours runs on the GitHub Project board, and the loop is:

```
human defines spec  →  contributor/agent implements  →  tests + automated review verify  →  human review
   (acceptance                  (with tests)              (CI gates, AI reviewer)          (maintainer; squash merge)
    criteria)                                                                                      │
        ▲                                                                                          │
        └─────────────────────────────  rework feedback loop  ◀──────────────────────────────────┘
```

- **Specs become acceptance criteria become tests.** A task is not ready to pick up
  until it has clear acceptance criteria. Those criteria are what your tests assert.
  Write tests *with* the implementation — the test suite is the contract, more
  precise than any prose description.
- **The bar is the gate, not the demo.** "It seems to work" is not the standard. A
  green test suite, a passing automated review, and a maintainer's approval are.
- **Humans set direction; agents and contributors implement; gates verify.** A
  two-pass human review (a technical pass, then a user/mobile pass) is the final
  judgment no automated check replaces.

## The harness anatomy

Every component below exists in our setup. Naming them gives each an owner and a home.

| Component | What it is | Where it lives |
|---|---|---|
| **Instructions / rule files** | `AGENTS.md` per repo, the shared standards, this doc | repo roots (synced) + this directory |
| **Tools** | package scripts, Docker services, the `gh` CLI | each repo's `package.json` / compose files |
| **Sandboxes / execution** | local Docker services; CI runners; scoped contributor access (no production, no deploy secrets) | repos + CI + org team permissions |
| **Orchestration** | the Project board (the "factory floor"); task decomposition; routing mechanical work to cheaper models | org project + maintainer tooling |
| **Guardrails / hooks** | git hooks (lint-staged pre-commit, commit-message lint, pre-push lint+typecheck+build, which is build-only in some repos); CI checks, which also run the tests | committed `.husky/` + CI |
| **Verification** | the test suites; a blocking automated AI review check; CODEOWNERS + branch protection + maintainer review | repo tests, org workflows, rulesets |
| **Observability** | error tracking, metrics, structured logs | production infrastructure (maintainer-operated) |

## What you inherit vs. what is maintainer-only

This boundary keeps the harness reproducible.

**Shared — every contributor inherits this, human or agent:**

- `AGENTS.md` in each repo (house rules, stack, conventions).
- Committed git hooks: pre-commit, commit-message, pre-push.
- CI gates: the blocking automated AI review, lint / typecheck / test / build, and
  secret scanning.
- Branch protection + CODEOWNERS — no self-merge; a maintainer reviews every PR.
- The standards and this harness doc.
- The contributor agent-instruction file ([`agent-instructions.md`](agent-instructions.md)),
  copied into your local clone.

**Maintainer-only — NOT inherited, NOT committed to product repos:**

- Maintainer-local coding-agent hooks (worktree enforcement, secret-file blocks,
  commit-message guards), personal workflow skills, and editor wiring.
- Production access, deploy keys, and internal planning documents.

> Do **not** adopt any `.claude/` directory you find committed in a repo — it
> references maintainer-private context. Use only the contributor agent file above.

## Guardrails currently enforced

Deterministic — code, not "you were told":

- **No self-merge / no push to `main`** — branch protection + CODEOWNERS.
- **No secrets in the tree** — secret scanning runs on every PR (see
  [`templates/pr-gates.yml`](templates/pr-gates.yml)); `.env` and keys are git-ignored.
- **Conventional commits** — enforced by the commit-message hook.
- **Green before merge** — pre-push runs lint + typecheck + build (tests run in CI, not pre-push); CI repeats
  them as the hard gate; the automated reviewer posts a blocking check; a maintainer
  reviews.
- **No AI attribution** in commits/PRs — write neutral messages; no `Co-Authored-By`
  or "Generated with…" lines.
- **AT Protocol auth is OAuth, never app passwords.**

## How it stays in sync

One canonical copy of each thing; everything else points at it.

- **Org defaults** (CONTRIBUTING, code of conduct, CLA) live once in `singi-labs/.github`
  and GitHub applies them to every repo automatically.
- **This harness + standards** live once here; per-repo docs and the product docs
  sites link to them rather than copying.
- **`AGENTS.md`** is generated from a single source and synced into each repo by an
  automated workflow — never hand-edit a repo's `AGENTS.md`; change the source.
- **CI guardrails** are shared as reusable workflows: a repo references the org
  workflow instead of duplicating it, so a change here reaches every repo.

## Roadmap

Explicit choices, not oversights:

1. **Evals (not just tests) — only when a product ships an AI feature.** None today.
   If a feature itself becomes an agent, it gets an eval suite with an explicit
   rubric (task success, tool-use quality, trajectory, hallucination, response
   quality), gated in CI the same way tests gate a service.
2. **Agent-run observability** — metering the coding-agent loop (cost, first-pass
   success), beyond the production observability we already run.
3. **MCP / A2A open standards** — adopted only if cross-tool interoperability or
   multi-agent delegation becomes a real need.

---
*Frame adapted from Google, "The New SDLC with Vibe Coding" (2026).*
