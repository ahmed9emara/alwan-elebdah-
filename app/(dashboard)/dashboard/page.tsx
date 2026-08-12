import { prisma } from "@/lib/prisma";
import { ARABIC_STATUS_LABEL } from "@/lib/workflow/stateMachine";
import { ROLE_TASK_STATUSES, ROLES_WITH_FULL_VISIBILITY, COMPLETED_STATUSES } from "@/lib/permissions";
import { getServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

const STATUS_COLOR: Record<string, string> = {
  new: "bg-amber-100 text-amber-800 border-amber-300",
  in_design: "bg-amber-100 text-amber-800 border-amber-300",
  ready_for_ctp: "bg-sky-100 text-sky-800 border-sky-300",
  in_ctp: "bg-sky-100 text-sky-800 border-sky-300",
  ready_for_cutting: "bg-cyan-100 text-cyan-800 border-cyan-300",
  in_cutting: "bg-cyan-100 text-cyan-800 border-cyan-300",
  ready_for_printing: "bg-violet-100 text-violet-800 border-violet-300",
  in_printing: "bg-violet-100 text-violet-800 border-violet-300",
  ready_for_manufacturing: "bg-orange-100 text-orange-800 border-orange-300",
  in_manufacturing: "bg-orange-100 text-orange-800 border-orange-300",
  pending_quality: "bg-rose-100 text-rose-800 border-rose-300",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-300",
  delivered: "bg-neutral-100 text-neutral-600 border-neutral-300",
};

export default async function DashboardPage() {
  const session = await getServerSession({} as any);
  if (!session) redirect("/login");

  const fullVisibility = ROLES_WITH_FULL_VISIBILITY.includes(session.role);
  const myStatuses = ROLE_TASK_STATUSES[session.role] ?? [];

  const orders = await prisma.order.findMany({
    where: fullVisibility
      ? { deletedAt: null }
      : { status: { in: [...myStatuses, ...COMPLETED_STATUSES] as any }, deletedAt: null },
    orderBy: [{ priority: "desc" }, { deadline: "asc" }],
    take: 200,
  });

  const now = Date.now();
  const active = orders.filter((o) => !COMPLETED_STATUSES.includes(o.status));
  const done = orders.filter((o) => COMPLETED_STATUSES.includes(o.status));

  return (
    <div dir="rtl" lang="ar" className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-2xl font-bold">مهامي</h1>

      {active.length === 0 && (
        <div className="mb-8 rounded-xl border border-dashed border-neutral-300 p-10 text-center text-neutral-500">
          لا توجد طلبات نشطة بانتظارك حالياً
        </div>
      )}

      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {active.map((order) => {
          const stageMinutesElapsed = Math.round(
            (now - order.currentStageEnteredAt.getTime()) / 60000
          );
          const delayed =
            order.expectedDurationMin != null && stageMinutesElapsed > order.expectedDurationMin;

          return (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className={`rounded-xl border p-4 transition hover:shadow-md ${STATUS_COLOR[order.status] ?? "bg-neutral-100 border-neutral-300"}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-sm">{order.orderNumber}</span>
                {order.priority !== "normal" && (
                  <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-semibold">
                    {order.priority === "vip" ? "VIP" : "مستعجل"}
                  </span>
                )}
              </div>
              <p className="mb-1 font-semibold">{order.clientName}</p>
              <p className="text-sm">{ARABIC_STATUS_LABEL[order.status]}</p>
              {delayed && (
                <p className="mt-2 text-sm font-semibold text-red-600">⚠ متأخر عن الوقت المتوقع</p>
              )}
            </Link>
          );
        })}
      </div>

      {done.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-neutral-500">مكتملة</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {done.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-sm transition hover:shadow-sm"
              >
                <div>
                  <span className="font-mono text-neutral-500">{order.orderNumber}</span>
                  <span className="mx-2">·</span>
                  <span>{order.clientName}</span>
                </div>
                <span className="flex items-center gap-1 font-semibold text-emerald-700">
                  ✓ {ARABIC_STATUS_LABEL[order.status]}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
