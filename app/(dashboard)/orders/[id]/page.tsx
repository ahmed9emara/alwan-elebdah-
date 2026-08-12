import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import {
  redactOrderForRole,
  canViewProgressStepper,
  canRestartOrder,
  canViewFile,
} from "@/lib/permissions";
import { ARABIC_STATUS_LABEL, getReturnOptions, getNextStatus } from "@/lib/workflow/stateMachine";
import OrderActions from "@/components/orders/OrderActions";
import FileUpload from "@/components/orders/FileUpload";
import OrderProgressStepper from "@/components/orders/OrderProgressStepper";
import DesignerDecision from "@/components/orders/DesignerDecision";
import RestartOrder from "@/components/orders/RestartOrder";

const PRIORITY_LABEL: Record<string, string> = {
  normal: "عادي",
  urgent: "مستعجل",
  vip: "VIP",
};

const FILE_VISIBILITY_LABEL: Record<string, string> = {
  everyone: "مرئي للجميع",
  roles: "مقيد بأدوار محددة",
  user: "مقيد بمستخدم محدد",
};

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession({} as any);
  if (!session) redirect("/login");

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      stageHistory: {
        include: { user: { select: { name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
      files: { include: { uploadedBy: { select: { name: true } } } },
    },
  });

  if (!order || order.deletedAt) notFound();

  const visible = redactOrderForRole(order, session.role);
  const routing = { productType: order.productType, needsCutting: order.needsCutting };
  const returnOptions = getReturnOptions(order.status);
  const nextStatus = getNextStatus(order.status, routing);

  // "new" status is handled exclusively via the Accept/Reject widget, not the generic advance button
  const isPendingDesignerDecision = order.status === "new";
  const canAdvance = !!nextStatus && !isPendingDesignerDecision;

  const visibleFiles = order.files.filter((f) =>
    canViewFile(session.role, session.userId, {
      uploadedById: f.uploadedById,
      visibility: f.visibility,
      visibleRoles: f.visibleRoles,
      visibleUserId: f.visibleUserId,
    })
  );

  // Participants for the file-visibility "specific user" picker (kept simple: any active user)
  const participants = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  const stageMinutesElapsed = Math.round(
    (Date.now() - order.currentStageEnteredAt.getTime()) / 60000
  );
  const delayed =
    order.expectedDurationMin != null && stageMinutesElapsed > order.expectedDurationMin;

  return (
    <div dir="rtl" lang="ar" className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
          <p className="text-neutral-500">{visible.clientName}</p>
        </div>
        <div className="text-left">
          <span className="rounded-full bg-emerald-100 px-4 py-1.5 font-semibold text-emerald-800">
            {ARABIC_STATUS_LABEL[order.status]}
          </span>
          {order.priority !== "normal" && (
            <p className="mt-1 text-sm font-semibold text-amber-600">
              {PRIORITY_LABEL[order.priority]}
            </p>
          )}
        </div>
      </div>

      {order.restartCount > 0 && (
        <div className="mb-6 rounded-xl border border-orange-300 bg-orange-50 p-4 text-orange-800">
          🔄 تمت إعادة تشغيل هذا الطلب {order.restartCount} مرة/مرات.
          {order.restartReason && <p className="mt-1 text-sm">آخر سبب: {order.restartReason}</p>}
        </div>
      )}

      {order.designRejectReason && (
        <div className="mb-6 rounded-xl border border-red-300 bg-red-50 p-4 text-red-700">
          تم رفض هذا الطلب سابقاً من التصميم. السبب: {order.designRejectReason}
        </div>
      )}

      {delayed && (
        <div className="mb-6 rounded-xl border border-red-300 bg-red-50 p-4 text-red-700">
          ⚠ هذا الطلب متأخر عن الوقت المتوقع للمرحلة الحالية (
          {stageMinutesElapsed} دقيقة من أصل {order.expectedDurationMin} دقيقة متوقعة)
        </div>
      )}

      {/* Priority 2 #5: visual progress stepper — gated to admin/reception/production_manager */}
      {canViewProgressStepper(session.role) && (
        <OrderProgressStepper
          currentStatus={order.status}
          routing={routing}
          history={order.stageHistory}
        />
      )}

      {/* Priority 1 #4: designer explicit accept/reject on a new order */}
      {isPendingDesignerDecision && session.role === "designer" && (
        <DesignerDecision orderId={order.id} />
      )}

      {/* Info grid */}
      <div className="mb-6 grid grid-cols-1 gap-4 rounded-xl border border-neutral-200 bg-white p-5 sm:grid-cols-2">
        {visible.clientPhone && <Info label="رقم الهاتف" value={visible.clientPhone} />}
        {visible.deliveryAddress && <Info label="عنوان التسليم" value={visible.deliveryAddress} />}
        <Info label="نوع المنتج" value={order.productType} />
        <Info label="عدد الألوان" value={order.colorsCount} />
        <Info label="الأوجه" value={order.sides === "two_sides" ? "وجهين" : "وجه واحد"} />
        <Info label="نوع الورق" value={order.paperType} />
        <Info label="كمية الطباعة" value={String(order.printQuantity)} />
        <Info label="عدد الزنكات" value={String(order.estimatedPlates)} />
        <Info label="يحتاج قص ورق قبل الطباعة" value={order.needsCutting ? "نعم" : "لا"} />
        <Info label="الموعد النهائي" value={new Date(order.deadline).toLocaleString("ar-EG")} />
        {visible.price != null && <Info label="السعر" value={`${visible.price} د.أ`} />}
        {order.clientNotes && <Info label="ملاحظات العميل" value={order.clientNotes} full />}
      </div>

      {/* Files */}
      <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">الملفات</h2>
          <FileUpload orderId={order.id} participants={participants} />
        </div>
        {visibleFiles.length === 0 ? (
          <p className="text-sm text-neutral-500">لا توجد ملفات مرئية لك في هذا الطلب</p>
        ) : (
          <ul className="space-y-2">
            {visibleFiles.map((f) => (
              <li key={f.id} className="flex items-center justify-between text-sm">
                <div>
                  <a
                    href={`/api/orders/${order.id}/files/${f.id}`}
                    className="font-medium text-emerald-700 hover:underline"
                  >
                    ⬇ {f.fileName}
                  </a>
                  <p className="text-xs text-neutral-400">
                    رفعه {f.uploadedBy?.name} · {FILE_VISIBILITY_LABEL[f.visibility]}
                  </p>
                </div>
                <span className="text-neutral-400">{f.fileType}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-6">
        <OrderActions
          orderId={order.id}
          currentStatus={order.status}
          role={session.role}
          canAdvance={canAdvance}
          returnOptions={returnOptions.map((r) => ({ to: r.to, label: ARABIC_STATUS_LABEL[r.to] }))}
        />

        {canRestartOrder(session.role) && <RestartOrder orderId={order.id} />}
      </div>

      {/* Timeline */}
      <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold">سجل النشاط</h2>
        <ol className="space-y-4 border-r-2 border-neutral-200 pr-4">
          {order.stageHistory.map((h) => (
            <li key={h.id} className="relative">
              <span
                className={`absolute -right-[21px] top-1 h-3 w-3 rounded-full ${
                  h.isRestart ? "bg-orange-500" : h.isReturn ? "bg-red-400" : "bg-emerald-500"
                }`}
              />
              <p className="font-medium">
                {h.fromStatus ? ARABIC_STATUS_LABEL[h.fromStatus] : "إنشاء الطلب"} ←{" "}
                {ARABIC_STATUS_LABEL[h.toStatus]}
                {h.isRestart && <span className="mr-2 text-orange-600">(إعادة تشغيل)</span>}
                {h.isReturn && !h.isRestart && <span className="mr-2 text-red-600">(إرجاع)</span>}
              </p>
              <p className="text-sm text-neutral-500">
                {h.user.name} · {new Date(h.createdAt).toLocaleString("ar-EG")}
                {h.actualDurationMin != null && ` · استغرقت ${h.actualDurationMin} دقيقة`}
                {h.isDelayed && <span className="text-red-600"> · متأخر</span>}
              </p>
              {h.note && <p className="mt-1 text-sm">{h.note}</p>}
              {h.returnReason && (
                <p className="mt-1 text-sm text-red-600">السبب: {h.returnReason}</p>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Info({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
