"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

async function raw(path: string, init: RequestInit = {}) {
  const isForm = init.body instanceof FormData;
  return fetch(`/api/v1${path}`, {
    ...init,
    credentials: "same-origin",
    headers: {
      "X-Requested-With": "roshan",
      ...(init.body && !isForm ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
}

/** Same-origin call to the backend (via the Next rewrite). Refreshes the session once on 401. */
export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await raw(path, init);
  if (res.status === 401 && !path.startsWith("/auth/")) {
    refreshing ??= raw("/auth/refresh", { method: "POST" }).then((r) => r.ok).finally(() => (refreshing = null));
    if (await refreshing) res = await raw(path, init);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.error?.code ?? "ERROR", body?.error?.message ?? "Something went wrong");
  }
  const type = res.headers.get("content-type") || "";
  return (type.includes("json") ? res.json() : res.blob()) as Promise<T>;
}

export const post = <T = any>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
export const patch = <T = any>(path: string, body: unknown) => api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
export const put = <T = any>(path: string, body: unknown) => api<T>(path, { method: "PUT", body: JSON.stringify(body) });

/** Tiny query hook with optional polling (plan §2: live updates by polling every 3 s). */
export function useApi<T = any>(path: string | null, pollMs?: number) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<ApiError | undefined>();
  const [loading, setLoading] = useState(!!path);
  const pathRef = useRef(path);
  pathRef.current = path;

  const load = useCallback(async () => {
    if (!pathRef.current) return;
    try {
      const d = await api<T>(pathRef.current);
      setData(d);
      setError(undefined);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!path) return;
    setLoading(true);
    load();
    if (!pollMs) return;
    const t = setInterval(load, pollMs);
    return () => clearInterval(t);
  }, [path, pollMs, load]);

  return { data, error, loading, reload: load, setData };
}

export const mediaUrl = (id?: string | null) => (id ? `/api/v1/media/${id}` : undefined);

export const TRADES = [
  { key: "ELECTRICIAN", en: "Electrician", ur: "الیکٹریشن", icon: "zap", tone: "bg-amber-50 text-[#B7791F]" },
  { key: "PLUMBER", en: "Plumber", ur: "پلمبر", icon: "droplet", tone: "bg-info-50 text-info" },
  { key: "AC_TECHNICIAN", en: "AC Technician", ur: "اے سی ٹیکنیشن", icon: "snowflake", tone: "bg-ai-50 text-ai" },
  { key: "CARPENTER", en: "Carpenter", ur: "بڑھئی", icon: "hammer", tone: "bg-busy-50 text-busy" },
  { key: "MECHANIC", en: "Mechanic", ur: "مکینک", icon: "car", tone: "bg-[#FFF8EC] text-ink" },
  { key: "PAINTER", en: "Painter", ur: "پینٹر", icon: "paint-roller", tone: "bg-brand-50 text-brand" },
] as const;

export const tradeName = (k?: string | null, lang: "en" | "ur" = "en") => TRADES.find((t) => t.key === k)?.[lang] ?? k ?? "";

export const SECTORS = ["G-8", "G-9", "G-10", "G-11", "F-7", "F-8", "F-10", "F-11", "E-11", "I-8", "I-10", "Blue Area", "Saddar", "Satellite Town", "Westridge", "Bahria Town", "DHA"];

export const rs = (n?: number | null) => (n == null ? "—" : `Rs ${n.toLocaleString("en-PK")}`);
export const initials = (name?: string | null) =>
  (name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
