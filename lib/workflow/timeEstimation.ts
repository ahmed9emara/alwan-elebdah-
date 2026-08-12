/**
 * Time estimation service.
 *
 * Base rules are intentionally simple constants here but are read through
 * `getSetting()` stubs so they can be moved into the `Setting` table and
 * edited from the admin panel without a code change (future work).
 */

import { OrderStatus, Priority } from "@prisma/client";

export interface EstimationInput {
  status: OrderStatus;
  isComplex: boolean; // e.g. box/carton design vs simple flyer
  numberOfPlates: number;
  quantity: number;
  machineSpeedSheetsPerHour: number; // configurable per press
  priority: Priority;
}

const SAFETY_BUFFER = 1.2; // +20%

function priorityMultiplier(priority: Priority): number {
  switch (priority) {
    case Priority.urgent:
      return 0.75; // ~25% faster expected time
    case Priority.vip:
      return 0.6; // ~40% faster expected time
    default:
      return 1;
  }
}

/** Returns expected duration in minutes for the CURRENT stage of an order. */
export function estimateStageDurationMinutes(input: EstimationInput): number {
  let hours = 0;

  switch (input.status) {
    case OrderStatus.new:
    case OrderStatus.in_design:
      hours = input.isComplex ? 4 : 1.5;
      break;
    case OrderStatus.ready_for_ctp:
    case OrderStatus.in_ctp:
      hours = 0.5 * Math.max(input.numberOfPlates, 1);
      break;
    case OrderStatus.ready_for_cutting:
    case OrderStatus.in_cutting:
      hours = 0.5 + input.quantity / 2000;
      break;
    case OrderStatus.ready_for_printing:
    case OrderStatus.in_printing:
      hours = 1 + input.quantity / Math.max(input.machineSpeedSheetsPerHour, 1);
      break;
    case OrderStatus.ready_for_manufacturing:
    case OrderStatus.in_manufacturing:
      // die-cut + folding/gluing combined estimate; can be split per sub-stage later
      hours = 1 + input.quantity / 800 + (1.5 + input.quantity / 600);
      break;
    case OrderStatus.pending_quality:
      hours = 0.75;
      break;
    default:
      hours = 0.5;
  }

  hours *= SAFETY_BUFFER;
  hours *= priorityMultiplier(input.priority);

  return Math.round(hours * 60);
}

export function isDelayed(expectedMinutes: number, actualMinutes: number): boolean {
  return actualMinutes > expectedMinutes;
}
