"use client";

import React, { Suspense, useState, useRef, useEffect, useCallback, useMemo } from "react";
import { buildTokenCSS } from "@/lib/studio/token-to-css";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Node } from "@/lib/studio/types";

// -------------------------------------------------------------------------
// Device catalogue
// -------------------------------------------------------------------------

type DeviceType = "phone" | "tablet" | "desktop" | "responsive";

type Device = {
  id: string;
  label: string;
  width: number | null;   // null = full / responsive
  height: number | null;  // null = fill viewport
  type: DeviceType;
};

const DEVICE_GROUPS: { label: string; devices: Device[] }[] = [
  {
    label: "No device",
    devices: [
      { id: "responsive", label: "Responsive", width: null, height: null, type: "responsive" },
    ],
  },
  {
    label: "iPhone",
    devices: [
      { id: "iphone17",      label: "iPhone 17",          width: 402, height: 874, type: "phone" },
      { id: "iphone17pro",   label: "iPhone 17 Pro",      width: 402, height: 874, type: "phone" },
      { id: "iphone17promax",label: "iPhone 17 Pro Max",  width: 440, height: 956, type: "phone" },
      { id: "iphoneair",     label: "iPhone Air",         width: 420, height: 912, type: "phone" },
      { id: "iphone16",      label: "iPhone 16",          width: 393, height: 852, type: "phone" },
      { id: "iphone16pro",   label: "iPhone 16 Pro",      width: 402, height: 874, type: "phone" },
      { id: "iphone16promax",label: "iPhone 16 Pro Max",  width: 440, height: 956, type: "phone" },
      { id: "iphone16plus",  label: "iPhone 16 Plus",     width: 430, height: 932, type: "phone" },
      { id: "iphone15",      label: "iPhone 15",          width: 393, height: 852, type: "phone" },
      { id: "iphone15promax",label: "iPhone 15 Pro Max",  width: 430, height: 932, type: "phone" },
      { id: "iphone14",      label: "iPhone 14",          width: 390, height: 844, type: "phone" },
    ],
  },
  {
    label: "Android",
    devices: [
      { id: "android_compact", label: "Android Compact", width: 412, height: 917, type: "phone" },
      { id: "android_medium",  label: "Android Medium",  width: 700, height: 840, type: "tablet" },
    ],
  },
  {
    label: "iPad",
    devices: [
      { id: "ipad_mini",   label: "iPad Mini",    width: 744,  height: 1133, type: "tablet" },
      { id: "ipad",        label: "iPad",         width: 820,  height: 1180, type: "tablet" },
      { id: "ipad_pro_11", label: "iPad Pro 11″", width: 834,  height: 1194, type: "tablet" },
      { id: "ipad_pro_13", label: "iPad Pro 13″", width: 1024, height: 1366, type: "tablet" },
    ],
  },
  {
    label: "Desktop",
    devices: [
      { id: "macbook14",  label: "MacBook 14″",  width: 1512, height: null, type: "desktop" },
      { id: "desktop_hd", label: "Desktop HD",   width: 1440, height: null, type: "desktop" },
      { id: "desktop_xl", label: "Desktop XL",   width: 1920, height: null, type: "desktop" },
    ],
  },
];

const ALL_DEVICES = DEVICE_GROUPS.flatMap((g) => g.devices);
const DEFAULT_DEVICE_ID = "responsive";

// -------------------------------------------------------------------------
// DeviceChrome — phone/tablet bezel around the iframe (preview only)
// -------------------------------------------------------------------------

function DeviceChrome({
  device,
  children,
}: {
  device: Device;
  children: React.ReactNode;
}) {
  const isPhone = device.type === "phone";
  const isTablet = device.type === "tablet";
  const hasChrome = isPhone || isTablet;

  if (!hasChrome || !device.width || !device.height) {
    return <>{children}</>;
  }

  const w = device.width;
  const h = device.height;
  const chromeSide = isPhone ? 12 : 16;
  const chromeTop = isPhone ? 52 : 28;
  const chromeBottom = isPhone ? 28 : 20;
  const outerRadius = isPhone ? 44 : 22;
  const screenRadius = isPhone ? 40 : 16;

  return (
    <div
      style={{
        position: "relative",
        background: "#1a1a1a",
        borderRadius: outerRadius,
        padding: `${chromeTop}px ${chromeSide}px ${chromeBottom}px`,
        border: "1.5px solid #2e2e2e",
        boxShadow: "0 24px 64px rgba(0,0,0,0.6), inset 0 0 0 1px #2a2a2a",
        flexShrink: 0,
      }}
    >
      {/* Side buttons */}
      {isPhone && (
        <>
          <div style={{ position: "absolute", left: -3, top: 100, width: 3, height: 32, background: "#2e2e2e", borderRadius: "2px 0 0 2px" }} />
          <div style={{ position: "absolute", left: -3, top: 144, width: 3, height: 56, background: "#2e2e2e", borderRadius: "2px 0 0 2px" }} />
          <div style={{ position: "absolute", left: -3, top: 212, width: 3, height: 56, background: "#2e2e2e", borderRadius: "2px 0 0 2px" }} />
          <div style={{ position: "absolute", right: -3, top: 140, width: 3, height: 80, background: "#2e2e2e", borderRadius: "0 2px 2px 0" }} />
        </>
      )}
      {isTablet && (
        <>
          <div style={{ position: "absolute", right: -3, top: "50%", transform: "translateY(-50%)", width: 3, height: 60, background: "#2e2e2e", borderRadius: "0 2px 2px 0" }} />
        </>
      )}

      {/* Dynamic island (phone) / camera (tablet) */}
      {isPhone && (
        <div style={{
          position: "absolute",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          width: 100,
          height: 30,
          background: "#000",
          borderRadius: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
        }}>
          <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#111", border: "1px solid #222" }} />
          <div style={{ width: 30, height: 6, background: "#111", borderRadius: 3 }} />
        </div>
      )}
      {isTablet && (
        <div style={{
          position: "absolute",
          top: 10,
          left: "50%",
          transform: "translateX(-50%)",
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#2a2a2a",
          border: "1px solid #333",
        }} />
      )}

      {/* Home indicator */}
      <div style={{
        position: "absolute",
        bottom: isPhone ? 8 : 6,
        left: "50%",
        transform: "translateX(-50%)",
        width: isPhone ? 120 : 80,
        height: isPhone ? 5 : 4,
        background: "#3a3a3a",
        borderRadius: 3,
      }} />

      {/* Screen */}
      <div style={{
        width: w,
        height: h,
        borderRadius: screenRadius,
        overflow: "hidden",
        background: "#fff",
        position: "relative",
      }}>
        {children}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// Device picker dropdown
// -------------------------------------------------------------------------

const PHONE_ICON = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="1" width="8" height="14" rx="2"/>
    <circle cx="8" cy="12.5" r="0.6" fill="currentColor" stroke="none"/>
  </svg>
);
const TABLET_ICON = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="1" width="12" height="14" rx="2"/>
    <circle cx="8" cy="12.5" r="0.6" fill="currentColor" stroke="none"/>
  </svg>
);
const DESKTOP_ICON = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="2" width="14" height="10" rx="1.5"/>
    <path d="M5.5 12v2M10.5 12v2M4 14h8"/>
  </svg>
);
const RESPONSIVE_ICON = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="14" height="10" rx="1"/>
    <path d="M5 13v2M11 13v2M3 15h10"/>
  </svg>
);

function deviceIcon(type: DeviceType) {
  if (type === "phone") return PHONE_ICON;
  if (type === "tablet") return TABLET_ICON;
  if (type === "desktop") return DESKTOP_ICON;
  return RESPONSIVE_ICON;
}

function DevicePicker({
  selected,
  onSelect,
}: {
  selected: Device;
  onSelect: (d: Device) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          borderRadius: 7,
          border: "1px solid var(--s-border, rgba(255,255,255,0.1))",
          background: open ? "var(--s-bg-hover, rgba(255,255,255,0.1))" : "var(--s-bg-subtle, rgba(255,255,255,0.06))",
          color: "var(--s-text-sec, rgba(255,255,255,0.7))",
          fontSize: 12,
          fontWeight: 500,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {deviceIcon(selected.type)}
        <span>{selected.label}</span>
        {selected.width && (
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
            {selected.width}{selected.height ? ` × ${selected.height}` : ""}
          </span>
        )}
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6l4 4 4-4"/>
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            width: 280,
            background: "#1e1e1e",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            zIndex: 100,
            overflow: "hidden",
            maxHeight: "70vh",
            overflowY: "auto",
          }}
        >
          {DEVICE_GROUPS.map((group, gi) => (
            <div key={gi}>
              <div style={{
                padding: "8px 12px 4px",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.35)",
                borderTop: gi > 0 ? "1px solid rgba(255,255,255,0.06)" : undefined,
              }}>
                {group.label}
              </div>
              {group.devices.map((d) => {
                const isActive = d.id === selected.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => { onSelect(d); setOpen(false); }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "7px 12px",
                      border: "none",
                      background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                      color: isActive ? "#fff" : "rgba(255,255,255,0.65)",
                      fontSize: 12,
                      fontWeight: isActive ? 500 : 400,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ color: isActive ? "#fff" : "rgba(255,255,255,0.4)" }}>
                      {isActive ? (
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 8l4 4 6-7"/>
                        </svg>
                      ) : (
                        <span style={{ display: "inline-block", width: 11 }} />
                      )}
                    </span>
                    <span style={{ flex: 1 }}>{d.label}</span>
                    {d.width && (
                      <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
                        {d.width}{d.height ? ` × ${d.height}` : ""}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// Preview content
// -------------------------------------------------------------------------

// -------------------------------------------------------------------------
// Native device presets (mobile only)
// -------------------------------------------------------------------------

type NativeDevice = { id: string; label: string; width: number; height: number };

const NATIVE_DEVICE_GROUPS: { label: string; devices: NativeDevice[] }[] = [
  {
    label: "iPhone",
    devices: [
      { id: "iphone17",  label: "iPhone 17",   width: 402, height: 874 },
      { id: "iphone16",  label: "iPhone 16",   width: 393, height: 852 },
      { id: "iphone_se", label: "iPhone SE",   width: 375, height: 667 },
    ],
  },
  {
    label: "Android",
    devices: [
      { id: "android_compact", label: "Android Compact", width: 412, height: 917 },
      { id: "android_normal",  label: "Android Normal",  width: 360, height: 800 },
    ],
  },
  {
    label: "Tablet",
    devices: [
      { id: "ipad",     label: "iPad",           width: 820,  height: 1180 },
      { id: "ipad_pro", label: "iPad Pro 11\"",  width: 834,  height: 1194 },
    ],
  },
];

const ALL_NATIVE_DEVICES = NATIVE_DEVICE_GROUPS.flatMap((g) => g.devices);
const DEFAULT_NATIVE_DEVICE = ALL_NATIVE_DEVICES.find((d) => d.id === "iphone16")!;

// -------------------------------------------------------------------------
// Native device picker
// -------------------------------------------------------------------------

function NativeDevicePicker({
  selected,
  onSelect,
}: {
  selected: NativeDevice;
  onSelect: (d: NativeDevice) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "5px 10px", borderRadius: 7,
          border: "1px solid rgba(255,255,255,0.1)",
          background: open ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 500,
          cursor: "pointer", whiteSpace: "nowrap",
        }}
      >
        <svg width="10" height="12" viewBox="0 0 10 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="1" width="8" height="14" rx="2"/>
          <circle cx="5" cy="13" r="0.7" fill="currentColor" stroke="none"/>
        </svg>
        <span>{selected.label}</span>
        <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
          {selected.width} × {selected.height}
        </span>
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6l4 4 4-4"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 6px)",
          width: 260, background: "#1e1e1e",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          zIndex: 100, overflow: "hidden",
        }}>
          {NATIVE_DEVICE_GROUPS.map((grp, gi) => (
            <div key={gi}>
              <div style={{
                padding: "8px 12px 4px", fontSize: 10, fontWeight: 600,
                letterSpacing: "0.06em", textTransform: "uppercase",
                color: "rgba(255,255,255,0.35)",
                borderTop: gi > 0 ? "1px solid rgba(255,255,255,0.06)" : undefined,
              }}>
                {grp.label}
              </div>
              {grp.devices.map((d) => {
                const active = d.id === selected.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => { onSelect(d); setOpen(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      width: "100%", padding: "7px 12px", border: "none",
                      background: active ? "rgba(255,255,255,0.08)" : "transparent",
                      color: active ? "#fff" : "rgba(255,255,255,0.65)",
                      fontSize: 12, fontWeight: active ? 500 : 400,
                      cursor: "pointer", textAlign: "left",
                    }}
                  >
                    <span style={{ width: 11, color: "rgba(255,255,255,0.4)" }}>
                      {active ? (
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 8l4 4 6-7"/>
                        </svg>
                      ) : <span style={{ display: "inline-block", width: 11 }} />}
                    </span>
                    <span style={{ flex: 1 }}>{d.label}</span>
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
                      {d.width} × {d.height}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// PhoneFrame — clean viewport-fitting container
// -------------------------------------------------------------------------

function PhoneFrame({
  device,
  children,
}: {
  device: NativeDevice;
  children: React.ReactNode;
}) {
  const [scale, setScale] = useState(1);
  const TOPBAR_H = 48;
  const PAD_V = 48;
  const PAD_H = 80;

  // Outer shell dimensions include 12px bezel on each side
  const BEZEL = 14;
  const CORNER = 52;
  const outerW = device.width + BEZEL * 2;
  const outerH = device.height + BEZEL * 2;

  const recalc = useCallback(() => {
    const availH = window.innerHeight - TOPBAR_H - PAD_V * 2;
    const availW = window.innerWidth - PAD_H * 2;
    const s = Math.min(availH / outerH, availW / outerW, 1);
    setScale(Math.max(s, 0.3));
  }, [outerW, outerH]);

  useEffect(() => {
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [recalc]);

  const isTablet = device.width >= 700;
  const screenCorner = CORNER - BEZEL;

  return (
    <div style={{
      width: outerW * scale,
      height: outerH * scale,
      flexShrink: 0,
    }}>
      <div style={{
        width: outerW,
        height: outerH,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        borderRadius: CORNER,
        background: "#1c1c1e",
        boxShadow: "0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.04)",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Side buttons — left */}
        <div style={{ position: "absolute", left: -2, top: 96, width: 3, height: 28, background: "#3a3a3c", borderRadius: "2px 0 0 2px" }} />
        <div style={{ position: "absolute", left: -2, top: 138, width: 3, height: 52, background: "#3a3a3c", borderRadius: "2px 0 0 2px" }} />
        <div style={{ position: "absolute", left: -2, top: 204, width: 3, height: 52, background: "#3a3a3c", borderRadius: "2px 0 0 2px" }} />
        {/* Side button — right (power) */}
        <div style={{ position: "absolute", right: -2, top: 148, width: 3, height: 68, background: "#3a3a3c", borderRadius: "0 2px 2px 0" }} />

        {/* Screen area */}
        <div style={{
          position: "absolute",
          top: BEZEL, left: BEZEL,
          width: device.width,
          height: device.height,
          borderRadius: screenCorner,
          overflow: "hidden",
          background: "#fff",
        }}>
          {/* Status bar area with dynamic island */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0,
            height: 54, zIndex: 10,
            display: "flex", alignItems: "flex-start", justifyContent: "center",
            paddingTop: 12,
            pointerEvents: "none",
          }}>
            {!isTablet && (
              <div style={{
                width: 120, height: 34,
                background: "#000", borderRadius: 20,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#111", border: "1.5px solid #222" }} />
                <div style={{ width: 32, height: 6, background: "#111", borderRadius: 4 }} />
              </div>
            )}
          </div>

          {/* Content — padded top to clear dynamic island */}
          <div style={{ paddingTop: 54, width: "100%", height: "100%", overflow: "hidden", boxSizing: "border-box" }}>
            {children}
          </div>

          {/* Home indicator */}
          <div style={{
            position: "absolute", bottom: 8, left: "50%",
            transform: "translateX(-50%)",
            width: isTablet ? 80 : 134,
            height: 5,
            background: "rgba(0,0,0,0.18)",
            borderRadius: 3,
            pointerEvents: "none",
          }} />
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// NativePreviewRenderer — walks node tree, outputs HTML+CSS
// No editor store dependency, no DnD.
// -------------------------------------------------------------------------

const GAP_MAP: Record<string, number> = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
const PAD_MAP: Record<string, number> = { xs: 8, sm: 12, md: 16, lg: 24, xl: 32 };

function resolveGap(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return GAP_MAP[v] ?? 16;
  return 16;
}
function resolvePad(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return PAD_MAP[v] ?? 0;
  return 0;
}

function NativeNode({ node }: { node: Node }) {
  const props = node.props ?? {};
  const style = node.style ?? {};
  const children = node.children ?? [];

  // Merge node.style into inline CSS (best-effort)
  const baseStyle: React.CSSProperties = {
    ...(style.color ? { color: style.color as string } : {}),
    ...(style.backgroundColor ? { backgroundColor: style.backgroundColor as string } : {}),
    ...(style.fontSize ? { fontSize: style.fontSize as string | number } : {}),
    ...(style.fontWeight ? { fontWeight: style.fontWeight as string | number } : {}),
    ...(style.borderRadius ? { borderRadius: style.borderRadius as string | number } : {}),
    ...(style.padding ? { padding: style.padding as string } : {}),
    ...(style.paddingTop ? { paddingTop: style.paddingTop as string } : {}),
    ...(style.paddingRight ? { paddingRight: style.paddingRight as string } : {}),
    ...(style.paddingBottom ? { paddingBottom: style.paddingBottom as string } : {}),
    ...(style.paddingLeft ? { paddingLeft: style.paddingLeft as string } : {}),
    ...(style.margin ? { margin: style.margin as string } : {}),
    ...(style.marginTop ? { marginTop: style.marginTop as string } : {}),
    ...(style.marginRight ? { marginRight: style.marginRight as string } : {}),
    ...(style.marginBottom ? { marginBottom: style.marginBottom as string } : {}),
    ...(style.marginLeft ? { marginLeft: style.marginLeft as string } : {}),
    ...(style.width ? { width: style.width as string | number } : {}),
    ...(style.height ? { height: style.height as string | number } : {}),
    ...(style.opacity !== undefined ? { opacity: style.opacity as number } : {}),
  };

  switch (node.type) {
    case "Stack": {
      const dir = props.direction === "row" ? "row" : "column";
      const gap = resolveGap(props.gap);
      const pad = resolvePad(props.padding);
      return (
        <div style={{ display: "flex", flexDirection: dir, gap, padding: pad || undefined, ...baseStyle }}>
          {children.map((c) => <NativeNode key={c.id} node={c} />)}
        </div>
      );
    }

    case "Grid": {
      const gap = resolveGap(props.gap);
      const cols = typeof props.columns === "number" ? props.columns : 2;
      return (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap, ...baseStyle }}>
          {children.map((c) => <NativeNode key={c.id} node={c} />)}
        </div>
      );
    }

    case "Section": {
      const pad = resolvePad(props.padding);
      return (
        <div style={{ width: "100%", padding: pad || undefined, ...baseStyle }}>
          {children.map((c) => <NativeNode key={c.id} node={c} />)}
        </div>
      );
    }

    case "ScrollArea":
      return (
        <div style={{ overflowY: "auto", WebkitOverflowScrolling: "touch", ...baseStyle }}>
          {children.map((c) => <NativeNode key={c.id} node={c} />)}
        </div>
      );

    case "Spacer": {
      const sz = resolvePad(props.size);
      return <div style={{ height: sz, flexShrink: 0 }} />;
    }

    case "Heading": {
      const level = typeof props.level === "number" ? Math.min(Math.max(props.level, 1), 6) : 1;
      const sizes = [32, 28, 24, 20, 18, 16];
      const fontSize = sizes[level - 1];
      const text = String(props.text ?? "");
      return (
        <div style={{ fontSize, fontWeight: 700, lineHeight: 1.2, ...baseStyle }}>
          {text}
        </div>
      );
    }

    case "Text": {
      const text = String(props.text ?? "");
      const muted = props.variant === "muted";
      return (
        <div style={{ fontSize: 14, color: muted ? "#6b7280" : undefined, lineHeight: 1.5, ...baseStyle }}>
          {text}
        </div>
      );
    }

    case "Button": {
      const label = String(props.label ?? "Button");
      const variant = typeof props.intent === "string" ? props.intent : "primary";
      const isPrimary = variant !== "outline" && variant !== "ghost";
      return (
        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          padding: "10px 20px", borderRadius: 8, cursor: "default",
          background: isPrimary ? "#2563eb" : "transparent",
          color: isPrimary ? "#fff" : "#2563eb",
          border: variant === "outline" ? "1px solid #2563eb" : "none",
          fontSize: 14, fontWeight: 600,
          ...baseStyle,
        }}>
          {label}
        </div>
      );
    }

    case "Input": {
      const placeholder = String(props.placeholder ?? "");
      const label = typeof props.label === "string" ? props.label : null;
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, ...baseStyle }}>
          {label && <div style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{label}</div>}
          <div style={{
            padding: "10px 12px", fontSize: 14, color: "#9ca3af",
            border: "1px solid #d1d5db", borderRadius: 8, background: "#fff",
          }}>
            {placeholder || "\u00a0"}
          </div>
        </div>
      );
    }

    case "Card": {
      const pad = resolvePad(props.padding) || 16;
      return (
        <div style={{
          background: "#fff", borderRadius: 12, padding: pad,
          border: "1px solid #e5e7eb",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          ...baseStyle,
        }}>
          {children.map((c) => <NativeNode key={c.id} node={c} />)}
        </div>
      );
    }

    case "Image": {
      const src = String(props.src ?? "");
      const w = typeof props.width === "number" ? props.width : "100%";
      const h = typeof props.height === "number" ? props.height : 160;
      if (!src) {
        return (
          <div style={{
            width: w, height: h, background: "#f3f4f6", borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            ...baseStyle,
          }}>
            <div style={{ width: 28, height: 28, opacity: 0.3 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <path d="m21 15-5-5L5 21"/>
              </svg>
            </div>
          </div>
        );
      }
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={String(props.alt ?? "")} style={{ width: w, height: h, objectFit: "cover", borderRadius: 8, display: "block", ...baseStyle }} />
      );
    }

    case "Divider":
      return <div style={{ height: 1, background: "#e5e7eb", width: "100%", ...baseStyle }} />;

    case "List": {
      const items = Array.isArray(props.items) ? props.items : [];
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, ...baseStyle }}>
          {items.map((item, i) => (
            <div key={i} style={{ fontSize: 14, color: "#374151" }}>
              • {String(item)}
            </div>
          ))}
        </div>
      );
    }

    case "Nav": {
      const items = Array.isArray(props.items) ? props.items : [];
      const isVertical = props.orientation === "vertical";
      return (
        <div style={{ display: "flex", flexDirection: isVertical ? "column" : "row", gap: 4, ...baseStyle }}>
          {items.map((item, i) => {
            const str = String(item);
            const label = str.includes("|") ? str.split("|")[0] : str;
            return (
              <div key={i} style={{ padding: "6px 12px", fontSize: 14, color: "#374151", borderRadius: 6 }}>
                {label}
              </div>
            );
          })}
          {children.map((c) => <NativeNode key={c.id} node={c} />)}
        </div>
      );
    }

    case "Tabs": {
      const tabs = Array.isArray(props.tabs) ? props.tabs.map(String) : ["Tab 1", "Tab 2"];
      return (
        <div style={{ ...baseStyle }}>
          <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb" }}>
            {tabs.map((tab, i) => (
              <div key={i} style={{
                padding: "8px 16px", fontSize: 14, cursor: "default",
                color: i === 0 ? "#2563eb" : "#6b7280",
                fontWeight: i === 0 ? 500 : 400,
                borderBottom: i === 0 ? "2px solid #2563eb" : "2px solid transparent",
                marginBottom: -1,
              }}>
                {tab}
              </div>
            ))}
          </div>
          <div style={{ paddingTop: 12 }}>
            {children.slice(0, 1).map((c) => <NativeNode key={c.id} node={c} />)}
          </div>
        </div>
      );
    }

    case "Frame": {
      const dir = props.direction === "row" ? "row" : "column";
      const gap = resolveGap(props.gap);
      const fill = typeof props.fill === "string" ? props.fill : undefined;
      const stroke = typeof props.stroke === "string" ? props.stroke : undefined;
      const sw = typeof props.strokeWidth === "number" ? props.strokeWidth : 0;
      const cr = typeof props.cornerRadius === "number" ? props.cornerRadius : 0;
      return (
        <div style={{
          display: "flex", flexDirection: dir, gap,
          ...(fill ? { background: fill } : {}),
          ...(stroke && sw ? { border: `${sw}px solid ${stroke}` } : {}),
          ...(cr ? { borderRadius: cr } : {}),
          ...(props.clip ? { overflow: "hidden" } : {}),
          ...baseStyle,
        }}>
          {children.map((c) => <NativeNode key={c.id} node={c} />)}
        </div>
      );
    }

    case "Rectangle": {
      const fill = typeof props.fill === "string" ? props.fill : "#D9D9D9";
      const stroke = typeof props.stroke === "string" ? props.stroke : undefined;
      const sw = typeof props.strokeWidth === "number" ? props.strokeWidth : 0;
      const cr = typeof props.cornerRadius === "number" ? props.cornerRadius : 0;
      return (
        <div style={{
          background: fill,
          ...(stroke && sw ? { border: `${sw}px solid ${stroke}` } : {}),
          ...(cr ? { borderRadius: cr } : {}),
          ...baseStyle,
        }}>
          {children.map((c) => <NativeNode key={c.id} node={c} />)}
        </div>
      );
    }

    case "Ellipse": {
      const fill = typeof props.fill === "string" ? props.fill : "#D9D9D9";
      const stroke = typeof props.stroke === "string" ? props.stroke : undefined;
      const sw = typeof props.strokeWidth === "number" ? props.strokeWidth : 0;
      return (
        <div style={{
          background: fill, borderRadius: "50%",
          ...(stroke && sw ? { border: `${sw}px solid ${stroke}` } : {}),
          ...baseStyle,
        }} />
      );
    }

    default:
      return (
        <div style={{
          border: "1px dashed #d1d5db", borderRadius: 4, padding: 8,
          fontSize: 12, color: "#9ca3af", ...baseStyle,
        }}>
          {`<${node.type}>`}
          {children.map((c) => <NativeNode key={c.id} node={c} />)}
        </div>
      );
  }
}

function NativePreviewRenderer({ spec }: { spec: { tree: Node } }) {
  return (
    <div style={{ width: "100%", height: "100%", overflowY: "auto", overflowX: "hidden", background: "#fff" }}>
      <NativeNode node={spec.tree} />
    </div>
  );
}

// -------------------------------------------------------------------------
// Expo / React Native preview content
// -------------------------------------------------------------------------

function ExpoPreviewContent({
  screen,
  projectId,
  returnTo,
}: {
  screen: string;
  projectId: string | null;
  returnTo: string;
}) {
  const [device, setDevice] = useState<NativeDevice>(DEFAULT_NATIVE_DEVICE);
  const [spec, setSpec] = useState<{ tree: Node } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = projectId
      ? `/api/studio/screens/${encodeURIComponent(screen)}?projectId=${encodeURIComponent(projectId)}`
      : `/api/studio/screens/${encodeURIComponent(screen)}`;
    fetch(url)
      .then((r) => r.json())
      .then((d: { spec?: { tree: Node }; error?: string }) => {
        if (d.error) { setError(d.error); }
        else if (d.spec) { setSpec(d.spec); }
        else { setError("No spec returned"); }
      })
      .catch(() => setError("Failed to load screen"))
      .finally(() => setLoading(false));
  }, [screen, projectId]);

  const canvasBg = "#1a1a1a";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: canvasBg, fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>

      {/* Topbar */}
      <div style={{
        height: 48, flexShrink: 0,
        display: "flex", alignItems: "center", gap: 8, padding: "0 12px",
        background: "#111",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        zIndex: 10,
      }}>
        <div style={{ width: 22, height: 22, borderRadius: 5, background: "var(--s-accent, #7c3aed)", color: "#fff", fontSize: 12, fontWeight: 800, letterSpacing: -1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          S
        </div>
        <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.1)", margin: "0 2px", flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 500, color: "#e5e5e5", marginRight: 4 }}>{screen}</span>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <NativeDevicePicker selected={device} onSelect={setDevice} />
          <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
          <Link href={returnTo} style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "5px 10px", borderRadius: 6,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 500, textDecoration: "none",
          }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 12L6 8l4-4"/>
            </svg>
            Back to Editor
          </Link>
        </div>
      </div>

      {/* Canvas — phone frame centred */}
      <div style={{
        flex: 1, overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "56px 32px",
      }}>
        {loading && (
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Loading screen…</div>
        )}
        {error && !loading && (
          <div style={{ color: "#f87171", fontSize: 13 }}>Error: {error}</div>
        )}
        {spec && !loading && (
          <PhoneFrame device={device}>
            <NativePreviewRenderer spec={spec} />
          </PhoneFrame>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// Web preview content
// -------------------------------------------------------------------------

function PreviewContent() {
  const searchParams = useSearchParams();
  const route = searchParams.get("route") ?? "/";
  const screen = searchParams.get("screen") ?? "Preview";
  const returnTo = searchParams.get("returnTo") ?? "/studio";
  const framework = searchParams.get("framework") ?? "";
  const projectId = searchParams.get("projectId");
  const dsId = searchParams.get("dsId");

  const [selectedDevice, setSelectedDevice] = useState<Device>(
    () => ALL_DEVICES.find((d) => d.id === DEFAULT_DEVICE_ID) ?? ALL_DEVICES[0]
  );

  // Fetch DS tokens and build CSS string for the preview iframe
  const [previewTokenCSS, setPreviewTokenCSS] = useState<string | null>(null);
  useEffect(() => {
    if (!dsId) return;
    fetch(`/api/studio/design-systems/${dsId}`)
      .then((r) => r.json())
      .then((data) => {
        const ds = data.designSystem ?? data;
        const raw = ds?.tokens?.raw ?? ds?.tokens;
        if (!raw || typeof raw !== "object") return;
        setPreviewTokenCSS(buildTokenCSS(raw as Record<string, unknown>, ":root"));
      })
      .catch(() => {});
  }, [dsId]);

  // Ref shared across both iframe elements; re-sends CSS on each load event
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sendTokens = useCallback(() => {
    if (!previewTokenCSS || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      { type: "studio:previewTokens", css: previewTokenCSS },
      "*"
    );
  }, [previewTokenCSS]);

  // React Native / Expo projects → render spec directly in a clean phone frame
  if (framework === "expo") {
    return <ExpoPreviewContent screen={screen} projectId={projectId} returnTo={returnTo} />;
  }

  const hasChrome = selectedDevice.type === "phone" || selectedDevice.type === "tablet";
  const iframeWidth = selectedDevice.width ?? "100%";
  const iframeHeight = selectedDevice.height ?? "calc(100vh - 48px)";
  const canvasBg = selectedDevice.type === "responsive" ? "var(--s-bg-base, #0f0f0f)" : "#2a2a2a";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: canvasBg, fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>

      {/* ── Topbar ──────────────────────────────────────────────────────────── */}
      <div style={{
        height: 48, flexShrink: 0,
        display: "flex", alignItems: "center", gap: 8, padding: "0 12px",
        background: "var(--s-bg-panel, #1a1a1a)",
        borderBottom: "1px solid var(--s-border, rgba(255,255,255,0.08))",
        zIndex: 10,
      }}>
        {/* Logo */}
        <div style={{ width: 22, height: 22, borderRadius: 5, background: "var(--s-accent, #7c3aed)", color: "#fff", fontSize: 12, fontWeight: 800, letterSpacing: -1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          S
        </div>
        <div style={{ width: 1, height: 18, background: "var(--s-border, rgba(255,255,255,0.1))", margin: "0 2px", flexShrink: 0 }} />

        {/* Screen name */}
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--s-text-pri, #e5e5e5)", marginRight: 4 }}>{screen}</span>
        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(124,58,237,0.18)", color: "var(--s-accent, #7c3aed)", fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase" }}>
          Preview
        </span>

        {/* Device picker */}
        <div style={{ marginLeft: "auto" }}>
          <DevicePicker selected={selectedDevice} onSelect={setSelectedDevice} />
        </div>

        <div style={{ width: 1, height: 18, background: "var(--s-border, rgba(255,255,255,0.1))", margin: "0 4px", flexShrink: 0 }} />

        {/* Back to editor */}
        <Link href={returnTo} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, background: "var(--s-bg-subtle, rgba(255,255,255,0.06))", border: "1px solid var(--s-border, rgba(255,255,255,0.1))", color: "var(--s-text-sec, rgba(255,255,255,0.7))", fontSize: 12, fontWeight: 500, textDecoration: "none" }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12L6 8l4-4"/>
          </svg>
          Back to Editor
        </Link>
      </div>

      {/* ── Preview canvas ──────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, overflow: "auto",
        display: "flex", alignItems: hasChrome ? "flex-start" : "stretch", justifyContent: "center",
        padding: hasChrome ? "48px 32px" : 0,
      }}>
        {hasChrome ? (
          <DeviceChrome device={selectedDevice}>
            <iframe
              ref={iframeRef}
              src={route}
              title={screen}
              onLoad={sendTokens}
              style={{ width: "100%", height: "100%", border: "none", display: "block" }}
            />
          </DeviceChrome>
        ) : (
          <div style={{
            width: iframeWidth,
            flexShrink: 0,
            background: "#fff",
            borderRadius: selectedDevice.width ? 8 : 0,
            overflow: "hidden",
            boxShadow: selectedDevice.width ? "0 8px 32px rgba(0,0,0,0.3)" : "none",
            display: "flex",
            flexDirection: "column",
            minHeight: `calc(100vh - 48px)`,
          }}>
            <iframe
              ref={iframeRef}
              src={route}
              title={screen}
              onLoad={sendTokens}
              style={{ width: "100%", flex: 1, border: "none", minHeight: iframeHeight }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// Page export
// -------------------------------------------------------------------------

export default function PreviewPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0f0f0f", color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
        Loading preview...
      </div>
    }>
      <PreviewContent />
    </Suspense>
  );
}
