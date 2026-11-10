"use client";

import { motion } from "framer-motion";
import { Mic, PhoneOff } from "lucide-react";
import { Line, useVapiCall } from "@/lib/vapi";
import { cx, ErrorNote } from "./ui";

/** Pulse-mic + live transcript bubbles (W3 / WW2 and the customer mic). */
export function VoiceAgent({
  assistantId, purpose, onEnd, urdu, idleLabel,
}: {
  assistantId?: string;
  purpose: "WORKER_ONBOARDING" | "CUSTOMER_BOOKING";
  onEnd: (lines: Line[]) => void;
  urdu?: boolean;
  idleLabel: React.ReactNode;
}) {
  const { status, lines, partial, speaking, error, start, stop } = useVapiCall(assistantId, purpose, onEnd);
  const live = status === "live" || status === "connecting";
  const shown = [...lines.slice(-4), ...(partial ? [partial] : [])];
  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={live ? stop : start}
        className={cx("relative grid h-28 w-28 place-items-center rounded-full text-white", live ? "bg-ai" : "bg-brand")}
        aria-label={live ? "End call" : "Start voice"}
      >
        {live && (
          <>
            <span className="pulse-ring absolute inset-0 rounded-full bg-ai" />
            <span className="pulse-ring absolute inset-0 rounded-full bg-ai [animation-delay:.8s]" />
          </>
        )}
        {live ? <PhoneOff className="relative h-10 w-10" /> : <Mic className="relative h-11 w-11" />}
      </button>
      <p className={cx("text-center text-sm text-ink-2", urdu && "urdu text-base")}>
        {status === "connecting" ? (urdu ? "جڑ رہے ہیں…" : "Connecting…") : status === "live" ? (speaking ? (urdu ? "اسسٹنٹ بول رہی ہے…" : "Assistant is speaking…") : urdu ? "بولیں — ہم سن رہے ہیں" : "Speak — we're listening") : idleLabel}
      </p>
      {!!shown.length && (
        <div className="w-full space-y-2" dir="auto">
          {shown.map((l, i) => (
            <motion.p
              key={i + l.text}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={cx("max-w-[85%] rounded-2xl px-4 py-2 text-sm", l.role === "assistant" ? "bg-white" : "ml-auto bg-brand text-white", l === partial && "opacity-60")}
            >
              {l.text}
            </motion.p>
          ))}
        </div>
      )}
      <ErrorNote error={error} />
    </div>
  );
}
