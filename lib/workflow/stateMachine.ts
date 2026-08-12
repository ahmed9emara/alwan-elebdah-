/**
 * Order workflow state machine.
 *
 * Corrected flow (per Priority 1 fix):
 *   Design → CTP → Paper Cutting (conditional, order.needsCutting) → Printing
 *   → Carton Factory / Finishing (conditional, product type) → Quality → Completed → Delivered
 *
 * Two special, non-linear actions exist outside the forward/return pairs:
 *   - "reject" — designer explicitly rejects a new order at intake (stays at
 *     `new`, logs a reason, does not advance).
 *   - "restart" — admin/reception/production_manager can force any order
 *     back to `pending_quality` with a mandatory reason (reprint/rework).
 */

import { OrderStatus, Role } from "@prisma/client";

export type TransitionKind = "forward" | "return";

export interface TransitionRule {
  from: OrderStatus;
  to: OrderStatus;
  kind: TransitionKind;
  allowedRoles: Role[];
  requiresReason: boolean;
}

export interface OrderRoutingInput {
  productType: string;
  needsCutting: boolean;
}

export function requiresManufacturing(productType: string): boolean {
  return productType === "carton_box" || productType === "box_3d";
}

// Linear backbone assuming BOTH optional branches (cutting + manufacturing)
// are present; getNextStatus() skips whichever branch isn't needed.
const FORWARD_CHAIN: OrderStatus[] = [
  OrderStatus.new,
  OrderStatus.in_design,
  OrderStatus.ready_for_ctp,
  OrderStatus.in_ctp,
  OrderStatus.ready_for_cutting,
  OrderStatus.in_cutting,
  OrderStatus.ready_for_printing,
  OrderStatus.in_printing,
  OrderStatus.ready_for_manufacturing,
  OrderStatus.in_manufacturing,
  OrderStatus.pending_quality,
  OrderStatus.completed,
  OrderStatus.delivered,
];

export const STATUS_OWNER_ROLE: Partial<Record<OrderStatus, Role[]>> = {
  [OrderStatus.new]: [Role.designer, Role.admin],
  [OrderStatus.in_design]: [Role.designer, Role.admin],
  [OrderStatus.ready_for_ctp]: [Role.ctp, Role.admin],
  [OrderStatus.in_ctp]: [Role.ctp, Role.admin],
  [OrderStatus.ready_for_cutting]: [Role.cutter, Role.admin],
  [OrderStatus.in_cutting]: [Role.cutter, Role.admin],
  [OrderStatus.ready_for_printing]: [Role.printer, Role.admin],
  [OrderStatus.in_printing]: [Role.printer, Role.admin],
  [OrderStatus.ready_for_manufacturing]: [Role.carton_factory, Role.admin],
  [OrderStatus.in_manufacturing]: [Role.carton_factory, Role.admin],
  [OrderStatus.pending_quality]: [Role.quality, Role.admin],
  [OrderStatus.completed]: [Role.reception, Role.admin],
};

export const FORWARD_TRANSITIONS: TransitionRule[] = [
  { from: OrderStatus.new, to: OrderStatus.in_design, kind: "forward", allowedRoles: [Role.designer, Role.admin], requiresReason: false },
  { from: OrderStatus.in_design, to: OrderStatus.ready_for_ctp, kind: "forward", allowedRoles: [Role.designer, Role.admin], requiresReason: false },
  { from: OrderStatus.ready_for_ctp, to: OrderStatus.in_ctp, kind: "forward", allowedRoles: [Role.ctp, Role.admin], requiresReason: false },
  // in_ctp -> either ready_for_cutting OR ready_for_printing, decided by getNextStatus()
  { from: OrderStatus.in_ctp, to: OrderStatus.ready_for_cutting, kind: "forward", allowedRoles: [Role.ctp, Role.admin], requiresReason: false },
  { from: OrderStatus.in_ctp, to: OrderStatus.ready_for_printing, kind: "forward", allowedRoles: [Role.ctp, Role.admin], requiresReason: false },
  { from: OrderStatus.ready_for_cutting, to: OrderStatus.in_cutting, kind: "forward", allowedRoles: [Role.cutter, Role.admin], requiresReason: false },
  { from: OrderStatus.in_cutting, to: OrderStatus.ready_for_printing, kind: "forward", allowedRoles: [Role.cutter, Role.admin], requiresReason: false },
  { from: OrderStatus.ready_for_printing, to: OrderStatus.in_printing, kind: "forward", allowedRoles: [Role.printer, Role.admin], requiresReason: false },
  // in_printing -> either ready_for_manufacturing OR pending_quality, decided by getNextStatus()
  { from: OrderStatus.in_printing, to: OrderStatus.ready_for_manufacturing, kind: "forward", allowedRoles: [Role.printer, Role.admin], requiresReason: false },
  { from: OrderStatus.in_printing, to: OrderStatus.pending_quality, kind: "forward", allowedRoles: [Role.printer, Role.admin], requiresReason: false },
  { from: OrderStatus.ready_for_manufacturing, to: OrderStatus.in_manufacturing, kind: "forward", allowedRoles: [Role.carton_factory, Role.admin], requiresReason: false },
  { from: OrderStatus.in_manufacturing, to: OrderStatus.pending_quality, kind: "forward", allowedRoles: [Role.carton_factory, Role.admin], requiresReason: false },
  { from: OrderStatus.pending_quality, to: OrderStatus.completed, kind: "forward", allowedRoles: [Role.quality, Role.admin], requiresReason: false },
  { from: OrderStatus.completed, to: OrderStatus.delivered, kind: "forward", allowedRoles: [Role.reception, Role.admin], requiresReason: false },
];

// Any stage can be returned to its immediately previous stage with a mandatory reason.
// Both possible predecessors are listed for statuses reachable via two paths
// (ready_for_printing can come from in_ctp directly or from in_cutting) —
// the UI only offers the one that matches the order's actual path where possible.
export const RETURN_TRANSITIONS: TransitionRule[] = [
  { from: OrderStatus.in_design, to: OrderStatus.new, kind: "return", allowedRoles: [Role.designer, Role.admin], requiresReason: true },
  { from: OrderStatus.ready_for_ctp, to: OrderStatus.in_design, kind: "return", allowedRoles: [Role.ctp, Role.admin], requiresReason: true },
  { from: OrderStatus.in_ctp, to: OrderStatus.ready_for_ctp, kind: "return", allowedRoles: [Role.ctp, Role.admin], requiresReason: true },
  { from: OrderStatus.ready_for_cutting, to: OrderStatus.in_ctp, kind: "return", allowedRoles: [Role.cutter, Role.admin], requiresReason: true },
  { from: OrderStatus.in_cutting, to: OrderStatus.ready_for_cutting, kind: "return", allowedRoles: [Role.cutter, Role.admin], requiresReason: true },
  { from: OrderStatus.ready_for_printing, to: OrderStatus.in_cutting, kind: "return", allowedRoles: [Role.printer, Role.admin], requiresReason: true },
  { from: OrderStatus.ready_for_printing, to: OrderStatus.in_ctp, kind: "return", allowedRoles: [Role.printer, Role.admin], requiresReason: true },
  { from: OrderStatus.ready_for_manufacturing, to: OrderStatus.in_printing, kind: "return", allowedRoles: [Role.carton_factory, Role.admin], requiresReason: true },
  { from: OrderStatus.pending_quality, to: OrderStatus.in_manufacturing, kind: "return", allowedRoles: [Role.quality, Role.admin], requiresReason: true },
  { from: OrderStatus.pending_quality, to: OrderStatus.in_printing, kind: "return", allowedRoles: [Role.quality, Role.admin], requiresReason: true },
];

export const ARABIC_STATUS_LABEL: Record<OrderStatus, string> = {
  draft: "مسودة",
  new: "بانتظار قبول التصميم",
  in_design: "قيد التصميم",
  ready_for_ctp: "جاهز للزنكات (CTP)",
  in_ctp: "قيد تجهيز الزنكات",
  ready_for_cutting: "جاهز لقص الورق",
  in_cutting: "قيد قص الورق",
  ready_for_printing: "جاهز للطباعة",
  in_printing: "قيد الطباعة",
  ready_for_manufacturing: "جاهز للتصنيع / التشطيب",
  in_manufacturing: "قيد التصنيع / التشطيب",
  pending_quality: "بانتظار فحص الجودة",
  completed: "مكتمل - جاهز للتسليم",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

/** Ordered list of stages shown in the visual progress stepper. */
export const STEPPER_STAGES: OrderStatus[] = [
  OrderStatus.in_design,
  OrderStatus.in_ctp,
  OrderStatus.in_cutting,
  OrderStatus.in_printing,
  OrderStatus.in_manufacturing,
  OrderStatus.pending_quality,
  OrderStatus.completed,
];

export function stageIsApplicable(stage: OrderStatus, routing: OrderRoutingInput): boolean {
  if (stage === OrderStatus.in_cutting) return routing.needsCutting;
  if (stage === OrderStatus.in_manufacturing) return requiresManufacturing(routing.productType);
  return true;
}

/**
 * Computes the next forward status for an order, automatically skipping
 * the cutting branch (if !needsCutting) and the manufacturing branch
 * (if the product type doesn't require it).
 */
export function getNextStatus(
  current: OrderStatus,
  routing: OrderRoutingInput
): OrderStatus | null {
  if (current === OrderStatus.in_ctp) {
    return routing.needsCutting ? OrderStatus.ready_for_cutting : OrderStatus.ready_for_printing;
  }
  if (current === OrderStatus.in_printing) {
    return requiresManufacturing(routing.productType)
      ? OrderStatus.ready_for_manufacturing
      : OrderStatus.pending_quality;
  }
  const idx = FORWARD_CHAIN.indexOf(current);
  if (idx === -1 || idx === FORWARD_CHAIN.length - 1) return null;
  return FORWARD_CHAIN[idx + 1];
}

export function canTransition(role: Role, from: OrderStatus, to: OrderStatus): boolean {
  if (role === Role.admin) return true;
  const rule = [...FORWARD_TRANSITIONS, ...RETURN_TRANSITIONS].find(
    (r) => r.from === from && r.to === to
  );
  if (!rule) return false;
  return rule.allowedRoles.includes(role);
}

export function getReturnOptions(from: OrderStatus): TransitionRule[] {
  return RETURN_TRANSITIONS.filter((r) => r.from === from);
}

/** Roles allowed to force-restart an order back to quality (Priority 2, #7). */
export const RESTART_ALLOWED_ROLES: Role[] = [Role.admin, Role.reception, Role.production_manager];

/** Roles allowed to see the visual progress stepper (Priority 2, #5). */
export const STEPPER_VISIBLE_ROLES: Role[] = [Role.admin, Role.reception, Role.production_manager];
