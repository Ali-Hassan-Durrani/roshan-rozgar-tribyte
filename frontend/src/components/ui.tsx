"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck, Car, Droplet, Hammer, Loader2, Mic, PaintRoller, Pause, Play, Snowflake, Square, Star, Sun, Volume2, X, Zap,
} from "lucide-react";
import { ButtonHTMLAttributes, ReactNode, useRef, useState } from "react";
import { initials, mediaUrl, post } from "@/lib/api";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

type Kind = "primary" | "secondary" | "ghost" | "accent" | "danger" | "dark";
type Size = "XL" | "L" | "M" | "S";
const KIND: Record<Kind, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark",
  secondary: "bg-white text-ink border border-line hover:bg-bg",
  ghost: "bg-brand-50 text-brand hover:bg-brand-100",
  accent: "bg-amber text-ink hover:brightness-95",
  danger: "bg-danger-50 text-danger hover:bg-danger hover:text-white",
  dark: "bg-ink text-white",
};
const SIZE: Record<Size, string> = {
  XL: "h-[68px] rounded-[20px] px-6 text-xl font-bold",
  L: "h-[52px] rounded-2xl px-5 text-base font-bold",
  M: "h-11 rounded-xl px-4 text-sm font-bold",
  S: "h-9 rounded-xl px-3 text-sm font-semibold",
};

export function Button({
  kind = "primary", size = "M", loading, icon, className, children, ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: Kind; size?: Size; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      {...p}
      disabled={p.disabled || loading}
      className={cx("inline-flex items-center justify-center gap-2 transition disabled:opacity-50", KIND[kind], SIZE[size], className)}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function Logo({ dark }: { dark?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand">
        <Sun className="h-5 w-5 text-amber" />
      </span>
      <span className={cx("text-lg font-extrabold tracking-tight", dark ? "text-white" : "text-ink")}>Roshan Rozgar</span>
    </span>
  );
}

export function Avatar({ name, photoId, size = 48 }: { name?: string | null; photoId?: string | null; size?: number }) {
  return photoId ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={mediaUrl(photoId)} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-amber-50 font-bold text-busy"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </span>
  );
}

export function Stars({ value, count }: { value: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cx("h-3.5 w-3.5", i <= Math.round(value) ? "fill-amber text-amber" : "text-line")} />
      ))}
      <b className="ml-1">{value.toFixed(1)}</b>
      {count != null && <span className="text-ink-3">({count})</span>}
    </span>
  );
}

export function Badge({ tone = "brand", children, dot }: { tone?: "brand" | "busy" | "ai" | "info" | "danger" | "ok"; children: ReactNode; dot?: boolean }) {
  const t = {
    brand: "bg-brand-50 text-brand",
    busy: "bg-busy-50 text-busy",
    ai: "bg-ai-50 text-ai",
    info: "bg-info-50 text-info",
    danger: "bg-danger-50 text-danger",
    ok: "bg-[#E6F6F4] text-teal",
  }[tone];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", t)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export const Verified = () => <BadgeCheck className="h-4 w-4 text-info" aria-label="Verified" />;

const ICONS = { zap: Zap, droplet: Droplet, snowflake: Snowflake, hammer: Hammer, car: Car, "paint-roller": PaintRoller };
export function TradeIcon({ icon, className }: { icon: string; className?: string }) {
  const I = ICONS[icon as keyof typeof ICONS] ?? Zap;
  return <I className={className} />;
}

/** Truck-art strip: repeating triangles in pink / marigold / teal / white on navy. */
export function TruckStrip({ height = 12 }: { height?: number }) {
  const colors = ["#E63973", "#FFB703", "#12A39A", "#FFFFFF"];
  return (
    <svg width="100%" height={height} preserveAspectRatio="none" aria-hidden>
      <defs>
        <pattern id="truck" width={height * 4} height={height} patternUnits="userSpaceOnUse">
          <rect width={height * 4} height={height} fill="#1B1F4B" />
          {colors.map((c, i) => (
            <polygon key={c} points={`${i * height},${height} ${i * height + height / 2},0 ${(i + 1) * height},${height}`} fill={c} />
          ))}
        </pattern>
      </defs>
      <rect width="100%" height={height} fill="url(#truck)" />
    </svg>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-3xl border border-line bg-white p-5 shadow-card", className)}>{children}</div>;
}

export function Modal({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(16,24,40,.55)] md:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-[560px] rounded-t-4xl bg-white p-6 shadow-modal md:rounded-3xl"
            initial={{ y: 40, scale: 0.96 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 40 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-extrabold">{title}</h3>
              <button onClick={onClose} className="rounded-full p-2 hover:bg-bg" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function PageFade({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: "easeOut" }} className={className}>
      {children}
    </motion.div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton rounded-2xl", className)} />;
}

export function ErrorNote({ error }: { error?: { message: string } | string | null }) {
  if (!error) return null;
  return <p className="rounded-xl bg-danger-50 px-3 py-2 text-sm font-medium text-danger">{typeof error === "string" ? error : error.message}</p>;
}

/** 🔊 سنیں — plays ElevenLabs TTS through the backend. */
export function ListenButton({ text, lang = "UR", label = "سنیں" }: { text: string; lang?: "UR" | "EN"; label?: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const audio = useRef<HTMLAudioElement | null>(null);
  const play = async () => {
    if (state === "playing") {
      audio.current?.pause();
      setState("idle");
      return;
    }
    setState("loading");
    try {
      const blob = await post<Blob>("/voice/tts", { text, lang });
      audio.current = new Audio(URL.createObjectURL(blob));
      audio.current.onended = () => setState("idle");
      await audio.current.play();
      setState("playing");
    } catch {
      // Fallback: browser speech synthesis when the TTS service is unavailable.
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === "UR" ? "ur-PK" : "en-US";
      u.onend = () => setState("idle");
      speechSynthesis.speak(u);
      setState("playing");
    }
  };
  return (
    <button onClick={play} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-ink">
      {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : state === "playing" ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      <span className={lang === "UR" ? "urdu" : ""}>{label}</span>
    </button>
  );
}

export function Waveform({ active, bars = 28 }: { active?: boolean; bars?: number }) {
  return (
    <div className="flex h-8 items-center gap-[3px]">
      {Array.from({ length: bars }).map((_, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-brand"
          animate={{ height: active ? ["30%", `${30 + ((i * 37) % 70)}%`, "40%"] : `${30 + ((i * 53) % 60)}%` }}
          transition={active ? { duration: 0.8, repeat: Infinity, delay: i * 0.03 } : { duration: 0.2 }}
        />
      ))}
    </div>
  );
}

export function VoicePlayer({ mediaId }: { mediaId: string }) {
  const [playing, setPlaying] = useState(false);
  const a = useRef<HTMLAudioElement | null>(null);
  const toggle = () => {
    if (!a.current) {
      a.current = new Audio(mediaUrl(mediaId));
      a.current.onended = () => setPlaying(false);
    }
    if (playing) a.current.pause();
    else a.current.play();
    setPlaying(!playing);
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-brand-50 px-3 py-2">
      <button onClick={toggle} className="grid h-9 w-9 place-items-center rounded-full bg-brand text-white" aria-label="Play voice note">
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <Waveform active={playing} bars={22} />
    </div>
  );
}

/** Hold-free recorder: tap to start, tap to stop. Uploads as VOICE media and returns its id. */
export function MicRecorder({
  onDone, size = 64, label,
}: { onDone: (mediaId: string, blob: Blob) => void; size?: number; label?: ReactNode }) {
  const [rec, setRec] = useState(false);
  const [busy, setBusy] = useState(false);
  const mr = useRef<MediaRecorder | null>(null);
  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks: Blob[] = [];
    const m = new MediaRecorder(stream);
    m.ondataavailable = (e) => chunks.push(e.data);
    m.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: m.mimeType || "audio/webm" });
      setBusy(true);
      try {
        const fd = new FormData();
        fd.append("kind", "VOICE");
        fd.append("file", blob, "voice.webm");
        const media = await post<{ id: string }>("/media", fd);
        onDone(media.id, blob);
      } finally {
        setBusy(false);
      }
    };
    m.start();
    mr.current = m;
    setRec(true);
    setTimeout(() => m.state === "recording" && m.stop(), 60_000);
  };
  const stop = () => {
    mr.current?.stop();
    setRec(false);
  };
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={rec ? stop : start}
        disabled={busy}
        className="relative grid place-items-center rounded-full bg-brand text-white"
        style={{ width: size, height: size }}
        aria-label={rec ? "Stop recording" : "Record voice"}
      >
        {rec && (
          <>
            <span className="pulse-ring absolute inset-0 rounded-full bg-ai" />
            <span className="pulse-ring absolute inset-0 rounded-full bg-ai [animation-delay:.8s]" />
          </>
        )}
        {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : rec ? <Square className="relative h-6 w-6 fill-white" /> : <Mic className="relative h-7 w-7" />}
      </button>
      {label}
    </div>
  );
}

export function DemoTag({ children = "Demo" }: { children?: ReactNode }) {
  return <span className="rounded-md bg-amber px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink">{children}</span>;
}
