"use client";

import { Check, Lock, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError, post, rs, useApi } from "@/lib/api";
import { MapView, Pin } from "./map-view";
import { Button, cx, ErrorNote, ListenButton, MicRecorder, VoicePlayer } from "./ui";

export type BookingView = {
  id: string;
  code: string;
  status: string;
  trade: string;
  problemText: string;
  problemVoiceId?: string;
  address: string;
  area: string;
  urgency: string;
  aiPriceMin?: number;
  aiPriceMax?: number;
  agreedPrice?: number;
  startCode?: string;
  myParty: "CUSTOMER" | "WORKER" | null;
  lat?: number | null;
  lng?: number | null;
  worker: { id: string; name: string; trade: string; ratingAvg: number; photoMediaId?: string; availability: string; phoneMasked?: string; lat?: number | null; lng?: number | null };
  customer: { id: string; name: string };
  offers: { id: string; by: "CUSTOMER" | "WORKER"; amount: number; status: string }[];
  review?: { overall: number } | null;
  cancelReason?: string;
};

type Msg = {
  id: string;
  type: "TEXT" | "VOICE" | "PRICE_OFFER" | "SYSTEM";
  text?: string;
  audioId?: string;
  transcript?: string;
  translation?: string;
  mine: boolean;
  createdAt: string;
  offer?: { id: string; by: string; amount: number; status: string };
};

const ACTIVE = ["REQUESTED", "NEGOTIATING", "CONFIRMED", "IN_PROGRESS"];

export function BookingRoom({ b, onChange, urdu }: { b: BookingView; onChange: () => void; urdu?: boolean }) {
  const { data: msgs, reload } = useApi<Msg[]>(`/bookings/${b.id}/messages`, 3000);
  const [text, setText] = useState("");
  const [suggest, setSuggest] = useState<number>();
  const [counter, setCounter] = useState<string>("");
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const canChat = ACTIVE.includes(b.status);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [msgs?.length]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr(undefined);
    try {
      await fn();
      await reload();
      onChange();
    } catch (e) {
      setErr((e as ApiError).code === "WORKER_UNAVAILABLE" ? "This worker just got booked by someone else. Pick another worker." : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const send = (body: object) =>
    act(async () => {
      const r = await post(`/bookings/${b.id}/messages`, body);
      setText("");
      if (r.suggestedOffer && b.status === "NEGOTIATING") setSuggest(r.suggestedOffer);
    });
  const offer = (amount: number) => act(() => post(`/bookings/${b.id}/offers`, { amount })).then(() => { setSuggest(undefined); setCounter(""); });
  const accept = (offerId: string) => act(() => post(`/bookings/${b.id}/offers/${offerId}/accept`));

  const L = (en: string, ur: string) => (urdu ? <span className="urdu">{ur}</span> : en);

  return (
    <div className="flex h-[620px] flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-card">
      <div className="flex-1 space-y-3 overflow-y-auto p-4" dir="ltr">
        {msgs?.map((m) => {
          if (m.type === "SYSTEM") {
            return (
              <p key={m.id} className="mx-auto w-fit rounded-full bg-brand-50 px-3 py-1 text-center text-xs font-medium text-brand">
                {m.text}
              </p>
            );
          }
          if (m.type === "PRICE_OFFER" && m.offer) {
            const o = m.offer;
            const inRange = b.aiPriceMin && b.aiPriceMax && o.amount >= b.aiPriceMin * 0.9 && o.amount <= b.aiPriceMax * 1.1;
            const theirs = o.by !== b.myParty;
            return (
              <div key={m.id} className={cx("max-w-[420px] rounded-3xl border-2 p-4", m.mine ? "ml-auto" : "", o.status === "PENDING" ? "border-ai" : "border-line opacity-70")}>
                <p className="flex items-center gap-1.5 text-sm font-bold text-ai"><Sparkles className="h-4 w-4" /> Price offer · {o.by === "WORKER" ? "worker" : "customer"}</p>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-3xl font-extrabold">{rs(o.amount)}</p>
                  {b.aiPriceMin && (
                    <span className={cx("rounded-full px-2.5 py-1 text-xs font-semibold", inRange ? "bg-brand-50 text-brand" : "bg-danger-50 text-danger")}>
                      {inRange ? "Within fair range" : "Outside fair range"}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs font-semibold uppercase text-ink-3">{o.status}</p>
                {o.status === "PENDING" && theirs && b.status === "NEGOTIATING" && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button size={urdu ? "XL" : "M"} loading={busy} icon={<Check className="h-4 w-4" />} onClick={() => accept(o.id)}>
                      {L("Accept & book", "قبول کریں")}
                    </Button>
                    <Button size={urdu ? "XL" : "M"} kind="secondary" onClick={() => setCounter(String(o.amount))}>
                      {L("Counter offer", "نئی قیمت")}
                    </Button>
                  </div>
                )}
              </div>
            );
          }
          return (
            <div key={m.id} className={cx("max-w-[80%] rounded-3xl px-4 py-3", m.mine ? "ml-auto bg-brand text-white" : "bg-bg")}>
              {m.audioId && <VoicePlayer mediaId={m.audioId} />}
              {m.text && <p>{m.text}</p>}
              {m.transcript && <p className={cx("mt-1 text-sm", m.mine ? "text-brand-100" : "text-ink-2")}>“{m.transcript}”</p>}
              {m.translation && (
                <p className={cx("mt-2 rounded-xl px-3 py-2 text-sm", m.mine ? "bg-white/10" : "bg-amber-50")}>
                  <span className="flex items-center gap-1 text-xs font-semibold text-ai"><Sparkles className="h-3 w-3" /> Translated</span>
                  {m.translation}
                </p>
              )}
              {!m.mine && urdu && (m.translation || m.text) && <div className="mt-2"><ListenButton text={m.translation || m.text || ""} /></div>}
            </div>
          );
        })}
        <div ref={end} />
      </div>

      {b.status === "NEGOTIATING" && (
        <p className="mx-4 mb-2 flex items-center gap-2 rounded-full bg-bg px-3 py-1.5 text-xs text-ink-2">
          <Lock className="h-3.5 w-3.5" /> Once a price is accepted, {b.worker.name.split(" ")[0]} is marked Busy and stops getting other requests.
        </p>
      )}
      {suggest && (
        <div className="mx-4 mb-2 flex items-center justify-between rounded-2xl bg-ai-50 p-3 text-sm">
          <span className="flex items-center gap-1.5 text-ai"><Sparkles className="h-4 w-4" /> AI heard a price: <b>{rs(suggest)}</b></span>
          <Button size="S" onClick={() => offer(suggest)}>Send as offer</Button>
        </div>
      )}
      <div className="px-4"><ErrorNote error={err} /></div>
      {canChat && (
        <div className="space-y-2 border-t border-line p-3">
          {b.status === "NEGOTIATING" && (
            <form onSubmit={(e) => { e.preventDefault(); if (Number(counter) >= 100) offer(Number(counter)); }} className="flex gap-2">
              <input value={counter} onChange={(e) => setCounter(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder={urdu ? "قیمت (روپے)" : "Offer price (Rs)"} className="min-w-0 flex-1 rounded-xl border border-line px-3" />
              <Button kind="accent" size={urdu ? "L" : "M"} loading={busy} disabled={Number(counter) < 100}>{L("Send offer", "قیمت بھیجیں")}</Button>
            </form>
          )}
          <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) send({ type: "TEXT", text }); }} className="flex items-center gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={urdu ? "لکھیں یا مائیک دبائیں" : "Type in English or Roman Urdu…"} className="h-12 min-w-0 flex-1 rounded-xl bg-bg px-3 outline-none" />
            <MicRecorder size={48} onDone={(id) => send({ type: "VOICE", audioId: id })} />
            <button className="grid h-12 w-12 place-items-center rounded-xl bg-brand text-white" aria-label="Send"><Send className="h-5 w-5" /></button>
          </form>
        </div>
      )}
    </div>
  );
}

export const STEPS = ["REQUESTED", "NEGOTIATING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"];
export const STEP_LABEL: Record<string, [string, string]> = {
  REQUESTED: ["Requested", "درخواست"],
  NEGOTIATING: ["Agreeing price", "قیمت طے"],
  CONFIRMED: ["Booked · on the way", "بک ہو گیا"],
  IN_PROGRESS: ["Working", "کام جاری"],
  COMPLETED: ["Done", "مکمل"],
};

export function Stepper({ status, urdu }: { status: string; urdu?: boolean }) {
  const idx = STEPS.indexOf(status);
  if (idx < 0) {
    return <p className="rounded-2xl bg-danger-50 p-3 text-sm font-semibold text-danger">This booking is {status.toLowerCase()}.</p>;
  }
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((s, i) => (
        <div key={s} className="flex flex-1 flex-col items-center gap-1 text-center">
          <div className={cx("h-1.5 w-full rounded-full transition-all", i <= idx ? "bg-teal" : "bg-line")} />
          <span className={cx("text-[11px]", i === idx ? "font-bold text-ink" : "text-ink-3", urdu && "urdu text-xs")}>{STEP_LABEL[s][urdu ? 1 : 0]}</span>
        </div>
      ))}
    </div>
  );
}

/** Job location + worker position (C6 / W8). */
export function BookingMap({ b, className = "h-[260px]" }: { b: BookingView; className?: string }) {
  const pins: Pin[] = [];
  if (b.lat != null && b.lng != null) pins.push({ id: "job", lat: b.lat, lng: b.lng, label: `Job · ${b.area}`, tone: "job" });
  if (b.worker.lat != null && b.worker.lng != null) {
    pins.push({ id: "worker", lat: b.worker.lat, lng: b.worker.lng, label: b.worker.name.split(" ")[0], tone: "free" });
  }
  if (!pins.length) return null;
  return <MapView pins={pins} className={className} />;
}
