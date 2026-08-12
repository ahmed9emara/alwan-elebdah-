"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DesignerDecision({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/orders/${orderId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "advance" }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "حدث خطأ");
      return;
    }
    router.refresh();
  }

  async function reject() {
    if (!reason.trim()) {
      setError("سبب الرفض مطلوب");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/orders/${orderId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", returnReason: reason }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "حدث خطأ");
      return;
    }
    setShowReject(false);
    router.refresh();
  }

  return (
    <div dir="rtl" className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-5">
      <h2 className="mb-3 text-lg font-semibold">طلب جديد بانتظار قرارك</h2>
      <p className="mb-4 text-sm text-neutral-600">
        يرجى قبول الطلب لبدء التصميم، أو رفضه مع توضيح السبب حتى يتمكن الاستقبال من المتابعة.
      </p>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={accept}
          disabled={loading}
          className="rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          ✓ قبول الطلب
        </button>
        <button
          onClick={() => setShowReject((v) => !v)}
          className="rounded-lg border border-red-300 px-5 py-2.5 font-semibold text-red-600 hover:bg-red-50"
        >
          ✕ رفض الطلب
        </button>
      </div>

      {showReject && (
        <div className="mt-4 space-y-3 rounded-lg bg-white p-4">
          <textarea
            placeholder="سبب الرفض (مطلوب)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="input"
            rows={2}
          />
          <button
            onClick={reject}
            disabled={loading}
            className="rounded-lg bg-red-600 px-5 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            تأكيد الرفض
          </button>
        </div>
      )}
    </div>
  );
}
