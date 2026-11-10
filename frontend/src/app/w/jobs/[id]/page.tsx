"use client";

import { motion } from "framer-motion";
import { Check, MapPin } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { BookingMap, BookingRoom, BookingView, Stepper } from "@/components/booking-room";
import { WorkerShell } from "@/components/shell";
import { Button, Card, ErrorNote, ListenButton, PageFade, Skeleton } from "@/components/ui";
import { post, rs, useApi } from "@/lib/api";
import { T, useLang } from "@/lib/i18n";

export default function Job() {
  const { id } = useParams<{ id: string }>();
  const { data: b, reload } = useApi<BookingView>(`/bookings/${id}`, 3000);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string>();
  const [loading, setLoading] = useState(false);
  const { t, ur } = useLang();
  if (!b) return <WorkerShell><Skeleton className="h-96" /></WorkerShell>;

  const run = async (path: string, body?: object) => {
    setLoading(true);
    setErr(undefined);
    try {
      await post(`/bookings/${id}/${path}`, body);
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <WorkerShell>
      <PageFade className="space-y-4">
        {["CONFIRMED", "IN_PROGRESS"].includes(b.status) && (
          <div className="rounded-3xl bg-busy p-5 text-white">
            <p className="text-2xl font-bold"><T en="You're busy — new requests are paused" ur="آپ مصروف ہیں — نئی درخواستیں بند" /></p>
            <p className="text-sm" dir="ltr">Busy · {b.code} · {rs(b.agreedPrice)}</p>
          </div>
        )}
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div dir="ltr">
              <p className="text-lg font-bold">{b.problemText}</p>
              <p className="flex items-center gap-1 text-sm text-ink-2"><MapPin className="h-4 w-4" /> {b.customer.name} · {b.address}, {b.area}</p>
              {b.aiPriceMin && <p className="mt-1 text-sm text-ai">AI fair price {rs(b.aiPriceMin)} – {rs(b.aiPriceMax)}</p>}
            </div>
            <ListenButton
              text={ur ? `${b.problemText}۔ پتہ: ${b.address}، ${b.area}` : `${b.problemText}. Address: ${b.address}, ${b.area}`}
              lang={ur ? "UR" : "EN"}
              label={t("Listen", "سنیں")}
            />
          </div>
        </Card>
        {["NEGOTIATING", "CONFIRMED", "IN_PROGRESS"].includes(b.status) && <BookingMap b={b} />}
        <Stepper status={b.status} urdu={ur} />
        <ErrorNote error={err} />

        {b.status === "CONFIRMED" && (
          <Card className="bg-amber-50">
            <p className="text-xl font-bold"><T en="Ask the customer for the 4-digit code" ur="گاہک سے 4 ہندسوں کا کوڈ لیں" /></p>
            <div className="mt-3 flex gap-3" dir="ltr">
              <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="____" className="h-16 w-40 rounded-2xl border-2 border-line text-center text-3xl font-extrabold tracking-[0.4em]" />
              <Button size="XL" className="flex-1" loading={loading} disabled={code.length !== 4} onClick={() => run("start", { code })}>
                <span ><T en="Start job" ur="کام شروع کریں" /></span>
              </Button>
            </div>
          </Card>
        )}
        {b.status === "IN_PROGRESS" && (
          <Button size="XL" className="w-full" loading={loading} icon={<Check className="h-6 w-6" />} onClick={() => run("complete")}>
            <span ><T en="Job done" ur="کام مکمل ہو گیا" /></span>
          </Button>
        )}
        {b.status === "COMPLETED" && (
          <Card className="text-center">
            <motion.svg viewBox="0 0 52 52" className="mx-auto h-20 w-20">
              <circle cx="26" cy="26" r="24" fill="#12A39A" />
              <motion.path d="M14 27 l8 8 l16 -16" fill="none" stroke="white" strokeWidth="4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6 }} />
            </motion.svg>
            <p className="mt-3 text-2xl font-bold">
              <T en={`Well done! You earned ${rs(b.agreedPrice)}`} ur={`شاباش! آپ نے ${rs(b.agreedPrice)} کمائے`} />
            </p>
            <p className="text-ink-2"><T en="You're available again" ur="آپ دوبارہ دستیاب ہیں" /></p>
            <Link href="/w" className="mt-4 inline-flex h-16 items-center rounded-[20px] bg-brand px-8 text-xl font-bold text-white"><T en="Go home" ur="گھر جائیں" /></Link>
          </Card>
        )}
        <BookingRoom b={b} onChange={reload} urdu={ur} />
        {["REQUESTED", "NEGOTIATING", "CONFIRMED"].includes(b.status) && (
          <Button kind="danger" className="w-full" onClick={() => run("cancel", { reason: "Worker cancelled" })}>
            <span ><T en="Cancel job" ur="کام منسوخ کریں" /></span>
          </Button>
        )}
      </PageFade>
    </WorkerShell>
  );
}
