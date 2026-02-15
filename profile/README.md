![Barazo Banner](https://raw.githubusercontent.com/barazo-forum/.github/main/assets/banner.jpg)

[![Status: Alpha](https://img.shields.io/badge/status-alpha-orange)]()
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](https://opensource.org/licenses/AGPL-3.0)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## What is Barazo?

Barazo is a modern forum platform that gives users **portable identity and data ownership**:

- **One account, all forums** -- Use your AT Protocol identity (Bluesky, etc.) everywhere
- **Your data, your control** -- Content lives on your Personal Data Server, not locked in each forum
- **Cross-forum reputation** -- Your contributions follow you across every Barazo instance
- **Open source** -- AGPL backend, MIT frontend. Self-host or use managed hosting.
- **Privacy-first** -- EU-hosted, GDPR-compliant, no tracking, no ads

**The Discourse/Flarum alternative for the decentralized web.**

---

## Why AT Protocol?

Traditional forums lock your identity and data into each platform. Barazo uses the AT Protocol to give you:

- **Portable identity** -- One login across all Barazo forums
- **Data ownership** -- Your posts live on your PDS, not the forum's database
- **Cross-forum features** -- Reputation, search, aggregation across instances
- **No vendor lock-in** -- Migrate forums without losing users or content
- **Federated moderation** -- AT Protocol labelers work across all forums

---

## Repositories

| Repository | Description | License | CI |
|------------|-------------|---------|-----|
| [barazo-api](https://github.com/barazo-forum/barazo-api) | AppView backend (Fastify, PostgreSQL, AT Protocol) | AGPL-3.0 | [![CI](https://github.com/barazo-forum/barazo-api/actions/workflows/ci.yml/badge.svg)](https://github.com/barazo-forum/barazo-api/actions/workflows/ci.yml) |
| [barazo-web](https://github.com/barazo-forum/barazo-web) | Forum frontend (Next.js, TailwindCSS) | MIT | [![CI](https://github.com/barazo-forum/barazo-web/actions/workflows/ci.yml/badge.svg)](https://github.com/barazo-forum/barazo-web/actions/workflows/ci.yml) |
| [barazo-lexicons](https://github.com/barazo-forum/barazo-lexicons) | AT Protocol schemas for forum data | MIT | [![CI](https://github.com/barazo-forum/barazo-lexicons/actions/workflows/ci.yml/badge.svg)](https://github.com/barazo-forum/barazo-lexicons/actions/workflows/ci.yml) |
| [barazo-deploy](https://github.com/barazo-forum/barazo-deploy) | Docker Compose templates for self-hosting | MIT | [![Validate](https://github.com/barazo-forum/barazo-deploy/actions/workflows/validate-compose.yml/badge.svg)](https://github.com/barazo-forum/barazo-deploy/actions/workflows/validate-compose.yml) |
| [barazo-website](https://github.com/barazo-forum/barazo-website) | Marketing + documentation site | MIT | -- |

---

## Features

**Core forum:**
- Topics, replies (threaded), categories, reactions (configurable per forum)
- Markdown editor and rendering (sanitized)
- Full-text search (PostgreSQL tsvector + GIN)
- Content maturity filtering (SFW/Mature/Adult at forum + category level)
- Moderation tools (lock, pin, delete, ban, content reporting, word/link blocklists)
- Notifications (in-app + email)
- User profiles with PDS sync, user preferences (global + per-community)
- Self-labels on posts (AT Protocol selfLabels)
- Age gate (self-declaration), block/mute users (portable via PDS)
- Admin-configurable onboarding fields per community

**AT Protocol integration:**
- OAuth sign-in with any AT Protocol PDS (Bluesky, self-hosted, etc.)
- Firehose subscription via Tap (filtered for `forum.barazo.*`)
- Cross-posting to Bluesky (default ON, toggleable) and Frontpage (feature flag)
- Rich OpenGraph images for cross-posts with forum branding
- Global aggregator mode (cross-community feed with maturity filtering)
- Cross-community reputation (activity counts across forums)

**Infrastructure:**
- Docker Compose deployment (dev, production, global aggregator profiles)
- Caddy reverse proxy with automatic SSL
- CI/CD with GitHub Actions (lint, typecheck, tests, a11y audit, CodeQL)
- Dependabot security monitoring, backup/restore scripts

**Quality:**
- WCAG 2.2 AA accessibility compliance (vitest-axe + @axe-core/playwright)
- Strict TypeScript (no `any`, no `@ts-ignore`)
- Test-driven development across all repos

---

## Planned Features

- Stripe billing / SaaS multi-tenant / custom domains (P3)
- Plugin system with admin UI (P3)
- AI features: semantic search, AI moderation, summarization, translation (P4)
- Private categories, AT Protocol labeler integration (P4)
- Legacy forum migration tools (Discourse, Flarum, phpBB) (P5)
- Marketing website, PWA (P5)

---

## Roadmap

**Phase 1: Core MVP** -- Done
- Auth, topics, replies, categories, search, moderation, reactions
- Cross-posting (Bluesky + Frontpage), notifications, user profiles
- Frontend (20 pages, 28 components), Docker Compose deployment

**Phase 2: User Experience + Global** -- Done
- P2.1: Content maturity, self-labels, age gate, user preferences
- P2.2: Global aggregator, cross-community reputation, block/mute
- P2.3: Age declaration revision, community onboarding fields

**Phase 3: SaaS Infrastructure**
- Stripe billing, multi-tenant support, custom domain automation
- Plugin system (core plugins + admin UI)
- GlitchTip error monitoring

**Phase 4: AI Features**
- Semantic search (pgvector hybrid ranking)
- AI-assisted moderation, topic summarization, translation
- AT Protocol labeler integration, private categories

**Phase 5: Migration and Launch**
- Legacy forum migration tools, marketing site
- Security audit, WCAG 2.2 AA audit, PWA

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 24 LTS, TypeScript |
| Backend | Fastify, Drizzle ORM, PostgreSQL 16, Valkey |
| Frontend | Next.js 16, React 19, TailwindCSS, shadcn/ui |
| Protocol | AT Protocol SDK (@atproto/api, @atproto/tap) |
| Hosting | Docker Compose, Hetzner VPS, Bunny.net CDN |
| Monitoring | GlitchTip, Pino, Grafana (Phase 3) |

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](https://github.com/barazo-forum/.github/blob/main/CONTRIBUTING.md) for guidelines.

Contributors sign a CLA to allow future commercial licensing flexibility.

---

## Architecture

See **[ARCHITECTURE.md](https://github.com/barazo-forum/.github/blob/main/ARCHITECTURE.md)** for the full system architecture, including data flow diagrams, deployment layout, and operating modes.

---

## License

**Dual-licensed for openness and sustainability:**

- **Backend (barazo-api):** AGPL-3.0 -- Protects the core, competitors must share changes
- **Frontend (barazo-web):** MIT -- Encourages customization and theming
- **Lexicons (barazo-lexicons):** MIT -- Open standard, maximum adoption
- **Deploy (barazo-deploy):** MIT -- Self-hosting should be freely usable

**Contributors sign a CLA** to allow future commercial licensing flexibility.

---

## Community

- **Website:** [barazo.forum](https://barazo.forum)
- **Discussions:** [GitHub Discussions](https://github.com/orgs/barazo-forum/discussions)
- **Bluesky:** [@barazo.forum](https://bsky.app/profile/barazo.forum)
- **Contact:** [@gxjansen](https://github.com/gxjansen)

---

**Barazo** -- Forums for the open web

(c) 2026 Barazo. AGPL-3.0 (backend) + MIT (frontend/lexicons/deploy).
