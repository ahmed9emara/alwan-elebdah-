# خطة قابلية التوسع (Scalability Plan)
### Print Shop Production Management System

This plan covers how the foundation architecture grows along four axes that
matter for this business: **more orders/day**, **more branches**, **more
concurrent users on the shop floor**, and **more features** (pricing,
inventory, WhatsApp, barcode/QR, analytics) — without a rewrite.

---

## 1. Current foundation, and why it's a reasonable starting point

- **Next.js monolith (App Router)** — API routes + UI in one deployable
  unit. Right choice at low-to-medium scale: one thing to deploy, one
  language, fast to iterate.
- **PostgreSQL + Prisma** — relational integrity matters here (an order's
  stage history, permissions, and state machine are all relationship-heavy
  and need transactional guarantees — e.g. "update order status" and
  "insert history row" must succeed or fail together, which the transition
  API already does with `prisma.$transaction`).
- **Stateless auth (JWT sessions)** — no server-side session store to scale.
- **All authorization logic centralized** in `lib/permissions.ts` and
  `lib/workflow/stateMachine.ts` rather than scattered across routes/UI —
  this is the single most important thing for scaling *safely*: every new
  screen or role reads from the same source of truth instead of
  re-implementing rules that could drift.

## 2. Scaling order volume (rows, not users)

A busy shop might do a few hundred orders/day; that's small for Postgres,
but the **stage history table grows fast** (every transition = 1 row, and a
carton order might have 8-10 transitions including returns).

- Indexes are already on `status`, `priority`, `deadline`, `branchId`,
  `createdById` on `Order`, and on `orderId`/`userId`/`toStatus` on
  `OrderStageHistory` — these back the two hottest queries: "my tasks" and
  "order timeline."
- **Partition `OrderStageHistory` by month** once it passes a few million
  rows (Postgres native partitioning) — history is append-only and rarely
  queried outside a single order's timeline or a bounded reporting window,
  so this is low-risk and keeps indexes small.
- **Archive, don't delete.** Soft-delete (`deletedAt`) is already in the
  schema for `Order`/`User`; add a scheduled job to move `delivered`/
  `cancelled` orders older than N months to an archive table or cold
  storage, keeping the hot table small for dashboards.
- **Reporting queries move off the primary.** Once "orders per day, average
  time per stage, delayed orders" reports get expensive, point them at a
  read replica rather than the primary the shop floor is writing to.

## 3. Scaling concurrent users / real-time updates

The brief wants status changes to appear instantly on other people's
screens without refresh. At small scale (tens of concurrent users across
5-6 departments) this is cheap; the risk is only if it's built naively.

- **Start with Server-Sent Events (SSE)**, one connection per logged-in
  user, server pushes "an order in your queue changed" events. Cheaper than
  WebSockets to run and sufficient for one-directional status pushes.
- **Scope the push, don't broadcast.** Each event only needs to reach users
  whose `ROLE_TASK_STATUSES` (or branch) includes the order's new status —
  a few people, not the whole shop. This keeps fan-out cheap even as
  headcount grows.
- **If it outgrows a single Next.js process** (multiple app server
  instances behind a load balancer), the SSE/WebSocket layer needs a shared
  pub/sub backbone (Redis pub/sub, or a managed service like Pusher /
  Supabase Realtime — both already listed as acceptable in the brief) so an
  event published on instance A reaches a user connected to instance B.
- **Notifications table already exists** as a durable fallback — if a user
  isn't connected when an event fires, they still see it in the
  notification center on next login instead of losing it.

## 4. Scaling to multiple branches

The schema already has a `Branch` entity and `branchId` on `User` and
`Order`, so this isn't a schema migration later — it's a **query-scoping
change**:

- All "my tasks" and admin list queries should filter by `branchId` for
  non-admin roles once branch 2 exists (admin/production_manager see across
  branches by design).
- Order numbers become branch-prefixed (`MAIN-0001`, `NORTH-0001`) to stay
  human-readable per location while remaining globally unique.
- Machine speed / time-estimation constants become **per-branch settings**
  (different presses have different speeds) — the `Setting` table already
  supports keyed config; add a `branchId` column to it when the second
  branch's press speed differs from the first.
- Cross-branch reporting (admin dashboards) is the one place that
  legitimately needs to scan multiple branches — keep that on the read
  replica, not the primary.

## 5. Scaling the workflow/state machine itself

The brief already anticipates new roles (`cutter`), optional sub-stages
(die-cut/folding/gluing), and conditional branches (skip manufacturing for
non-carton products) — the state machine is designed for this:

- Adding a role: add it to `Role` enum, add its statuses to
  `ROLE_TASK_STATUSES`, add its transitions to `FORWARD_TRANSITIONS`/
  `RETURN_TRANSITIONS`. No other file needs to change — every screen reads
  the same tables.
- Adding a new conditional branch (e.g. a lamination sub-department some
  orders skip): follow the same pattern as `requiresManufacturing()` —
  one predicate function, one branch point in `getNextStatus()`.
- **Splitting `in_manufacturing` into real sub-stages** (currently a single
  status with a `manufacturingSubStage` field) is a natural next step once
  carton volume justifies it — the field is already there so it's additive,
  not a migration.

## 6. Scaling background/async work

Not everything on a stage transition should block the HTTP response:
notifying the next role, sending a WhatsApp message (planned), generating a
barcode/QR ticket (planned), writing to an analytics table. As these
features land:

- Move them behind a **job queue** (BullMQ + Redis is the natural fit given
  the Node/Next.js stack) instead of doing them inline in the transition
  route. The transition route commits the DB transaction and enqueues jobs;
  it doesn't wait on WhatsApp's API or a PDF-rendering step.
- This also isolates flaky third-party calls (WhatsApp, SMS) from the
  core workflow — a failed notification retries in the background instead
  of failing someone's "mark as done" click.

## 7. Scaling file storage

- Local disk works for MVP but doesn't scale across multiple app server
  instances or branches. `OrderFile.fileUrl` is already an opaque string
  rather than a local-path assumption — swapping the storage backend to
  S3/MinIO later is a change in one upload/download module, not a schema
  migration.

## 8. Scaling authorization as roles/features grow

- Keep the **two-file rule**: any new visibility or action rule goes into
  `lib/permissions.ts` or `lib/workflow/stateMachine.ts`, never inline in a
  page or route. This is what prevents "designer can see the phone number
  on the new admin report page" style leaks as the number of screens grows
  from ~6 to 20+.
- When pricing/quotations (a planned future feature) goes live, it should
  reuse the existing `canViewField`/`redactOrderForRole` pattern rather
  than introducing a second permissions system.

## 9. What to defer until there's real signal

Deliberately **not** doing now, to avoid premature complexity:

- Microservices split — the monolith is fine until a specific department
  (e.g. reporting) has genuinely different scaling/deploy needs.
- Multi-region deployment — only relevant if branches are in different
  countries with latency-sensitive shop-floor UIs.
- A dedicated search engine (Elasticsearch/Meilisearch) for order search —
  Postgres full-text search or simple indexed filters are enough until
  order volume is in the hundreds of thousands.

## 10. Rough growth checkpoints

| Signal | Action |
|---|---|
| Dashboard queries slow down | Confirm indexes are used (`EXPLAIN ANALYZE`); add read replica for reports |
| `OrderStageHistory` > ~5M rows | Partition by month |
| 2nd physical branch opens | Turn on branch-scoping in queries; branch-prefixed order numbers |
| Concurrent shop-floor users > ~50 on one instance | Add Redis pub/sub behind SSE; consider horizontal scaling of the app server |
| WhatsApp/QR/barcode features ship | Introduce job queue (BullMQ + Redis) rather than inline calls |
| File storage > single-disk comfort | Swap to S3/MinIO via the existing `fileUrl` abstraction |

---

**Bottom line:** nothing above requires re-architecting what's already
built. The schema, state machine, and permission matrix were designed so
that branches, roles, sub-stages, and integrations are additive changes —
the scaling work is mostly about *where things run* (replica, queue,
pub/sub) rather than *how the domain is modeled*.
