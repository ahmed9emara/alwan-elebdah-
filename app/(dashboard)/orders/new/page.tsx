"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import OrderForm from "@/components/orders/OrderForm";

export default function NewOrderPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: any) {
    setError(null);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "حدث خطأ أثناء إنشاء الطلب");
      return;
    }
    const { order } = await res.json();
    router.push(`/orders/${order.id}`);
  }

  return (
    <div dir="rtl" lang="ar" className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-2xl font-bold">إنشاء طلب جديد</h1>
      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-red-700">
          {error}
        </div>
      )}
      <OrderForm onSubmit={handleSubmit} />
    </div>
  );
}
