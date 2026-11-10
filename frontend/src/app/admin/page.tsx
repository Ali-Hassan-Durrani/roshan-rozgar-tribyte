"use client";

import { AlertTriangle, CheckCircle2, Eye, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { useState } from "react";
import { AdminShell } from "@/components/shell";
import { Avatar, Badge, Button, Card, cx, ErrorNote, Modal, PageFade, Skeleton, Stars } from "@/components/ui";
import { mediaUrl, post, rs, tradeName, useApi } from "@/lib/api";

export default function Admin() {
  const [tab, setTab] = useState("overview");
  return (
    <AdminShell tab={tab} setTab={setTab}>
      {tab === "overview" && <Overview />}
      {tab === "workers" && <Workers />}
      {tab === "bookings" && <Bookings />}
      {tab === "reviews" && <Reviews />}
    </AdminShell>
  );
}

function Overview() {
  const { data: s } = useApi<any>("/admin/stats", 4000);
  const { data: bookings } = useApi<any[]>("/admin/bookings", 6000);
  if (!s) return <Skeleton className="h-96" />;
  const max = Math.max(1, ...s.perDay.map((d: any) => d.bookings));
  return (
    <PageFade className="space-y-6">
      <h1 className="text-[28px] font-extrabold">Overview</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          ["Verified workers", s.workers],
          ["Free now", s.available],
          ["Busy now", s.busy],
          ["Bookings today", s.bookingsToday],
          ["Active jobs", s.active],
          ["Completed", s.completed],
          ["Pending approval", s.pending],
          ["Revenue (all time)", rs(s.revenue)],
        ].map(([l, v]) => (
          <Card key={l} className="p-4">
            <p className="text-sm text-ink-2">{l}</p>
            <p className="mt-1 text-2xl font-extrabold">{v}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <Card>
          <h2 className="font-bold">Bookings · last 7 days</h2>
          <div className="mt-4 flex h-40 items-end gap-3">
            {s.perDay.map((d: any) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs font-bold">{d.bookings}</span>
                <div className="w-full rounded-t-lg bg-brand" style={{ height: `${(d.bookings / max) * 120 + 4}px` }} />
                <span className="text-[10px] text-ink-3">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className={cx(s.doubleBookings === 0 ? "bg-[#E6F6F4]" : "bg-danger-50")}>
          <ShieldCheck className="h-8 w-8 text-teal" />
          <p className="mt-2 text-4xl font-extrabold">{s.doubleBookings}</p>
          <p className="font-bold">double-bookings</p>
          <p className="mt-1 text-sm text-ink-2">Computed live: workers with more than one active job. Guaranteed 0 by an atomic DB transaction.</p>
        </Card>
      </div>
      <Card>
        <h2 className="flex items-center gap-2 font-bold"><Sparkles className="h-4 w-4 text-ai" /> AI alerts</h2>
        <p className="mt-2 text-sm">{s.flagged} flagged reviews waiting · {s.pending} workers waiting for ID review</p>
      </Card>
      <Card>
        <h2 className="font-bold">Recent bookings</h2>
        <BookingTable rows={bookings?.slice(0, 8)} />
      </Card>
    </PageFade>
  );
}

function BookingTable({ rows }: { rows?: any[] }) {
  if (!rows) return <Skeleton className="mt-3 h-40" />;
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-ink-3">
          <tr><th className="py-2">Code</th><th>Customer</th><th>Worker</th><th>Trade</th><th>Booking</th><th>Worker now</th><th className="text-right">Price</th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((b) => (
            <tr key={b.id}>
              <td className="py-2 font-semibold">{b.code}</td>
              <td>{b.customerName}</td>
              <td>{b.workerName}</td>
              <td>{tradeName(b.trade)}</td>
              <td><Badge tone={b.status === "COMPLETED" ? "ok" : ["CANCELLED", "EXPIRED", "DECLINED"].includes(b.status) ? "danger" : "brand"}>{b.status}</Badge></td>
              <td>{b.workerNow === "BUSY" ? <Badge tone="busy" dot>{b.workerActiveHere ? "Busy (this job)" : "Busy"}</Badge> : <Badge dot>{b.workerNow}</Badge>}</td>
              <td className="text-right font-bold">{rs(b.agreedPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Bookings() {
  const [status, setStatus] = useState("");
  const { data } = useApi<any[]>(`/admin/bookings${status ? `?status=${status}` : ""}`, 4000);
  return (
    <PageFade>
      <h1 className="text-[28px] font-extrabold">Bookings · live status</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        {[["", "All"], ["REQUESTED,NEGOTIATING", "Open"], ["CONFIRMED,IN_PROGRESS", "Active"], ["COMPLETED", "Completed"], ["CANCELLED,EXPIRED,DECLINED", "Cancelled"]].map(([k, l]) => (
          <button key={l} onClick={() => setStatus(k)} className={cx("rounded-full px-4 py-2 text-sm font-semibold", status === k ? "bg-brand text-white" : "bg-white")}>{l}</button>
        ))}
      </div>
      <Card className="mt-4"><BookingTable rows={data} /></Card>
    </PageFade>
  );
}

function Workers() {
  const [status, setStatus] = useState("PENDING_REVIEW");
  const { data, reload } = useApi<any[]>(`/admin/workers?status=${status}`, 5000);
  const [open, setOpen] = useState<string>();
  return (
    <PageFade>
      <h1 className="text-[28px] font-extrabold">Workers · approve &amp; manage</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        {["PENDING_REVIEW", "VERIFIED", "REJECTED", "SUSPENDED", "ONBOARDING"].map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={cx("rounded-full px-4 py-2 text-sm font-semibold", status === s ? "bg-brand text-white" : "bg-white")}>{s.replace("_", " ")}</button>
        ))}
      </div>
      <div className="mt-4 grid gap-3">
        {!data && <Skeleton className="h-24" />}
        {data?.map((w) => (
          <Card key={w.id} className="flex flex-wrap items-center gap-4 p-4">
            <Avatar name={w.name} photoId={w.photoMediaId} />
            <div className="min-w-[200px] flex-1">
              <p className="font-bold">{w.name ?? "—"} <span className="font-normal text-ink-2">· {tradeName(w.trade)} · {w.experienceYears ?? "?"} yrs</span></p>
              <p className="text-xs text-ink-3">{w.phoneMasked} · {w.areas.join(", ")} · CNIC {w.cnic?.masked ?? "not uploaded"}</p>
            </div>
            {w.status === "VERIFIED" && <Stars value={w.ratingAvg} count={w.ratingCount} />}
            <Badge tone={w.availability === "BUSY" ? "busy" : "brand"} dot>{w.availability}</Badge>
            <Button size="S" kind="secondary" icon={<Eye className="h-4 w-4" />} onClick={() => setOpen(w.id)}>Review</Button>
          </Card>
        ))}
        {data && !data.length && <p className="text-ink-2">No workers in this state.</p>}
      </div>
      {open && <VerifyModal id={open} onClose={() => { setOpen(undefined); reload(); }} />}
    </PageFade>
  );
}

function VerifyModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: w } = useApi<any>(`/admin/workers/${id}`);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string>();
  const act = async (a: string) => {
    try {
      await post(`/admin/workers/${id}/${a}`, a === "approve" ? undefined : { reason: reason || "Not specified" });
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <Modal open onClose={onClose} title="Verify worker">
      {!w ? <Skeleton className="h-60" /> : (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto">
          <div className="flex items-center gap-3">
            <Avatar name={w.name} photoId={w.photoMediaId} size={56} />
            <div>
              <p className="text-lg font-bold">{w.name}</p>
              <p className="text-sm text-ink-2">{tradeName(w.trade)} · {w.experienceYears} yrs · Rs {w.baseRate} · {w.areas.join(", ")}</p>
            </div>
          </div>
          {w.voiceTranscript && <p className="rounded-2xl bg-bg p-3 text-sm">🎙 “{w.voiceTranscript}”</p>}
          {w.cnic ? (
            <div className="space-y-2">
              <p className="font-bold">CNIC {w.cnic.masked} · name on card: {w.cnic.nameOnCard ?? "—"}</p>
              <div className="grid grid-cols-2 gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {[w.cnic.frontMediaId, w.cnic.backMediaId].map((m: string) => <img key={m} src={mediaUrl(m)} alt="CNIC" className="rounded-xl" />)}
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(w.cnic.checks).map(([k, v]) => (
                  <span key={k} className={cx("rounded-full px-2.5 py-1 text-xs font-semibold", v ? "bg-[#E6F6F4] text-teal" : "bg-danger-50 text-danger")}>{v ? "✓" : "✕"} {k}</span>
                ))}
              </div>
              <p className="text-xs text-ink-3">OCR confidence {Math.round(w.cnic.ocrConfidence)} · name match {Math.round(w.cnic.nameMatchScore)} · Demo — not checked against NADRA. View logged to audit.</p>
            </div>
          ) : <p className="text-sm text-ink-2">No CNIC uploaded (seeded worker).</p>}
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (for reject / suspend)" className="w-full rounded-xl border border-line p-3 text-sm" />
          <ErrorNote error={err} />
          <div className="grid grid-cols-3 gap-2">
            {w.status !== "VERIFIED" && <Button icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => act("approve")}>Approve</Button>}
            {w.status === "PENDING_REVIEW" && <Button kind="danger" icon={<XCircle className="h-4 w-4" />} onClick={() => act("reject")}>Reject</Button>}
            {w.status === "VERIFIED" && <Button kind="danger" icon={<AlertTriangle className="h-4 w-4" />} onClick={() => act("suspend")}>Suspend</Button>}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Reviews() {
  const [flagged, setFlagged] = useState(true);
  const { data, reload } = useApi<any[]>(`/admin/reviews?flagged=${flagged}`, 5000);
  const act = async (id: string, a: "hide" | "keep") => {
    await post(`/admin/reviews/${id}/${a}`);
    reload();
  };
  return (
    <PageFade>
      <h1 className="text-[28px] font-extrabold">Reviews &amp; AI flags</h1>
      <div className="mt-4 flex gap-2">
        {[[true, "Flagged by AI"], [false, "All reviews"]].map(([v, l]) => (
          <button key={String(v)} onClick={() => setFlagged(v as boolean)} className={cx("rounded-full px-4 py-2 text-sm font-semibold", flagged === v ? "bg-brand text-white" : "bg-white")}>{l}</button>
        ))}
      </div>
      <div className="mt-4 grid gap-3">
        {data?.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold">{r.customerName} → {r.workerName} <span className="font-normal text-ink-3">· {r.bookingCode}</span></p>
              <div className="flex items-center gap-2">
                <Stars value={r.overall} />
                {r.status === "HIDDEN" && <Badge tone="danger">Hidden</Badge>}
              </div>
            </div>
            {(r.text || r.transcript) && <p className="mt-2 text-sm">{r.transcript ? "🎙 " : ""}“{r.text || r.transcript}”</p>}
            {r.flagged && <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-ai"><Sparkles className="h-4 w-4" /> {r.flagReason}</p>}
            {r.flagged && r.status === "PUBLISHED" && (
              <div className="mt-3 flex gap-2">
                <Button size="S" kind="danger" onClick={() => act(r.id, "hide")}>Remove</Button>
                <Button size="S" kind="secondary" onClick={() => act(r.id, "keep")}>Keep</Button>
              </div>
            )}
          </Card>
        ))}
        {data && !data.length && <p className="text-ink-2">Nothing flagged. 🎉</p>}
      </div>
    </PageFade>
  );
}
