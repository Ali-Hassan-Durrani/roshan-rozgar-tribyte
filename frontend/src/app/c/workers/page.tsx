"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { RequestModal } from "@/components/request-modal";
import { CustomerPage } from "@/components/shell";
import { cx, PageFade, Skeleton } from "@/components/ui";
import { WorkerCard, WorkerCardData } from "@/components/worker-card";
import { TRADES, useApi } from "@/lib/api";

function Workers() {
  const sp = useSearchParams();
  const router = useRouter();
  const trade = sp.get("trade") ?? "";
  const problem = sp.get("q") ?? undefined;
  const [sort, setSort] = useState("best");
  const [onlyFree, setOnlyFree] = useState(false);
  const [req, setReq] = useState<WorkerCardData | null>(null);
  const qs = new URLSearchParams({ radiusKm: "50", sort, ...(trade ? { trade } : {}), ...(onlyFree ? { availableNow: "true" } : {}) });
  const { data } = useApi<{ workers: WorkerCardData[] }>(`/workers/search?${qs}`, 5000);
  const list = data?.workers ?? [];

  return (
    <PageFade>
      <h1 className="text-2xl font-extrabold md:text-[34px]">
        {trade ? TRADES.find((t) => t.key === trade)?.en + "s" : "All workers"} near you
      </h1>
      <p className="mt-1 text-ink-2">Only verified workers. Busy workers are greyed out until they finish their current job.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button onClick={() => router.push("/c/workers")} className={cx("rounded-full border px-4 py-2 text-sm font-semibold", !trade ? "border-brand bg-brand text-white" : "border-line bg-white")}>All</button>
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
          <option value="best">Best match</option>
          <option value="distance">Nearest</option>
          <option value="price">Lowest price</option>
        </select>
        <span className="text-ink-2">{list.filter((w) => w.availability === "AVAILABLE").length} available · {list.length} total</span>
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {!data && [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40" />)}
        {list.map((w) => <WorkerCard key={w.id} w={w} onRequest={setReq} />)}
        {data && !list.length && <p className="text-ink-2">No workers match. Try another trade.</p>}
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
