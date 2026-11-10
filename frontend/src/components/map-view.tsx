"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef } from "react";

export type Pin = { id: string; lat: number; lng: number; label: string; tone?: "free" | "busy" | "you" | "job"; onClick?: () => void };

const TONE = {
  free: "background:#14152B;color:#fff",
  busy: "background:#F97316;color:#fff",
  you: "background:#2F6FED;color:#fff",
  job: "background:#FFB703;color:#14152B",
};

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/** Mapbox map with pill markers (workers free/busy, "You", job location). */
export function MapView({ pins, center, zoom = 12.5, className = "h-[420px]" }: { pins: Pin[]; center?: [number, number]; zoom?: number; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const lib = useRef<any>(null);

  useEffect(() => {
    if (!TOKEN || !el.current) return;
    let cancelled = false;
    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (cancelled || !el.current) return;
      lib.current = mapboxgl;
      mapboxgl.accessToken = TOKEN;
      const c = center ?? (pins[0] ? [pins[0].lat, pins[0].lng] : [33.6845, 73.0136]);
      map.current = new mapboxgl.Map({
        container: el.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [c[1], c[0]],
        zoom,
        attributionControl: false,
        cooperativeGestures: true,
      });
      map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      map.current.on("load", () => draw());
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draw = () => {
    const mapboxgl = lib.current;
    if (!mapboxgl || !map.current) return;
    markers.current.forEach((m) => m.remove());
    markers.current = pins.map((p) => {
      const node = document.createElement("button");
      node.setAttribute("style", `${TONE[p.tone ?? "free"]};padding:4px 10px;border-radius:999px;font:600 12px var(--font-jakarta),sans-serif;box-shadow:0 6px 20px -4px rgba(16,24,40,.25);white-space:nowrap;cursor:pointer`);
      node.textContent = p.label;
      if (p.onClick) node.onclick = p.onClick;
      return new mapboxgl.Marker({ element: node }).setLngLat([p.lng, p.lat]).addTo(map.current);
    });
    if (pins.length > 1) {
      const b = new mapboxgl.LngLatBounds();
      pins.forEach((p) => b.extend([p.lng, p.lat]));
      map.current.fitBounds(b, { padding: 60, maxZoom: 14, duration: 0 });
    }
  };

  const key = pins.map((p) => `${p.id}:${p.tone}:${p.lat.toFixed(4)}`).join("|");
  useEffect(() => {
    if (map.current?.loaded()) draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!TOKEN) return <div className={`grid place-items-center rounded-3xl bg-brand-50 text-sm text-ink-2 ${className}`}>Map unavailable</div>;
  return <div ref={el} className={`overflow-hidden rounded-3xl ${className}`} />;
}
