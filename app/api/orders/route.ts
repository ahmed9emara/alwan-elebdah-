import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";
import { canCreateOrder, ROLE_TASK_STATUSES, ROLES_WITH_FULL_VISIBILITY, redactOrderForRole } from "@/lib/permissions";
import { estimateStageDurationMinutes } from "@/lib/workflow/timeEstimation";
import { OrderStatus } from "@prisma/client";

const createOrderSchema = z.object({
  clientName: z.string().min(1),
  clientPhone: z.string().min(1),
  clientCompany: z.string().optional(),
  deliveryAddress: z.string().optional(),
  internalReference: z.string().optional(),
  productType: z.string().min(1),
  sizeType: z.enum(["standard", "custom"]),
  standardSize: z.string().optional(),
  customWidthCm: z.number().optional(),
  customHeightCm: z.number().optional(),
  is3d: z.boolean().default(false),
  depthCm: z.number().optional(),
  closingType: z.string().optional(),
  colorsCount: z.string().min(1),
  sides: z.enum(["one_side", "two_sides"]),
  paperType: z.string().min(1),
  printQuantity: z.number().int().positive(),
  specialFinishes: z.array(z.string()).default([]),
  needsCutting: z.boolean().default(false),
  needsDiecut: z.boolean().default(false),
  diecutNotes: z.string().optional(),
  needsFolding: z.boolean().default(false),
  needsGluing: z.boolean().default(false),
  glueType: z.string().optional(),
  finalQuantity: z.number().int().optional(),
  packagingNotes: z.string().optional(),
  clientNotes: z.string().optional(),
  deadline: z.string().min(1),
  priority: z.enum(["normal", "urgent", "vip"]).default("normal"),
  price: z.number().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(req);
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const fullVisibility = ROLES_WITH_FULL_VISIBILITY.includes(session.role);
  const myStatuses = ROLE_TASK_STATUSES[session.role] ?? [];

  const orders = await prisma.order.findMany({
    where: fullVisibility
      ? { deletedAt: null }
      : { status: { in: myStatuses as any }, deletedAt: null },
    orderBy: [{ priority: "desc" }, { deadline: "asc" }],
    take: 200,
  });

  const redacted = orders.map((o) => redactOrderForRole(o, session.role));
  return NextResponse.json({ orders: redacted });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(req);
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  if (!canCreateOrder(session.role)) {
    return NextResponse.json({ error: "ليس لديك صلاحية لإنشاء طلب" }, { status: 403 });
  }

  const parsed = createOrderSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "بيانات غير صحيحة", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const colorsNum = parseInt(data.colorsCount.replace("+", ""), 10) || 0;
  const estimatedPlates = colorsNum * (data.sides === "two_sides" ? 2 : 1);

  // Sequential, branch-friendly order number (simple counter for foundation version;
  // see SCALABILITY_PLAN.md for branch-prefixing at multi-branch scale)
  const count = await prisma.order.count();
  const orderNumber = `ORD-${String(count + 1).padStart(4, "0")}`;

  const expectedDurationMin = estimateStageDurationMinutes({
    status: OrderStatus.new,
    isComplex: data.productType === "carton_box" || data.productType === "box_3d",
    numberOfPlates: estimatedPlates,
    quantity: data.printQuantity,
    machineSpeedSheetsPerHour: 1000,
    priority: data.priority as any,
  });

  const order = await prisma.order.create({
    data: {
      orderNumber,
      branchId: session.branchId ?? undefined,
      clientName: data.clientName,
      clientPhone: data.clientPhone,
      clientCompany: data.clientCompany,
      deliveryAddress: data.deliveryAddress,
      internalReference: data.internalReference,
      productType: data.productType as any,
      sizeType: data.sizeType as any,
      standardSize: data.standardSize,
      customWidthCm: data.customWidthCm,
      customHeightCm: data.customHeightCm,
      is3d: data.is3d,
      depthCm: data.depthCm,
      closingType: data.closingType,
      needsCutting: data.needsCutting,
      colorsCount: data.colorsCount,
      sides: data.sides as any,
      paperType: data.paperType,
      printQuantity: data.printQuantity,
      specialFinishes: data.specialFinishes,
      estimatedPlates,
      needsDiecut: data.needsDiecut,
      diecutNotes: data.diecutNotes,
      needsFolding: data.needsFolding,
      needsGluing: data.needsGluing,
      glueType: data.glueType,
      finalQuantity: data.finalQuantity,
      packagingNotes: data.packagingNotes,
      clientNotes: data.clientNotes,
      deadline: new Date(data.deadline),
      priority: data.priority as any,
      price: data.price,
      status: OrderStatus.new,
      expectedDurationMin,
      createdById: session.userId,
    },
  });

  await prisma.orderStageHistory.create({
    data: {
      orderId: order.id,
      fromStatus: null,
      toStatus: OrderStatus.new,
      userId: session.userId,
      note: "تم إنشاء الطلب",
      expectedDurationMin,
      actualDurationMin: 0,
      isDelayed: false,
    },
  });

  return NextResponse.json({ order }, { status: 201 });
}
