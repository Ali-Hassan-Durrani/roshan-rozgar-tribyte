"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, MapPin, Sparkles, X, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { WorkerShell } from "@/components/shell";
import { Avatar, cx, ErrorNote, ListenButton, Modal, PageFade, Skeleton, TradeIcon, VoicePlayer } from "@/components/ui";
import { patch, post, rs, TRADES, useApi } from "@/lib/api";

const DECLINE = [
  ["FAR", "بہت دور", "🚗"],
  ["BUSY", "مصروف ہوں", "⏰"],
  ["NOT_MY_WORK", "میرا کام نہیں", "🔧"],
  ["LOW_PRICE", "قیمت کم ہے", "💰"],
] as const;

export default function WorkerHome() {
  const router = useRouter();
  const { data: me, reload } = useApi<any>("/workers/me", 5000);
  const verified = me?.status === "VERIFIED";
  const { data: reqs, reload: reloadReqs } = useApi<any[]>(verified ? "/workers/me/requests" : null, 3000);
  const { data: earn } = useApi<any>(verified ? "/workers/me/earnings" : null, 15000);
  const [err, setErr] = useState<string>();
  const [declining, setDeclining] = useState<string>();
  const seen = useRef<Set<string>>(new Set());
  const [incoming, setIncoming] = useState<any>();

  useEffect(() => {
    if (me && me.status !== "VERIFIED") router.replace("/w/onboarding");
  }, [me, router]);

  // WM1: open a full-screen sheet for each new request.
  const primed = useRef(false);
  useEffect(() => {
    if (!reqs) return;
    const fresh = reqs.find((r) => r.status === "REQUESTED" && !seen.current.has(r.id));
    reqs.forEach((r) => seen.current.add(r.id));
    if (fresh && primed.current) setIncoming(fresh);
    primed.current = true;
  }, [reqs]);

  if (!me || !verified) return <WorkerShell><Skeleton className="h-64" /></WorkerShell>;

  const available = me.availability === "AVAILABLE";
  const toggle = async () => {
    setErr(undefined);
    try {
      await patch("/workers/me/availability", { availability: available ? "OFFLINE" : "AVAILABLE" });
      reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const accept = async (id: string) => {
    try {
      await post(`/bookings/${id}/accept`);
      router.push(`/w/jobs/${id}`);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const decline = async (reason: string) => {
    await post(`/bookings/${declining}/decline`, { reason }).catch(() => {});
    setDeclining(undefined);
    setIncoming(undefined);
    reloadReqs();
  };
  const trade = TRADES.find((t) => t.key === me.trade);

  return (
    <WorkerShell>
      <PageFade className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={me.name} photoId={me.photoMediaId} />
            <div>
              <h1 className="urdu text-2xl font-bold">سلام، {me.name?.split(" ")[0]}</h1>
              <p className="text-xs text-ink-3" dir="ltr">{me.name} · {trade?.en}</p>
            </div>
          </div>
          <ListenButton text={available ? "آپ کام کے لیے تیار ہیں۔ نئی درخواستیں یہاں آئیں گی۔" : "کام شروع کرنے کے لیے بٹن دبائیں۔"} />
        </div>

        {me.activeBooking ? (
          <Link href={`/w/jobs/${me.activeBooking.id}`} className="block rounded-3xl bg-busy p-5 text-white">
            <p className="urdu text-2xl font-bold">آپ ابھی مصروف ہیں</p>
            <p className="mt-1 text-sm" dir="ltr">Busy on job {me.activeBooking.code} · {me.activeBooking.area} · {rs(me.activeBooking.agreedPrice)} → open</p>
          </Link>
        ) : (
          <motion.button
            onClick={toggle}
            animate={{ backgroundColor: available ? "#1B1F4B" : "#98A2B3" }}
            className="flex min-h-[96px] w-full items-center gap-4 rounded-3xl p-5 text-white"
          >
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white"><Zap className="h-7 w-7 text-brand" /></span>
            <span className="flex-1 text-right">
              <span className="urdu block text-2xl font-bold">{available ? "میں کام کے لیے تیار ہوں" : "میں ابھی دستیاب نہیں"}</span>
              <span className="block text-xs text-brand-100" dir="ltr">{available ? "Available · customers nearby can see you" : "Offline · tap to go available"}</span>
            </span>
            <span className={cx("relative h-9 w-16 rounded-full", available ? "bg-white" : "bg-white/40")}>
              <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 30 }} className={cx("absolute top-1 h-7 w-7 rounded-full bg-brand", available ? "left-1" : "right-1")} />
            </span>
          </motion.button>
        )}
        <ErrorNote error={err} />

        <div className="grid grid-cols-3 gap-3">
          {[
            ["آج کی کمائی", rs(earn?.today.amount ?? 0)],
            ["ریٹنگ", (earn?.rating ?? me.ratingAvg).toFixed(1)],
            ["کام", String(earn?.today.jobs ?? 0)],
          ].map(([l, v]) => (
            <div key={l} className="rounded-2xl bg-amber-50 p-4">
              <p className="urdu text-sm text-ink-2">{l}</p>
              <p className="text-xl font-extrabold" dir="ltr">{v}</p>
            </div>
          ))}
        </div>

        <h2 className="urdu flex items-center gap-2 text-2xl font-bold">
          نئی درخواست {!!reqs?.length && <span className="urdu rounded-full bg-danger-50 px-2 text-sm text-danger">ابھی</span>}
        </h2>
        {!reqs?.length && <p className="urdu text-ink-2">{available ? "ابھی کوئی درخواست نہیں۔ انتظار کریں…" : "درخواستیں لینے کے لیے دستیاب ہوں۔"}</p>}
        {reqs?.map((r) => (
          <RequestCard key={r.id} r={r} onAccept={() => (r.status === "REQUESTED" ? accept(r.id) : router.push(`/w/jobs/${r.id}`))} onDecline={() => setDeclining(r.id)} />
        ))}
      </PageFade>

      <AnimatePresence>
        {incoming && !declining && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-dark/95 p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="w-full max-w-md text-center text-white">
              <motion.div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-amber" animate={{ rotate: [0, -10, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 1.2 }}>
                <Zap className="h-12 w-12 text-ink" />
              </motion.div>
              <p className="urdu mt-6 text-3xl font-bold">نیا کام آیا ہے!</p>
              <p className="mt-2 text-lg" dir="ltr">{incoming.problemText}</p>
              <p className="mt-1 text-sm text-brand-100" dir="ltr">{incoming.customer?.user?.name} · {incoming.area} · AI {rs(incoming.aiPriceMin)}–{rs(incoming.aiPriceMax)}</p>
              <div className="mt-4 flex justify-center"><ListenButton text={`نیا کام: ${incoming.problemText}۔ علاقہ ${incoming.area}`} label="سنیں" /></div>
              <div className="mt-8 grid grid-cols-[96px_1fr] gap-3">
                <button onClick={() => setDeclining(incoming.id)} className="grid h-[68px] place-items-center rounded-[20px] bg-danger-50 text-danger" aria-label="Decline"><X className="h-8 w-8" /></button>
                <button onClick={() => accept(incoming.id)} className="urdu flex h-[68px] items-center justify-center gap-2 rounded-[20px] bg-amber text-2xl font-bold text-ink"><Check className="h-6 w-6" /> قبول کریں</button>
              </div>
              <button onClick={() => setIncoming(undefined)} className="urdu mt-4 text-brand-100">بعد میں</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal open={!!declining} onClose={() => setDeclining(undefined)} title="کیوں انکار؟">
        <div className="grid grid-cols-2 gap-3" dir="rtl">
          {DECLINE.map(([k, l, e]) => (
            <button key={k} onClick={() => decline(k)} className="flex min-h-[96px] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-line text-3xl hover:border-danger">
              {e} <span className="urdu text-base">{l}</span>
            </button>
          ))}
        </div>
      </Modal>
    </WorkerShell>
  );
}

function RequestCard({ r, onAccept, onDecline }: { r: any; onAccept: () => void; onDecline: () => void }) {
  const trade = TRADES.find((t) => t.key === r.trade);
  return (
    <div className="rounded-3xl border border-line bg-white p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${trade?.tone}`}><TradeIcon icon={trade?.icon ?? "zap"} className="h-6 w-6" /></span>
        <div className="flex-1">
          <p className="text-lg font-bold" dir="ltr">{r.problemText}</p>
          <p className="text-xs text-ink-3" dir="ltr">{r.customer?.user?.name} · {r.area}</p>
        </div>
        <ListenButton text={r.problemText} />
      </div>
      {r.problemVoiceId && <div className="mt-3" dir="ltr"><VoicePlayer mediaId={r.problemVoiceId} /></div>}
      <div className="mt-3 flex items-center justify-between text-sm" dir="ltr">
        <span className="inline-flex items-center gap-1 rounded-full bg-ai-50 px-2.5 py-1 font-semibold text-ai"><Sparkles className="h-3.5 w-3.5" /> AI {rs(r.aiPriceMin)} – {rs(r.aiPriceMax)}</span>
        <span className="flex items-center gap-1 text-ink-2"><MapPin className="h-4 w-4" /> {r.address}</span>
      </div>
      <div className="mt-4 grid grid-cols-[80px_1fr] gap-3">
        <button onClick={onDecline} className="grid h-16 place-items-center rounded-[20px] bg-danger-50 text-danger" aria-label="Decline"><X className="h-7 w-7" /></button>
        <button onClick={onAccept} className="urdu flex h-16 items-center justify-center gap-2 rounded-[20px] bg-brand text-xl font-bold text-white">
          <Check className="h-5 w-5" /> {r.status === "REQUESTED" ? "قبول کریں" : "بات چیت کھولیں"}
        </button>
      </div>
    </div>
  );
}
