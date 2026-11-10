"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { MapView, Pin } from "@/components/map-view";
import { RequestModal } from "@/components/request-modal";
import { CustomerPage } from "@/components/shell";
import { cx, PageFade, Skeleton } from "@/components/ui";
import { WorkerCard, WorkerCardData } from "@/components/worker-card";
import { TRADES, useApi } from "@/lib/api";
import { T, useLang } from "@/lib/i18n";

function Workers() {
  const sp = useSearchParams();
  const router = useRouter();
  const trade = sp.get("trade") ?? "";
  const problem = sp.get("q") ?? undefined;
  const [sort, setSort] = useState("best");
  const { t } = useLang();
  const [onlyFree, setOnlyFree] = useState(false);
  const [req, setReq] = useState<WorkerCardData | null>(null);
  const qs = new URLSearchParams({ radiusKm: "50", sort, ...(trade ? { trade } : {}), ...(onlyFree ? { availableNow: "true" } : {}) });
  const { data } = useApi<{ workers: WorkerCardData[]; center: { lat: number; lng: number } }>(`/workers/search?${qs}`, 5000);
  const list = data?.workers ?? [];

  return (
    <PageFade>
      <h1 className="text-2xl font-extrabold md:text-[34px]">
        {trade ? TRADES.find((t) => t.key === trade)?.en + "s" : "All workers"} near you
      </h1>
      <p className="mt-1 text-ink-2"><T en="Only verified workers. Busy workers are greyed out until they finish their current job." ur="صرف تصدیق شدہ کاریگر۔ مصروف کاریگر کام ختم ہونے تک ہلکے دکھائی دیتے ہیں۔" /></p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button onClick={() => router.push("/c/workers")} className={cx("rounded-full border px-4 py-2 text-sm font-semibold", !trade ? "border-brand bg-brand text-white" : "border-line bg-white")}><T en="All" ur="سب" /></button>
        {TRADES.map((t) => (
          <button key={t.key} onClick={() => router.push(`/c/workers?trade=${t.key}`)} className={cx("rounded-full border px-4 py-2 text-sm font-semibold", trade === t.key ? "border-brand bg-brand text-white" : "border-line bg-white")}>
            {t.en}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} /> Free right now
        </label>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2">
          <option value="best">{t("Best match", "بہترین")}</option>
          <option value="distance">{t("Nearest", "قریب ترین")}</option>
          <option value="price">{t("Lowest price", "کم قیمت")}</option>
        </select>
        <span className="text-ink-2">{list.filter((w) => w.availability === "AVAILABLE").length} available · {list.length} total</span>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_440px]">
        <div className="grid content-start gap-5">
          {!data && [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40" />)}
          {list.map((w) => <WorkerCard key={w.id} w={w} onRequest={setReq} />)}
          {data && !list.length && <p className="text-ink-2"><T en="No workers match. Try another trade." ur="کوئی کاریگر نہیں ملا۔ کوئی اور کام چنیں۔" /></p>}
        </div>
        {data && (
          <div className="order-first lg:order-none">
            <div className="lg:sticky lg:top-24">
              <MapView
                className="h-[280px] lg:h-[calc(100vh-140px)]"
                center={[data.center.lat, data.center.lng]}
                pins={[
                  { id: "you", lat: data.center.lat, lng: data.center.lng, label: "You", tone: "you" },
                  ...list
                    .filter((w) => w.lat != null)
                    .map((w) => ({
                      id: w.id,
                      lat: w.lat!,
                      lng: w.lng!,
                      label: w.availability === "AVAILABLE" ? `${w.name.split(" ")[0]} · Rs ${w.baseRate}` : `${w.name.split(" ")[0]} · Busy`,
                      tone: (w.availability === "AVAILABLE" ? "free" : "busy") as Pin["tone"],
                      onClick: () => router.push(`/c/workers/${w.id}`),
                    })),
                ]}
              />
            </div>
          </div>
        )}
      </div>
      <RequestModal worker={req} problem={problem} onClose={() => setReq(null)} />
    </PageFade>
  );
}

export default function Page() {
  return (
    <CustomerPage>
      <Suspense>
        <Workers />
      </Suspense>
    </CustomerPage>
  );
}
