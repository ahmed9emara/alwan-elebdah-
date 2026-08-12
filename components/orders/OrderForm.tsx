"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";

const productTypes = [
  { value: "printed_sheet", label: "ورقة مطبوعة" },
  { value: "invoice_book", label: "فاتورة / نوتة" },
  { value: "flyer", label: "فلاير" },
  { value: "brochure_catalog", label: "بروشور / كتالوج" },
  { value: "carton_box", label: "كرتونة / علبة" },
  { value: "box_3d", label: "بوكس ثلاثي الأبعاد" },
  { value: "other", label: "أخرى" },
];

const standardSizes = ["A4", "A3", "A5", "50×70", "70×100", "25×35", "أخرى"];
const paperTypes = ["كوشيه 150جم", "كوشيه 200جم", "كوشيه 300جم", "كرتون 300جم", "كرتون 400جم", "دوبلكس", "أوفست", "أخرى"];
const specialFinishesOptions = ["طلاء UV", "لامينيشن لامع", "لامينيشن مطفي", "تذهيب", "تنفير", "أخرى"];
const closingTypes = ["عادي", "بقفل", "مغناطيسي", "لاصق", "أخرى"];

const orderSchema = z
  .object({
    clientName: z.string().min(1, "اسم العميل مطلوب"),
    clientPhone: z.string().min(1, "رقم الهاتف مطلوب"),
    clientCompany: z.string().optional(),
    deliveryAddress: z.string().optional(),
    internalReference: z.string().optional(),

    productType: z.string().min(1, "نوع المنتج مطلوب"),

    sizeType: z.enum(["standard", "custom"]),
    standardSize: z.string().optional(),
    customWidthCm: z.coerce.number().positive().optional(),
    customHeightCm: z.coerce.number().positive().optional(),
    is3d: z.boolean().default(false),
    depthCm: z.coerce.number().positive().optional(),
    closingType: z.string().optional(),

    colorsCount: z.string().min(1, "عدد الألوان مطلوب"),
    sides: z.enum(["one_side", "two_sides"]),
    paperType: z.string().min(1, "نوع الورق مطلوب"),
    printQuantity: z.coerce.number().int().positive("الكمية يجب أن تكون أكبر من صفر"),
    specialFinishes: z.array(z.string()).default([]),
    needsCutting: z.boolean().default(false),

    needsDiecut: z.boolean().default(false),
    diecutNotes: z.string().optional(),
    needsFolding: z.boolean().default(false),
    needsGluing: z.boolean().default(false),
    glueType: z.string().optional(),
    finalQuantity: z.coerce.number().int().positive().optional(),
    packagingNotes: z.string().optional(),

    clientNotes: z.string().optional(),
    deadline: z.string().min(1, "الموعد النهائي مطلوب"),
    priority: z.enum(["normal", "urgent", "vip"]).default("normal"),
  })
  .refine((d) => d.sizeType !== "standard" || !!d.standardSize, {
    message: "يرجى اختيار المقاس القياسي",
    path: ["standardSize"],
  })
  .refine((d) => d.sizeType !== "custom" || (!!d.customWidthCm && !!d.customHeightCm), {
    message: "يرجى إدخال العرض والارتفاع",
    path: ["customWidthCm"],
  })
  .refine((d) => !d.is3d || !!d.depthCm, {
    message: "يرجى إدخال العمق للمنتج ثلاثي الأبعاد",
    path: ["depthCm"],
  });

type OrderFormValues = z.infer<typeof orderSchema>;

const isCartonProduct = (productType: string) =>
  productType === "carton_box" || productType === "box_3d";

export default function OrderForm({
  onSubmit,
}: {
  onSubmit: (values: OrderFormValues) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      sizeType: "standard",
      sides: "one_side",
      priority: "normal",
      specialFinishes: [],
      is3d: false,
      needsCutting: false,
      needsDiecut: false,
      needsFolding: false,
      needsGluing: false,
    },
  });

  const productType = watch("productType");
  const sizeType = watch("sizeType");
  const is3d = watch("is3d");
  const colorsCount = watch("colorsCount");
  const sides = watch("sides");
  const showCartonSection = isCartonProduct(productType);

  const estimatedPlates =
    (parseInt((colorsCount || "0").replace("+", ""), 10) || 0) *
    (sides === "two_sides" ? 2 : 1);

  const submit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form dir="rtl" onSubmit={submit} className="space-y-8 text-right" lang="ar">
      {/* Section 1: Client Information */}
      <fieldset className="rounded-xl border border-neutral-200 p-5">
        <legend className="px-2 text-lg font-semibold">بيانات العميل</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="اسم العميل" error={errors.clientName?.message} required>
            <input {...register("clientName")} className="input" />
          </Field>
          <Field label="رقم الهاتف" error={errors.clientPhone?.message} required>
            <input {...register("clientPhone")} className="input" dir="ltr" />
          </Field>
          <Field label="اسم الشركة">
            <input {...register("clientCompany")} className="input" />
          </Field>
          <Field label="عنوان التسليم">
            <input {...register("deliveryAddress")} className="input" />
          </Field>
          <Field label="مرجع داخلي">
            <input {...register("internalReference")} className="input" />
          </Field>
        </div>
      </fieldset>

      {/* Section 2: Product Type */}
      <fieldset className="rounded-xl border border-neutral-200 p-5">
        <legend className="px-2 text-lg font-semibold">نوع المنتج</legend>
        <Field error={errors.productType?.message} required>
          <select {...register("productType")} className="input">
            <option value="">اختر نوع المنتج</option>
            {productTypes.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>

      {/* Section 3: Dimensions */}
      <fieldset className="rounded-xl border border-neutral-200 p-5">
        <legend className="px-2 text-lg font-semibold">المقاسات</legend>
        <div className="mb-4 flex gap-6">
          <label className="flex items-center gap-2">
            <input type="radio" value="standard" {...register("sizeType")} /> استاندرد
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" value="custom" {...register("sizeType")} /> مخصص
          </label>
        </div>

        {sizeType === "standard" && (
          <Field label="المقاس القياسي" error={errors.standardSize?.message}>
            <select {...register("standardSize")} className="input">
              <option value="">اختر المقاس</option>
              {standardSizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        )}

        {sizeType === "custom" && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="العرض (سم)" error={errors.customWidthCm?.message}>
              <input type="number" step="0.1" {...register("customWidthCm")} className="input" />
            </Field>
            <Field label="الارتفاع (سم)" error={errors.customHeightCm?.message}>
              <input type="number" step="0.1" {...register("customHeightCm")} className="input" />
            </Field>
          </div>
        )}

        <label className="mt-4 flex items-center gap-2">
          <input type="checkbox" {...register("is3d")} /> منتج ثلاثي الأبعاد
        </label>

        {is3d && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Field label="العمق (سم)" error={errors.depthCm?.message}>
              <input type="number" step="0.1" {...register("depthCm")} className="input" />
            </Field>
            <Field label="نوع الإغلاق">
              <select {...register("closingType")} className="input">
                <option value="">اختر نوع الإغلاق</option>
                {closingTypes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
      </fieldset>

      {/* Section 4: Print Specifications */}
      <fieldset className="rounded-xl border border-neutral-200 p-5">
        <legend className="px-2 text-lg font-semibold">مواصفات الطباعة</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="عدد الألوان" error={errors.colorsCount?.message} required>
            <select {...register("colorsCount")} className="input">
              <option value="">اختر عدد الألوان</option>
              <option value="1">1 لون</option>
              <option value="2">2 لون</option>
              <option value="4">4 ألوان</option>
              <option value="5">5 ألوان</option>
              <option value="6+">6 ألوان+</option>
            </select>
          </Field>
          <Field label="الأوجه">
            <select {...register("sides")} className="input">
              <option value="one_side">وجه واحد</option>
              <option value="two_sides">وجهين</option>
            </select>
          </Field>
          <Field label="نوع الورق" error={errors.paperType?.message} required>
            <select {...register("paperType")} className="input">
              <option value="">اختر نوع الورق</option>
              {paperTypes.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="كمية الطباعة" error={errors.printQuantity?.message} required>
            <input type="number" {...register("printQuantity")} className="input" />
          </Field>
        </div>

        <div className="mt-4">
          <span className="mb-2 block font-medium">إضافات خاصة</span>
          <Controller
            control={control}
            name="specialFinishes"
            render={({ field }) => (
              <div className="flex flex-wrap gap-4">
                {specialFinishesOptions.map((opt) => (
                  <label key={opt} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={field.value?.includes(opt)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...(field.value || []), opt]
                          : (field.value || []).filter((v) => v !== opt);
                        field.onChange(next);
                      }}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}
          />
        </div>

        <p className="mt-4 text-sm text-neutral-500">
          عدد الزنكات المقدر: <span className="font-semibold">{estimatedPlates}</span>
        </p>

        <label className="mt-4 flex items-center gap-2">
          <input type="checkbox" {...register("needsCutting")} /> يحتاج قص الورق قبل الطباعة (بعد الزنكات)
        </label>
      </fieldset>

      {/* Section 5: Carton / Manufacturing — conditional */}
      {showCartonSection && (
        <fieldset className="rounded-xl border border-neutral-200 p-5">
          <legend className="px-2 text-lg font-semibold">مواصفات التصنيع / الكرتون</legend>
          <div className="space-y-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" {...register("needsDiecut")} /> يحتاج قص (داي كت)
            </label>
            <Field label="ملاحظات القص">
              <input {...register("diecutNotes")} className="input" />
            </Field>
            <label className="flex items-center gap-2">
              <input type="checkbox" {...register("needsFolding")} /> يحتاج طي
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" {...register("needsGluing")} /> يحتاج لصق
            </label>
            <Field label="نوع الغراء">
              <input {...register("glueType")} className="input" />
            </Field>
            <Field label="الكمية النهائية" error={errors.finalQuantity?.message} required>
              <input type="number" {...register("finalQuantity")} className="input" />
            </Field>
            <Field label="ملاحظات التغليف">
              <textarea {...register("packagingNotes")} className="input" rows={3} />
            </Field>
          </div>
        </fieldset>
      )}

      {/* Section 6: Files & Meta */}
      <fieldset className="rounded-xl border border-neutral-200 p-5">
        <legend className="px-2 text-lg font-semibold">الملفات والموعد النهائي</legend>
        <Field label="ملاحظات العميل">
          <textarea {...register("clientNotes")} className="input" rows={3} />
        </Field>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="الموعد النهائي" error={errors.deadline?.message} required>
            <input type="datetime-local" {...register("deadline")} className="input" />
          </Field>
          <Field label="الأولوية">
            <select {...register("priority")} className="input">
              <option value="normal">عادي</option>
              <option value="urgent">مستعجل</option>
              <option value="vip">VIP</option>
            </select>
          </Field>
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-emerald-600 py-3 text-lg font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
      >
        {submitting ? "جارٍ الحفظ..." : "إنشاء الطلب"}
      </button>
    </form>
  );
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      {label && (
        <label className="mb-1 block font-medium">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      {children}
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}
