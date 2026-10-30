# Opportunity Intelligence

An AI-powered platform for discovering, extracting, classifying, deduplicating, and recommending opportunities.

## Architecture

An npm-workspaces monorepo with independently deployable applications:
- `apps/api`: Express HTTP API.
- `apps/web`: React application.
- `apps/worker`: asynchronous jobs and crawling workloads.
- `packages/database`: Prisma schema and database client.
- `packages/shared`: shared contracts.

Backend modules follow routes → validator → controller → service → db. Controllers handle HTTP only, services own business rules, and db modules own persistence.

## Local setup

Requirements: Node.js 20.11+, npm 10+, Docker Desktop.

1. Copy `.env.example` to `.env` and adjust credentials.
2. Run `npm install`.
3. Run `npm run infra:up`.
4. Run `npm run db:generate` and `npm run db:migrate`.
5. Start apps in separate terminals: `npm run dev:api`, `npm run dev:web`, `npm run dev:worker`.

The initial schema is intentionally small. Domain modules and tenant-scoped access rules will be introduced incrementally.

## Engineering constraints

- Tenant-owned records must always be queried through a workspace-scoped service boundary.
- Raw source content is retained separately from normalized opportunity records.
- Crawlers must respect robots directives, source terms, rate limits, and access controls.
- Never bypass CAPTCHAs, authentication, or technical access restrictions.
- Treat crawled pages and AI-produced text as untrusted input.
