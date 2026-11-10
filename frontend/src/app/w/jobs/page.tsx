"use client";

import Link from "next/link";
import { WorkerShell } from "@/components/shell";
import { Badge, PageFade, Skeleton } from "@/components/ui";
import { rs, useApi } from "@/lib/api";

export default function Jobs() {
  const { data } = useApi<any[]>("/bookings", 5000);
  return (
    <WorkerShell>
      <PageFade>
        <h1 className="urdu text-3xl font-bold">میرے کام</h1>
        <div className="mt-5 space-y-3">
          {!data && <Skeleton className="h-24" />}
          {data?.map((b) => (
            <Link key={b.id} href={`/w/jobs/${b.id}`} className="flex min-h-16 items-center justify-between rounded-3xl border border-line bg-white p-4" dir="ltr">
              <div>
                <p className="font-bold">{b.problemText}</p>
                <p className="text-xs text-ink-3">{b.customer?.name} · {b.area} · {b.code}</p>
              </div>
              <div className="text-right">
                <Badge tone={b.status === "COMPLETED" ? "ok" : "brand"}>{b.status}</Badge>
                <p className="mt-1 font-bold">{rs(b.agreedPrice)}</p>
              </div>
            </Link>
          ))}
        </div>
      </PageFade>
    </WorkerShell>
  );
}
