/**
 * Role permission matrix.
 *
 * Two layers of control:
 *  1. `canViewField(role, field)` — field-level visibility (client contact
 *     info, pricing).
 *  2. `ROLE_TASK_STATUSES(role)` — which orders a role's task list query
 *     fetches (used server-side to build the Prisma `where` clause; never
 *     trust the client to filter this).
 *
 * FUTURE EXTENSIBILITY (Priority 4, #12): today every check here is a plain
 * function of `Role`. To move to a granular, per-user permission matrix
 * later without touching call sites, swap the bodies of these functions to
 * consult a `Permission` table (e.g. `hasPermission(userId, action)`)
 * instead of the `Role` switch — every caller already goes through this
 * file's functions rather than checking `role === "admin"` inline, so the
 * migration is localized here.
 */

import { OrderStatus, Role } from "@prisma/client";

const CLIENT_CONTACT_FIELDS = ["clientPhone", "deliveryAddress", "internalReference"] as const;
const PRICING_FIELDS = ["price"] as const;

const ROLES_WITH_CLIENT_CONTACT_ACCESS: Role[] = [Role.admin, Role.reception];
const ROLES_WITH_PRICING_ACCESS: Role[] = [Role.admin, Role.reception, Role.production_manager];

export function canViewField(role: Role, field: string): boolean {
  if ((CLIENT_CONTACT_FIELDS as readonly string[]).includes(field)) {
    return ROLES_WITH_CLIENT_CONTACT_ACCESS.includes(role);
  }
  if ((PRICING_FIELDS as readonly string[]).includes(field)) {
    return ROLES_WITH_PRICING_ACCESS.includes(role);
  }
  return true;
}

/** Strips fields a role is not allowed to see from an order object before sending to the client. */
export function redactOrderForRole<T extends Record<string, any>>(order: T, role: Role): T {
  const redacted = { ...order };
  for (const field of [...CLIENT_CONTACT_FIELDS, ...PRICING_FIELDS]) {
    if (!canViewField(role, field)) {
      (redacted as any)[field] = null;
    }
  }
  return redacted;
}

/**
 * Statuses each role is responsible for acting on ("my tasks" queue).
 * admin / production_manager / reception see everything (handled via
 * ROLES_WITH_FULL_VISIBILITY, not listed here).
 */
export const ROLE_TASK_STATUSES: Partial<Record<Role, OrderStatus[]>> = {
  designer: [OrderStatus.new, OrderStatus.in_design],
  ctp: [OrderStatus.ready_for_ctp, OrderStatus.in_ctp],
  cutter: [OrderStatus.ready_for_cutting, OrderStatus.in_cutting],
  printer: [OrderStatus.ready_for_printing, OrderStatus.in_printing],
  carton_factory: [OrderStatus.ready_for_manufacturing, OrderStatus.in_manufacturing],
  quality: [OrderStatus.pending_quality],
};

// Reception sees every order it's involved with (all statuses) since it needs
// to answer client questions about status at any stage — handled as full
// visibility scoped to branch, same as admin/production_manager.
export const ROLES_WITH_FULL_VISIBILITY: Role[] = [Role.admin, Role.production_manager, Role.reception];

export const COMPLETED_STATUSES: OrderStatus[] = [OrderStatus.completed, OrderStatus.delivered];

export function canCreateOrder(role: Role): boolean {
  return role === Role.reception || role === Role.admin;
}

export function canManageUsers(role: Role): boolean {
  return role === Role.admin;
}

export function canReassignTasks(role: Role): boolean {
  return role === Role.admin || role === Role.production_manager;
}

export function canOverrideAnyStage(role: Role): boolean {
  return role === Role.admin;
}

/** Priority 2, #7 — force-restart an order back to quality. */
export function canRestartOrder(role: Role): boolean {
  return role === Role.admin || role === Role.reception || role === Role.production_manager;
}

/** Priority 1, #4 — designer accept/reject on a newly created order. */
export function canDecideOnNewOrder(role: Role): boolean {
  return role === Role.designer || role === Role.admin;
}

/** Priority 2, #5 — who sees the visual progress stepper. */
export function canViewProgressStepper(role: Role): boolean {
  return role === Role.admin || role === Role.reception || role === Role.production_manager;
}

/** Priority 1, #2 — file visibility check (used both when listing files and when serving a download). */
export function canViewFile(
  role: Role,
  userId: string,
  file: {
    uploadedById: string;
    visibility: "everyone" | "roles" | "user";
    visibleRoles: string[];
    visibleUserId: string | null;
  }
): boolean {
  if (role === Role.admin) return true;
  if (file.uploadedById === userId) return true;
  if (file.visibility === "everyone") return true;
  if (file.visibility === "roles") return file.visibleRoles.includes(role);
  if (file.visibility === "user") return file.visibleUserId === userId;
  return false;
}
