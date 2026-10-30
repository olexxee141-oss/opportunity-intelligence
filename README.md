# Opportunity Intelligence

An AI-powered platform for discovering, extracting, classifying, deduplicating, and recommending opportunities across jobs, internships, hackathons, competitions, scholarships, grants, fellowships, conferences, research, volunteering, and other structured opportunity types.

## Architecture

An npm-workspaces monorepo with independently deployable applications:
- `apps/api`: Express HTTP API.
- `apps/web`: React application.
- `apps/worker`: asynchronous jobs and crawling workloads.
- `packages/database`: Prisma schema and client.
- `packages/shared`: shared contracts and controlled category keys.

Backend modules follow routes → validator → controller → service → db. Controllers handle HTTP only, services own business rules, and db modules own persistence.

## Local setup

Requirements: Node.js 20.11+, npm 10+, Docker Desktop.

1. Copy `.env.example` to `.env` and set a private JWT secret.
2. Set `RESEND_API_KEY`, `EMAIL_FROM`, and `APP_URL`. Verify the sender domain in Resend before sending production email.
3. Run `npm install`.
4. Run `npm run infra:up`.
5. Run `npm run db:generate` and `npm run db:migrate`.
6. Start apps in separate terminals: `npm run dev:api`, `npm run dev:web`, and `npm run dev:worker`.

## Authentication API

- `POST /api/v1/auth/register` — create a user and initial owner workspace; sends a verification email.
- `POST /api/v1/auth/email/verification/resend` — request another verification email.
- `POST /api/v1/auth/email/verification/confirm` — consume a verification token.
- `POST /api/v1/auth/login` — sign in after email verification.
- `POST /api/v1/auth/refresh` — rotate the HttpOnly refresh cookie.
- `POST /api/v1/auth/logout` — revoke the refresh-token family.
- `POST /api/v1/auth/password/forgot` — request a password reset.
- `POST /api/v1/auth/password/reset` — consume a reset token and update the password.
- `GET /api/v1/auth/me` — return the authenticated user and workspaces.
- `POST /api/v1/auth/workspaces` — create another workspace.
- `GET /api/v1/auth/workspaces/:workspaceId` — verify membership.

Access tokens are short-lived JWTs returned in the response body. Send them as `Authorization: Bearer <token>`. Refresh tokens are random opaque values stored only as SHA-256 hashes in PostgreSQL and delivered using an HttpOnly, SameSite=Strict cookie. Refresh rotation is single-use; detected token reuse revokes the token family.

New accounts cannot sign in or use authenticated routes until their email is verified. Verification links expire after 30 minutes. Password reset links expire after 60 minutes. Email tokens are single-use, stored as hashes, and previous unconsumed tokens of the same type are invalidated when a new one is issued. Password reset revokes all existing refresh sessions.

Resume files are stored in a private Firebase Storage bucket. Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, and FIREBASE_STORAGE_BUCKET using a least-privilege service account. Never commit service-account credentials. Uploads accept PDF and DOCX files up to 10 MB, are checksum-deduplicated per workspace, and are parsed asynchronously by the worker. Downloads use five-minute signed URLs after workspace ownership checks. Extracted text is stored in PostgreSQL for subsequent CV analysis and AI-assisted tailoring.

Resume intelligence uses an LLM adapter in `@oi/ai`. The current adapter supports OpenAI-compatible chat-completions endpoints; configure `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL`. The adapter validates structured output with Zod, treats resume content as untrusted input, and requires evidence quotes. Proposed profile changes are stored separately and never applied without an explicit user decision. Quotes that cannot be found in the original extracted resume text are excluded from proposals.

Email is sent through Resend. Configure `RESEND_API_KEY`, `EMAIL_FROM`, and `APP_URL`; the sender address must belong to a domain verified in Resend. Email delivery failures are logged without exposing token values. The registration and recovery endpoints do not disclose whether an email address belongs to an account.

For workspace-scoped routes, use `requireAuth` followed by `requireWorkspace`. The latter requires an `X-Workspace-Id` header and checks membership against the database on every request. Do not accept a workspace ID from the request body as proof of authorization.

## Opportunity discovery pipeline

The platform uses one ingestion engine for multiple opportunity types. A source's supported categories are hints, not authoritative labels; classification belongs to the individual discovered listing after extraction.

1. **Source registry** — register websites, feeds and permitted external integrations. Sources can support multiple extensible category keys.
2. **Source discovery and scheduling** — discover candidate URLs from permitted sitemaps, feeds and listing pages; persist provenance, deduplicate per source, and schedule work with leases and backoff.
3. **Web crawling** — fetch candidate pages using HTTP first and use browser automation only when rendering is required. Enforce robots directives, source terms, request budgets, timeouts, and redirect/network protections.
4. **Content extraction** — extract opportunity records from HTML, structured data, supported feeds, and source-specific versioned extraction configurations.
5. **Normalization** — map extracted records into a universal opportunity shape and validate category-specific attributes.
6. **Deduplication** — identify duplicates using canonical URLs and stable content fingerprints, with safe update rules when a listing changes.
7. **Opportunity persistence and search** — store normalized opportunities separately from raw crawl captures; support filtering, pagination, and freshness tracking.
8. **AI enrichment** — classify each listing, extract requirements and skills, summarize descriptions, and record provider/model/version metadata. Treat page content as untrusted input.
9. **Recommendations and notifications** — match enriched opportunities against workspace members' profiles and preferences; deliver explainable recommendations and user-controlled alerts.

### Discovery data model

- `Source` stores source configuration and a list of supported category keys.
- `SourceDiscoveryRun` records each manual or scheduled discovery attempt and its outcome.
- `DiscoveryCandidate` stores a deduplicated URL, its discovery method, provenance, and first/last-seen timestamps.
- Discovery candidates are not yet verified opportunities. The later crawler/extractor stages decide whether a candidate contains an actual opportunity.

### Platform integrations

Social platforms are connectors, not generic websites. Use official APIs or explicitly authorized integrations, store credentials outside source records, and enforce each provider's permissions, quotas, retention and commercial-use terms. Public visibility is not blanket permission to scrape. Do not bypass login walls, CAPTCHAs, rate limits, or technical access restrictions.

### Safety and operations

- Keep source configuration, discovery runs, raw captures, normalized opportunities, enrichment, and recommendations separate.
- Raw HTML/text must not be overwritten by normalized or AI-generated content.
- AI may propose extraction or scheduling improvements, but production source settings require validation and controlled approval.
- Never bypass authentication, CAPTCHAs, paywalls, robots directives, or technical access restrictions.
- Re-check DNS resolution and every redirect at fetch time; block private, loopback, link-local, and reserved network destinations to mitigate SSRF and DNS-rebinding risks.
- Use HTTP-first fetching; browser automation is a fallback, not the default.
- Record crawl attempts, outcomes, timestamps, and errors so source health can be monitored.

## Engineering constraints

- Tenant-owned records must always be queried through a workspace-scoped service boundary.
- Raw source content is retained separately from normalized opportunity records.
- Crawlers must respect robots directives, source terms, rate limits, and access controls.
- Treat crawled pages and AI-produced text as untrusted input.
