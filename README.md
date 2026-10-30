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

1. Copy `.env.example` to `.env` and set a private JWT secret.
2. Run `npm install`.
3. Run `npm run infra:up`.
4. Run `npm run db:generate` and `npm run db:migrate`.
5. Start apps in separate terminals: `npm run dev:api`, `npm run dev:web`, and `npm run dev:worker`.

## Authentication API

- `POST /api/v1/auth/register` — create a user and initial owner workspace.
- `POST /api/v1/auth/login` — verify credentials.
- `POST /api/v1/auth/refresh` — rotate the HttpOnly refresh cookie.
- `POST /api/v1/auth/logout` — revoke the refresh-token family.
- `GET /api/v1/auth/me` — return the authenticated user and workspaces.
- `POST /api/v1/auth/workspaces` — create another workspace.
- `GET /api/v1/auth/workspaces/:workspaceId` — verify membership.

Access tokens are short-lived JWTs returned in the response body. Send them as `Authorization: Bearer <token>`. Refresh tokens are random opaque values stored only as SHA-256 hashes in PostgreSQL and delivered using an HttpOnly, SameSite=Strict cookie. Refresh rotation is single-use; detected token reuse revokes the token family.

For workspace-scoped routes, use `requireAuth` followed by `requireWorkspace`. The middleware requires an `X-Workspace-Id` header and checks membership against the database on every request. Do not accept a workspace ID from the request body as proof of authorization.

## Engineering constraints

- Tenant-owned records must always be queried through a workspace-scoped service boundary.
- Raw source content is retained separately from normalized opportunity records.
- Crawlers must respect robots directives, source terms, rate limits, and access controls.
- Never bypass CAPTCHAs, authentication, or technical access restrictions.
- Treat crawled pages and AI-produced text as untrusted input.
