import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";
import {
  canTransition,
  getNextStatus,
  getReturnOptions,
  RESTART_ALLOWED_ROLES,
} from "@/lib/workflow/stateMachine";
import { canDecideOnNewOrder, canRestartOrder } from "@/lib/permissions";
import {
  estimateStageDurationMinutes,
  isDelayed,
} from "@/lib/workflow/timeEstimation";
import { OrderStatus, Role } from "@prisma/client";

const bodySchema = z.object({
  action: z.enum(["advance", "return", "reject", "restart"]),
  toStatus: z.string().optional(), // required for "return"
  note: z.string().optional(),
  returnReason: z.string().optional(), // required for "return", "reject", "restart"
  printedQuantity: z.number().int().nonnegative().optional(),
  wasteQuantity: z.number().int().nonnegative().optional(),
  finalQuantity: z.number().int().nonnegative().optional(),
  qualityDecision: z.enum(["approved", "rejected"]).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(req);
  if (!session) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "بيانات غير صحيحة", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const body = parsed.data;

  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order || order.deletedAt) {
    return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  }

  const now = new Date();
  const actualDurationMin = Math.round(
    (now.getTime() - order.currentStageEnteredAt.getTime()) / 60000
  );
  const delayed = order.expectedDurationMin
    ? isDelayed(order.expectedDurationMin, actualDurationMin)
    : false;

  // ---- Special action: designer rejects a new order at intake ----
  if (body.action === "reject") {
    if (order.status !== OrderStatus.new) {
      return NextResponse.json(
        { error: "لا يمكن رفض الطلب إلا في مرحلة الانتظار الأولية" },
        { status: 400 }
      );
    }
    if (!canDecideOnNewOrder(session.role)) {
      return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 });
    }
    if (!body.returnReason || body.returnReason.trim().length === 0) {
      return NextResponse.json({ error: "سبب الرفض مطلوب" }, { status: 400 });
    }

    const [updatedOrder] = await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: { designRejectReason: body.returnReason },
      }),
      prisma.orderStageHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: order.status, // stays at "new" — reception must reassign/fix
          userId: session.userId,
          note: body.note,
          isReturn: true,
          returnReason: body.returnReason,
          actualDurationMin,
          isDelayed: delayed,
        },
      }),
    ]);

    return NextResponse.json({ order: updatedOrder });
  }

  // ---- Special action: force-restart back to quality ----
  if (body.action === "restart") {
    if (!canRestartOrder(session.role)) {
      return NextResponse.json({ error: "ليس لديك صلاحية لإعادة تشغيل الطلب" }, { status: 403 });
    }
    if (!body.returnReason || body.returnReason.trim().length === 0) {
      return NextResponse.json({ error: "سبب إعادة التشغيل مطلوب" }, { status: 400 });
    }

    const [updatedOrder] = await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.pending_quality,
          currentStageEnteredAt: now,
          restartReason: body.returnReason,
          restartCount: { increment: 1 },
        },
      }),
      prisma.orderStageHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: OrderStatus.pending_quality,
          userId: session.userId,
          note: body.note,
          isReturn: true,
          isRestart: true,
          returnReason: body.returnReason,
          actualDurationMin,
          isDelayed: delayed,
        },
      }),
    ]);

    return NextResponse.json({ order: updatedOrder });
  }

  // ---- Normal advance / return ----
  const routing = { productType: order.productType, needsCutting: order.needsCutting };

  let toStatus: OrderStatus | null = null;
  if (body.action === "advance") {
    toStatus = getNextStatus(order.status, routing);
    if (!toStatus) {
      return NextResponse.json(
        { error: "لا يمكن نقل الطلب إلى مرحلة تالية من هذه الحالة" },
        { status: 400 }
      );
    }
  } else {
    if (!body.toStatus) {
      return NextResponse.json(
        { error: "يجب تحديد المرحلة المطلوب الإرجاع إليها" },
        { status: 400 }
      );
    }
    if (!body.returnReason || body.returnReason.trim().length === 0) {
      return NextResponse.json({ error: "سبب الإرجاع مطلوب" }, { status: 400 });
    }
    toStatus = body.toStatus as OrderStatus;
    const valid = getReturnOptions(order.status).some((r) => r.to === toStatus);
    if (!valid) {
      return NextResponse.json(
        { error: "مسار الإرجاع غير صالح لهذه الحالة" },
        { status: 400 }
      );
    }
  }

  if (session.role !== Role.admin && !canTransition(session.role, order.status, toStatus)) {
    return NextResponse.json({ error: "ليس لديك صلاحية لتنفيذ هذا الإجراء" }, { status: 403 });
  }

  const newExpected = estimateStageDurationMinutes({
    status: toStatus,
    isComplex: order.productType === "carton_box" || order.productType === "box_3d",
    numberOfPlates: order.estimatedPlates,
    quantity: order.printQuantity,
    machineSpeedSheetsPerHour: 1000,
    priority: order.priority,
  });

  const [updatedOrder] = await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        status: toStatus,
        currentStageEnteredAt: now,
        expectedDurationMin: newExpected,
        printedQuantity: body.printedQuantity ?? order.printedQuantity,
        wasteQuantity: body.wasteQuantity ?? order.wasteQuantity,
        finalQuantity: body.finalQuantity ?? order.finalQuantity,
        qualityDecision: (body.qualityDecision as any) ?? order.qualityDecision,
      },
    }),
    prisma.orderStageHistory.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus,
        userId: session.userId,
        note: body.note,
        isReturn: body.action === "return",
        returnReason: body.returnReason,
        expectedDurationMin: order.expectedDurationMin ?? undefined,
        actualDurationMin,
        isDelayed: delayed,
      },
    }),
  ]);

  return NextResponse.json({ order: updatedOrder });
}
