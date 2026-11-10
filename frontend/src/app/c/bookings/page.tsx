"use client";

import Link from "next/link";
import { useState } from "react";
import { CustomerPage } from "@/components/shell";
import { Avatar, Badge, cx, PageFade, Skeleton } from "@/components/ui";
import { rs, tradeName, useApi } from "@/lib/api";
import { T } from "@/lib/i18n";

const TABS: [string, string[]][] = [
  ["Active", ["REQUESTED", "NEGOTIATING", "CONFIRMED", "IN_PROGRESS"]],
  ["Past", ["COMPLETED"]],
  ["Cancelled", ["CANCELLED", "DECLINED", "EXPIRED"]],
];

export default function Bookings() {
  const [tab, setTab] = useState(0);
  const { data } = useApi<any[]>(`/bookings?status=${TABS[tab][1].join(",")}`, 4000);
  return (
    <CustomerPage>
      <PageFade>
        <h1 className="text-[28px] font-extrabold"><T en="My bookings" ur="میری بکنگز" /></h1>
        <div className="mt-4 flex gap-2">
          {TABS.map(([t], i) => (
            <button key={t} onClick={() => setTab(i)} className={cx("rounded-full px-4 py-2 text-sm font-semibold", tab === i ? "bg-brand text-white" : "bg-white")}>
              {t}
            </button>
          ))}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {!data && [1, 2].map((i) => <Skeleton key={i} className="h-28" />)}
          {data?.map((b) => (
            <Link key={b.id} href={`/c/bookings/${b.id}`} className="flex items-center gap-4 rounded-3xl border border-line bg-white p-5 shadow-card transition hover:-translate-y-0.5">
              <Avatar name={b.worker.name} photoId={b.worker.photoMediaId} />
              <div className="flex-1">
                <p className="font-bold">{b.worker.name} · {tradeName(b.trade)}</p>
                <p className="text-sm text-ink-2">{b.problemText}</p>
                <p className="text-xs text-ink-3">{b.code} · {new Date(b.createdAt).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <Badge tone={b.status === "COMPLETED" ? "ok" : ["CANCELLED", "DECLINED", "EXPIRED"].includes(b.status) ? "danger" : "brand"}>{b.status.replace("_", " ")}</Badge>
                <p className="mt-2 font-bold">{rs(b.agreedPrice)}</p>
              </div>
            </Link>
          ))}
          {data && !data.length && <p className="text-ink-2"><T en="Nothing here yet." ur="ابھی یہاں کچھ نہیں۔" /></p>}
        </div>
      </PageFade>
    </CustomerPage>
  );
}
