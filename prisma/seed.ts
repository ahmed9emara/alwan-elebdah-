import { PrismaClient, Role, ProductType, SizeType, Sides, Priority } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 10);

  const branch = await prisma.branch.upsert({
    where: { code: "MAIN" },
    update: {},
    create: { name: "الفرع الرئيسي", code: "MAIN" },
  });

  const usersToCreate: { name: string; email: string; role: Role }[] = [
    { name: "مدير النظام", email: "admin@printshop.local", role: Role.admin },
    { name: "موظف الاستقبال", email: "reception@printshop.local", role: Role.reception },
    { name: "المصمم", email: "designer@printshop.local", role: Role.designer },
    { name: "فني الزنكات", email: "ctp@printshop.local", role: Role.ctp },
    { name: "عامل المطبعة", email: "printer@printshop.local", role: Role.printer },
    { name: "عامل التقطيع", email: "cutter@printshop.local", role: Role.cutter },
    { name: "مصنع الكرتون", email: "carton@printshop.local", role: Role.carton_factory },
    { name: "مراقب الجودة", email: "quality@printshop.local", role: Role.quality },
    { name: "مدير الإنتاج", email: "manager@printshop.local", role: Role.production_manager },
  ];

  const users: Record<string, string> = {};
  for (const u of usersToCreate) {
    const created = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash, branchId: branch.id },
    });
    users[u.role] = created.id;
  }

  // Sample order 1: simple paper/invoice order (no manufacturing branch)
  await prisma.order.create({
    data: {
      orderNumber: "ORD-0001",
      branchId: branch.id,
      clientName: "شركة الأمل التجارية",
      clientPhone: "0791234567",
      clientCompany: "الأمل التجارية",
      productType: ProductType.invoice_book,
      sizeType: SizeType.standard,
      standardSize: "A4",
      colorsCount: "2",
      sides: Sides.two_sides,
      paperType: "أوفست",
      printQuantity: 5000,
      specialFinishes: [],
      estimatedPlates: 4,
      needsCutting: true, // demonstrates the paper-cutting stage (before printing)
      clientNotes: "الرجاء الطباعة بنفس الألوان السابقة",
      deadline: new Date(Date.now() + 3 * 24 * 3600 * 1000),
      priority: Priority.normal,
      createdById: users[Role.reception],
    },
  });

  // Sample order 2: carton box order (full manufacturing branch)
  await prisma.order.create({
    data: {
      orderNumber: "ORD-0002",
      branchId: branch.id,
      clientName: "مصنع الفا للمواد الغذائية",
      clientPhone: "0797654321",
      productType: ProductType.carton_box,
      sizeType: SizeType.custom,
      customWidthCm: 20,
      customHeightCm: 15,
      is3d: true,
      depthCm: 8,
      closingType: "لاصق",
      colorsCount: "4",
      sides: Sides.one_side,
      paperType: "كرتون 400جم",
      printQuantity: 10000,
      specialFinishes: ["لامينيشن لامع"],
      estimatedPlates: 4,
      needsCutting: false, // pre-cut carton sheet, no separate cutting stage needed
      needsDiecut: true,
      needsFolding: true,
      needsGluing: true,
      glueType: "غراء ساخن",
      finalQuantity: 10000,
      deadline: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      priority: Priority.urgent,
      createdById: users[Role.reception],
    },
  });

  console.log("✅ Seed complete. Default password for all users: Password123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
