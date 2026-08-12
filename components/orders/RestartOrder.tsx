"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RestartOrder({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason.trim()) {
      setError("سبب إعادة التشغيل مطلوب");
      return;
    }
    if (!confirm("هل أنت متأكد من إعادة تشغيل هذا الطلب؟ سيتم إرجاعه إلى مرحلة فحص الجودة.")) {
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/orders/${orderId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restart", returnReason: reason }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "حدث خطأ");
      return;
    }
    setOpen(false);
    setReason("");
    router.refresh();
  }

  return (
    <div dir="rtl" className="rounded-xl border border-orange-300 bg-orange-50 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-orange-800">إعادة تشغيل / إعادة طباعة</h2>
          <p className="text-sm text-orange-700">
            يعيد الطلب إلى مرحلة فحص الجودة مع توضيح السبب.
          </p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-orange-400 px-4 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-100"
        >
          إعادة تشغيل الطلب
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <textarea
            placeholder="سبب إعادة التشغيل (مطلوب)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="input"
            rows={2}
          />
          <button
            onClick={submit}
            disabled={loading}
            className="rounded-lg bg-orange-600 px-5 py-2.5 font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {loading ? "جارٍ التنفيذ..." : "تأكيد إعادة التشغيل"}
          </button>
        </div>
      )}
    </div>
  );
}
