"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { post } from "./api";

export type Line = { role: "assistant" | "user"; text: string };
type Status = "idle" | "connecting" | "live" | "ended" | "error";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
export const VAPI_WORKER = process.env.NEXT_PUBLIC_VAPI_WORKER_ASSISTANT_ID;
export const VAPI_CUSTOMER = process.env.NEXT_PUBLIC_VAPI_CUSTOMER_ASSISTANT_ID;
export const vapiEnabled = !!PUBLIC_KEY;

/**
 * Browser voice agent (Vapi). We keep the final transcript client-side so the flow also
 * works locally where Vapi can't reach our webhook; the webhook saves directly when deployed.
 */
export function useVapiCall(assistantId: string | undefined, purpose: "WORKER_ONBOARDING" | "CUSTOMER_BOOKING", onEnd?: (lines: Line[]) => void) {
  const vapi = useRef<any>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [partial, setPartial] = useState<Line | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string>();
  const linesRef = useRef<Line[]>([]);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => () => vapi.current?.stop(), []);

  const start = useCallback(async () => {
    if (!PUBLIC_KEY || !assistantId) {
      setError("Voice agent not configured");
      setStatus("error");
      return;
    }
    setError(undefined);
    setStatus("connecting");
    setLines([]);
    linesRef.current = [];
    try {
      const { voiceToken } = await post<{ voiceToken: string }>("/voice/session", { purpose });
      const { default: Vapi } = await import("@vapi-ai/web");
      const v = new Vapi(PUBLIC_KEY);
      vapi.current = v;
      v.on("call-start", () => setStatus("live"));
      v.on("speech-start", () => setSpeaking(true));
      v.on("speech-end", () => setSpeaking(false));
      v.on("message", (m: any) => {
        if (m.type !== "transcript") return;
        const line: Line = { role: m.role === "assistant" ? "assistant" : "user", text: m.transcript };
        if (m.transcriptType === "final") {
          linesRef.current = [...linesRef.current, line];
          setLines(linesRef.current);
          setPartial(null);
        } else {
          setPartial(line);
        }
      });
      v.on("call-end", () => {
        setStatus("ended");
        setSpeaking(false);
        onEndRef.current?.(linesRef.current);
      });
      v.on("error", (e: any) => {
        setError(e?.error?.message || e?.message || "Voice call failed");
        setStatus("error");
      });
      await v.start(assistantId, { variableValues: { voiceToken }, metadata: { voiceToken } } as any);
    } catch (e) {
      setError((e as Error).message || "Could not start the voice agent");
      setStatus("error");
    }
  }, [assistantId, purpose]);

  const stop = useCallback(() => vapi.current?.stop(), []);

  return { status, lines, partial, speaking, error, start, stop };
}

export const transcriptText = (lines: Line[]) =>
  lines.map((l) => `${l.role === "assistant" ? "Assistant" : "Worker"}: ${l.text}`).join("\n");
export const userText = (lines: Line[]) => lines.filter((l) => l.role === "user").map((l) => l.text).join(" ");
