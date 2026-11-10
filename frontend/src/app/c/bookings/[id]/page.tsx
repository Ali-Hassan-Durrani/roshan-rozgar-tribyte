"use client";

import { motion } from "framer-motion";
import { MapPin, Phone, Sparkles, Star } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { BookingRoom, BookingView, Stepper } from "@/components/booking-room";
import { CustomerPage } from "@/components/shell";
import { Avatar, Badge, Button, Card, cx, ErrorNote, MicRecorder, Modal, PageFade, Skeleton } from "@/components/ui";
import { post, rs, tradeName, useApi } from "@/lib/api";

export default function BookingPage() {
  const { id } = useParams<{ id: string }>();
  const { data: b, reload } = useApi<BookingView>(`/bookings/${id}`, 3000);
  const [cancel, setCancel] = useState(false);
  const [err, setErr] = useState<string>();
  if (!b) return <CustomerPage><Skeleton className="h-96" /></CustomerPage>;

  const doCancel = async () => {
    try {
      await post(`/bookings/${id}/cancel`, { reason: "Changed my mind" });
      setCancel(false);
      reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <CustomerPage>
      <PageFade className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card className="flex items-center gap-4">
            <Avatar name={b.worker.name} photoId={b.worker.photoMediaId} size={56} />
            <div className="flex-1">
              <p className="text-lg font-bold">{b.worker.name}</p>
              <p className="text-sm text-ink-2">{tradeName(b.trade)} · {b.code}</p>
            </div>
            {b.worker.phoneMasked && ["CONFIRMED", "IN_PROGRESS"].includes(b.status) && (
              <span className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-semibold"><Phone className="h-4 w-4" /> {b.worker.phoneMasked}</span>
            )}
          </Card>
          <Stepper status={b.status} />
          <BookingRoom b={b} onChange={reload} />
        </div>
        <div className="space-y-4">
          {b.status === "CONFIRMED" && b.startCode && (
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <Card className="bg-amber-50">
                <p className="text-sm font-bold">Booking confirmed 🎉 Start code</p>
                <p className="mt-2 text-5xl font-extrabold tracking-[0.3em]">{b.startCode}</p>
                <p className="mt-2 text-sm text-ink-2">Tell this code to {b.worker.name.split(" ")[0]} when they arrive. The job starts only with this code.</p>
              </Card>
            </motion.div>
          )}
          <Card>
            <h2 className="text-lg font-bold">Job summary</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div><dt className="text-ink-3">Problem</dt><dd className="font-medium">{b.problemText}</dd></div>
              <div><dt className="text-ink-3">Address</dt><dd className="flex items-center gap-1 font-medium"><MapPin className="h-4 w-4" /> {b.address}, {b.area}</dd></div>
              <div><dt className="text-ink-3">When</dt><dd className="font-medium">{b.urgency === "NOW" ? "Right now" : b.urgency === "TODAY" ? "Today" : "Scheduled"}</dd></div>
              {b.agreedPrice && <div><dt className="text-ink-3">Agreed price</dt><dd className="text-xl font-extrabold">{rs(b.agreedPrice)}</dd></div>}
            </dl>
            {b.aiPriceMin && (
              <div className="mt-4 rounded-2xl bg-ai-50 p-4">
                <p className="flex items-center gap-1.5 text-sm font-bold text-ai"><Sparkles className="h-4 w-4" /> Fair price check</p>
                <p className="mt-1 text-sm">{rs(b.aiPriceMin)} – {rs(b.aiPriceMax)}</p>
              </div>
            )}
          </Card>
          {b.status === "COMPLETED" && !b.review && <ReviewCard id={b.id} name={b.worker.name} onDone={reload} />}
          {b.review && <Card><p className="font-bold">Thanks for your review!</p><p className="text-sm text-ink-2">You rated {b.review.overall}★</p></Card>}
          {["REQUESTED", "NEGOTIATING", "CONFIRMED"].includes(b.status) && (
            <Button kind="danger" className="w-full" onClick={() => setCancel(true)}>Cancel booking</Button>
          )}
          {["EXPIRED", "DECLINED"].includes(b.status) && (
            <Link href={`/c/workers?trade=${b.trade}`} className="flex h-12 items-center justify-center rounded-2xl bg-brand font-bold text-white">Pick another worker</Link>
          )}
        </div>
      </PageFade>
      <Modal open={cancel} onClose={() => setCancel(false)} title="Cancel this booking?">
        <p className="text-ink-2">{b.status === "CONFIRMED" ? `${b.worker.name} will be freed for other customers.` : "The worker will be told."}</p>
        <ErrorNote error={err} />
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button kind="secondary" onClick={() => setCancel(false)}>Keep it</Button>
          <Button kind="danger" onClick={doCancel}>Yes, cancel</Button>
        </div>
      </Modal>
    </CustomerPage>
  );
}

const TAGS = ["On time", "Clean work", "Fair price", "Polite", "Expert", "Explained the problem"];

function ReviewCard({ id, name, onDone }: { id: string; name: string; onDone: () => void }) {
  const [r, setR] = useState({ overall: 5, quality: 5, onTime: 5, fairPrice: 5, behaviour: 5 });
  const [tags, setTags] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState<string>();
  const [err, setErr] = useState<string>();
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    try {
      await post(`/bookings/${id}/review`, { ...r, tags, text: text || undefined, voiceId });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  const row = (k: keyof typeof r, label: string) => (
    <div key={k} className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <span className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} onClick={() => setR({ ...r, [k]: i })} aria-label={`${i} stars`}>
            <Star className={cx("h-6 w-6", i <= r[k] ? "fill-amber text-amber" : "text-line")} />
          </button>
        ))}
      </span>
    </div>
  );
  return (
    <Card>
      <h2 className="text-lg font-bold">Rate {name.split(" ")[0]}</h2>
      <div className="mt-3 space-y-2">
        {row("overall", "Overall")}
        {row("quality", "Quality")}
        {row("onTime", "On time")}
        {row("fairPrice", "Fair price")}
        {row("behaviour", "Behaviour")}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {TAGS.map((t) => (
          <button key={t} onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])} className={cx("rounded-full border px-3 py-1 text-xs font-semibold", tags.includes(t) ? "border-brand bg-brand text-white" : "border-line")}>
            {t}
          </button>
        ))}
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Write a few words (optional)" className="mt-3 w-full rounded-xl border border-line p-3 text-sm" />
      <div className="mt-2 flex items-center gap-3 text-sm text-ink-2">
        <MicRecorder size={44} onDone={setVoiceId} /> {voiceId ? <Badge tone="ok">Voice review attached</Badge> : "Or speak your review"}
      </div>
      <ErrorNote error={err} />
      <Button size="L" className="mt-4 w-full" loading={loading} onClick={submit}>Submit review</Button>
    </Card>
  );
}
