import { OrderRoutingInput, requiresManufacturing } from "@/lib/workflow/stateMachine";
import { OrderStatus } from "@prisma/client";

interface HistoryEntry {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actualDurationMin: number | null;
}

interface Milestone {
  key: string;
  label: string;
  statuses: OrderStatus[];
}

const ALL_MILESTONES: Milestone[] = [
  { key: "design", label: "التصميم", statuses: [OrderStatus.new, OrderStatus.in_design] },
  { key: "ctp", label: "الزنكات", statuses: [OrderStatus.ready_for_ctp, OrderStatus.in_ctp] },
  { key: "cutting", label: "قص الورق", statuses: [OrderStatus.ready_for_cutting, OrderStatus.in_cutting] },
  { key: "printing", label: "الطباعة", statuses: [OrderStatus.ready_for_printing, OrderStatus.in_printing] },
  { key: "manufacturing", label: "التصنيع / التشطيب", statuses: [OrderStatus.ready_for_manufacturing, OrderStatus.in_manufacturing] },
  { key: "quality", label: "فحص الجودة", statuses: [OrderStatus.pending_quality] },
  { key: "completed", label: "مكتمل", statuses: [OrderStatus.completed, OrderStatus.delivered] },
];

export default function OrderProgressStepper({
  currentStatus,
  routing,
  history,
}: {
  currentStatus: OrderStatus;
  routing: OrderRoutingInput;
  history: HistoryEntry[];
}) {
  const milestones = ALL_MILESTONES.filter((m) => {
    if (m.key === "cutting") return routing.needsCutting;
    if (m.key === "manufacturing") return requiresManufacturing(routing.productType);
    return true;
  });

  const currentIdx = milestones.findIndex((m) => m.statuses.includes(currentStatus));

  function durationForMilestone(m: Milestone): number {
    return history
      .filter((h) => m.statuses.includes(h.fromStatus as OrderStatus))
      .reduce((sum, h) => sum + (h.actualDurationMin ?? 0), 0);
  }

  return (
    <div dir="rtl" className="mb-6 overflow-x-auto rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold text-neutral-500">مسار سير العمل</h2>
      <div className="flex min-w-[600px] items-start">
        {milestones.map((m, idx) => {
          const isDone = currentIdx === -1 ? true : idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const duration = isDone || isCurrent ? durationForMilestone(m) : 0;

          return (
            <div key={m.key} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    isCurrent
                      ? "bg-amber-500 text-white"
                      : isDone
                        ? "bg-emerald-500 text-white"
                        : "bg-neutral-200 text-neutral-500"
                  }`}
                >
                  {isDone ? "✓" : idx + 1}
                </div>
                {idx < milestones.length - 1 && (
                  <div className={`h-1 flex-1 ${isDone ? "bg-emerald-400" : "bg-neutral-200"}`} />
                )}
              </div>
              <p className="mt-2 text-center text-xs font-medium">{m.label}</p>
              {duration > 0 && <p className="text-center text-xs text-neutral-400">{duration} دقيقة</p>}
              {isCurrent && <p className="text-center text-xs font-semibold text-amber-600">جارٍ الآن</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
