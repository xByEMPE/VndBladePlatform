import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { SEV_HEX } from "./RotorDamageMap3D";

const FACES = [
  { key: "LE", stitched: "LeadingEdge" },
  { key: "PS", stitched: "PressureSide" },
  { key: "TE", stitched: "TrailingEdge" },
  { key: "SS", stitched: "SuctionSide" },
];

/**
 * Las 4 caras de una pala con su imagen stitched original (punta arriba, raíz abajo) y los daños
 * superpuestos según su radio. Si hay calibración (punta/raíz) se usa; si no, la imagen completa.
 */
export default function BladeFacesMap({ blade, urls = {}, calibrations = {}, items = [], bladeLength, onHover, onSelect, highlightId = null, height = 640 }) {
  const { t } = useTranslation();
  const [sizes, setSizes] = useState({}); // { LE: { w, h } }

  const yFrac = (face, s) => {
    const size = sizes[face.key];
    const cal = calibrations?.[face.stitched];
    if (size && cal && Number.isFinite(cal.tipY) && Number.isFinite(cal.rootY)) {
      return (cal.rootY - s * (cal.rootY - cal.tipY)) / size.h;
    }
    return 1 - s;
  };

  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="flex gap-3 overflow-x-auto rounded-md border border-white/10 bg-[#020409] p-3" style={{ minHeight: height }}>
      {/* Regla de radio */}
      <div className="relative w-12 shrink-0" style={{ height: height - 40, marginTop: 28 }} aria-hidden="true">
        {ticks.map((tick) => (
          <div key={tick} className="absolute right-0 flex -translate-y-1/2 items-center gap-1" style={{ top: `${(1 - tick) * 100}%` }}>
            <span className="text-[10px] tabular-nums text-slate-400">{Math.round(tick * bladeLength)} m</span>
            <span className="h-px w-2 bg-slate-500" />
          </div>
        ))}
      </div>

      {FACES.map((face) => {
        const url = urls?.[face.key];
        const own = items.filter((i) => i.section === face.key && Number.isFinite(i.s));
        const faceLabel = t(`reconstruction.section${face.key}`);
        return (
          <figure key={face.key} className="flex shrink-0 flex-col items-center">
            <figcaption className="mb-2 h-5 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
              {faceLabel} <span className="font-normal text-slate-500">· {own.length}</span>
            </figcaption>
            {url ? (
              <div className="relative inline-block" style={{ height: height - 40 }}>
                <img
                  src={url}
                  alt={t("reconstruction.stitchedAlt", { blade, face: faceLabel })}
                  crossOrigin="anonymous"
                  className="block h-full w-auto select-none rounded-sm"
                  draggable={false}
                  onLoad={(e) => {
                    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
                    setSizes((s) => ({ ...s, [face.key]: { w, h } }));
                  }}
                />
                {own.map((i) => (
                  <button
                    key={i.id}
                    data-damage-id={i.id}
                    type="button"
                    aria-label={t("reconstruction.damageAria", { sev: i.sev, radius: i.radiusM ?? 0 })}
                    onMouseMove={(e) => {
                      const r = e.currentTarget.closest("[data-faces-root]")?.getBoundingClientRect();
                      onHover?.(i, r ? { x: e.clientX - r.left, y: e.clientY - r.top } : { x: 0, y: 0 });
                    }}
                    onMouseLeave={() => onHover?.(null)}
                    onClick={() => onSelect?.(i)}
                    className={`absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/90 shadow-[0_0_0_2px_rgba(0,0,0,0.5)] transition-transform hover:scale-150 focus-visible:scale-150 focus-visible:outline-none ${
                      highlightId === i.id ? "z-10 scale-[1.8] animate-pulse" : ""
                    }`}
                    style={{
                      top: `${Math.min(99, Math.max(1, yFrac(face, i.s) * 100))}%`,
                      left: `${20 + i.u * 60}%`,
                      background: SEV_HEX[i.sev] || SEV_HEX[3],
                    }}
                  />
                ))}
              </div>
            ) : (
              <div
                className="flex w-24 items-center justify-center rounded-sm border border-dashed border-white/10 text-center text-[11px] text-slate-500"
                style={{ height: height - 40 }}
              >
                {t("reconstruction.noStitchedImage")}
              </div>
            )}
          </figure>
        );
      })}
    </div>
  );
}
