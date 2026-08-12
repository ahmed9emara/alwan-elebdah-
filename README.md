# نظام إدارة الإنتاج - مطبعة (Print Shop PMS)

Foundation version of the task-centric production management system described
in the project brief: Reception → Design → CTP → Printing → (Carton
Factory, conditional) → Quality → Delivery, with Arabic RTL UI throughout.

## What's included in this foundation

- **`prisma/schema.prisma`** — complete data model (users, branches, orders,
  files, stage history/audit trail, assignments, notifications, settings).
- **`lib/workflow/stateMachine.ts`** — the authoritative state machine:
  forward transitions, return-with-reason transitions, and automatic
  skipping of the manufacturing branch for non-carton products.
- **`lib/permissions.ts`** — role permission matrix: who sees which orders,
  who can see client contact/pricing fields, who can create orders/manage
  users/reassign tasks.
- **`lib/workflow/timeEstimation.ts`** — configurable expected-duration
  calculator per stage, with priority multipliers and safety buffer.
- **`app/api/orders/[id]/transition/route.ts`** — the core backend
  endpoint: validates the transition against the state machine and
  permissions, records full history (who/when/duration/delay), and updates
  the order.
- **`app/api/auth/[...nextauth]/route.ts`** — credentials-based auth with
  role/branch embedded in the session.
- **`components/orders/OrderForm.tsx`** — the full order-intake form with
  every conditional section from the spec (standard vs custom size, 3D
  depth/closing type, carton/manufacturing section only for carton
  products, live estimated-plates calculation), Arabic labels and
  validation messages, RTL layout.
- **`app/(dashboard)/dashboard/page.tsx`** — role-filtered "My Tasks" view
  with color-coded status cards and delay warnings.
- **`prisma/seed.ts`** — one user per role (password `Password123!`) plus a
  sample paper order and a sample carton-box order.

## Now also included (second pass)

- **`app/(auth)/login/page.tsx`** — Arabic RTL login screen.
- **`app/(dashboard)/orders/[id]/page.tsx`** + **`OrderActions.tsx`** —
  order detail page: info panel (field-redacted per role), full activity
  timeline with durations/delays, "تم الإنجاز" and "إرجاع لمرحلة سابقة"
  (return with mandatory reason) buttons wired to the transition API.
- **`app/(dashboard)/admin/users/page.tsx`** + `app/api/users/*` — admin
  user management: list, create, activate/deactivate.
- **`app/api/orders/route.ts`** — role-filtered order list + order creation
  (computes estimated plates, expected duration, order number, and writes
  the first history row).
- **`components/orders/FileUpload.tsx`** + `app/api/orders/[id]/files/route.ts`
  — file upload wired into the order detail page (local disk for now, see
  the abstraction note in that route for swapping to S3/MinIO later).
- **`middleware.ts`** — protects `/dashboard`, `/orders`, `/admin` routes,
  redirecting unauthenticated users to `/login`.
- **`components/Navbar.tsx`** + dashboard layout — shared nav showing the
  signed-in user's name/role, with links gated by `canCreateOrder`/
  `canManageUsers` from `lib/permissions.ts`.

## Priority 1 & 2 fixes (this pass)

**Priority 1 — critical fixes:**
1. **Admin can now edit users** — inline edit (name/email/role) with a
   confirmation prompt when the role changes, plus soft-delete. See
   `app/api/users/[id]/route.ts` (PATCH/DELETE) and the admin users page.
2. **File attachments are viewable/downloadable** — uploads now carry a
   visibility setting (everyone involved / specific roles / specific user).
   Downloads go through `app/api/orders/[id]/files/[fileId]/route.ts`,
   which re-checks visibility before streaming the file — nothing is
   served as a static/public asset.
3. **User profile page** (`/profile`) — every logged-in user can edit
   their own name, email, password (with current-password verification),
   and upload an optional avatar.
4. **Workflow order corrected** — the state machine
   (`lib/workflow/stateMachine.ts`) now routes:
   **Design → CTP → Paper Cutting (conditional) → Printing → Carton
   Factory/Finishing (conditional) → Quality → Completed → Delivered.**
   Cutting is a new `ready_for_cutting`/`in_cutting` stage pair that only
   applies when an order has `needsCutting = true` (a checkbox on the
   order form); simple paper jobs skip it, and the manufacturing branch
   is still skipped entirely for non-carton products as before. The
   designer now sees an explicit **Accept / Reject** panel on newly
   created orders (`DesignerDecision.tsx`) instead of using the generic
   advance button — rejecting requires a reason and is logged without
   silently deleting or hiding the order.

**Priority 2 — workflow & UX:**
5. **Visual progress stepper** on the order detail page
   (`OrderProgressStepper.tsx`), visible only to admin/reception/
   production_manager, showing each milestone's status and time spent.
6. **Dashboard split into Active / Completed** — completed and delivered
   orders now sit in a separate section at the bottom with a green
   checkmark; active tasks stay at the top.
7. **Restart / reprint** (`RestartOrder.tsx`) — admin/reception/
   production_manager can force any order back to the Quality stage with
   a mandatory reason; shown as a banner on the order and logged in the
   timeline with a distinct orange marker.

## What's stubbed / left for the next pass (Priority 3+)

Per your instructions, I stopped after Priority 2. Not yet done:
- CMYK / spot-color selection on the order form (still a simple
  colors-count dropdown).
- File upload *at order creation* by Reception (upload only exists on the
  order detail page today; the "no files available" option isn't there
  yet either).
- Expanded product types / paper types / a dedicated finishing-services
  list assignable to a Finishing role.
- Pricing field is in the schema and shown on the order detail page (if
  present), but there's no way to **enter** a price from the order form
  yet.
- Granular (non-role-based) permissions — `lib/permissions.ts` has a
  comment marking exactly where to swap role checks for a real permission
  table later; nothing beyond that scaffolding was built.

## What needs testing after this pass

- **Full workflow walkthrough** for an order with `needsCutting = true`
  (should visit the new cutting stage) and one without (should skip
  straight to printing) — confirm both the advance buttons and the return
  options make sense at each step.
- **Designer accept/reject** on a freshly created order — confirm reject
  requires a reason, doesn't advance the order, and is visible in the
  timeline/banner.
- **File visibility** — upload a file as one role restricted to another
  role or a specific user, then confirm a third role/user genuinely can't
  see or download it (try hitting the download URL directly, not just
  the UI).
- **Restart** — confirm it's only offered to admin/reception/
  production_manager, requires a reason, and correctly resets status to
  Quality with the reason visible.
- **Admin user edit** — changing a user's role and confirming their task
  list changes accordingly on next login/refresh; confirm you can't delete
  or demote your own account improperly.
- **Profile page** — password change with a wrong current password should
  be rejected; avatar upload should show up in the navbar/profile.
- Since I don't have the ability to run `npm install`/a dev server in
  this environment, this pass has **not been build-verified** — please
  run `npx prisma migrate dev` again (new columns/enum values were added)
  before testing.

## Setup

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL and NEXTAUTH_SECRET
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Login with any seeded account, e.g. `admin@printshop.local` /
`Password123!`.

## Scalability plan

See `SCALABILITY_PLAN.md` for how this architecture is expected to grow
(multi-branch, higher order volume, real-time updates at scale, async
work, read-heavy reporting, and the eventual features listed in the
brief: pricing/quotations, inventory, WhatsApp notifications, barcode/QR
tickets).
