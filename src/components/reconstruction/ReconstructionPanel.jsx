import React, { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Columns, Crosshair, MousePointerClick, RotateCcw } from "lucide-react";
import RotorDamageMap3D, { SEV_HEX } from "./RotorDamageMap3D";
import BladeFacesMap from "./BladeFacesMap";
import { SEV, OVERLINE, FOCUS } from "@/components/reportViewer/viewerKit";

const PANEL = "rounded-md border border-white/10 bg-slate-900/70";
const BLADE_CLOCK = { A: "12 h", B: "4 h", C: "8 h" };

const numLocale = (i18n) => (i18n.language?.startsWith("en") ? "en-US" : "es-MX");
const fmtMm = (v, loc) => (Number(v) > 0 ? `${Number(v).toLocaleString(loc, { maximumFractionDigits: 0 })} mm` : "—");
const fmtM = (v, loc, noRadius) => (Number.isFinite(v) ? `${v.toLocaleString(loc, { maximumFractionDigits: 2 })} m` : noRadius);

const Chip = ({ active, onClick, children, color, title }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    title={title}
    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold tabular-nums transition-colors ${FOCUS} ${
      active ? "border-amber-500/50 bg-amber-500/10 text-amber-300" : "border-white/10 text-slate-400 hover:border-white/25 hover:text-white"
    }`}
  >
    {color && <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: color, opacity: active ? 1 : 0.4 }} />}
    {children}
  </button>
);

/** Miniatura de la foto del daño con su recuadro (bbox normalizado [x, y, w, h]) */
const DamageThumb = ({ item }) => {
  const [src, setSrc] = useState(item.thumbUrl || item.imageUrl);
  if (!src) return null;
  const bb = item.bbox;
  return (
    <div className="relative mb-2 overflow-hidden rounded-sm bg-black">
      <img
        key={src}
        src={src}
        alt=""
        className="block h-auto w-full"
        onError={() => setSrc((cur) => (cur !== item.imageUrl ? item.imageUrl : null))}
      />
      {bb && (
        <span
          aria-hidden="true"
          className="absolute rounded-[2px] border-2"
          style={{
            left: `${bb[0] * 100}%`,
            top: `${bb[1] * 100}%`,
            width: `${bb[2] * 100}%`,
            height: `${bb[3] * 100}%`,
            borderColor: SEV_HEX[item.sev] || SEV_HEX[3],
            boxShadow: "0 0 0 1px rgba(0,0,0,0.6)",
          }}
        />
      )}
    </div>
  );
};

/** Ficha del daño (tooltip del 3D y fila de la lista comparten estos datos) */
const DamageFacts = ({ item }) => {
  const { t, i18n } = useTranslation();
  const loc = numLocale(i18n);
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
      <dt className="text-slate-400">{t("reconstruction.radius")}</dt>
      <dd className="text-right tabular-nums text-white">{fmtM(item.radiusM, loc, t("reconstruction.noRadius"))}</dd>
      <dt className="text-slate-400">{t("reconstruction.longitudinal")}</dt>
      <dd className="text-right tabular-nums text-white">{fmtMm(item.lengthMm, loc)}</dd>
      <dt className="text-slate-400">{t("reconstruction.transversal")}</dt>
      <dd className="text-right tabular-nums text-white">{fmtMm(item.widthMm, loc)}</dd>
    </dl>
  );
};

/**
 * Pestaña Reconstrucción: rotor 3D con las caras de cada pala (imágenes stitched) y los daños
 * ubicados por radio y cara. Hover = ficha rápida; clic = abre el Damage Editor.
 *
 * items: [{ id, blade: "A", section: "LE", s, u, sev, radiusM, lengthMm, widthMm, typeLabel, raw }]
 */
export default function ReconstructionPanel({ items, bladeLength, stitchedUrls, calibrations, onOpenDamage }) {
  const { t, i18n } = useTranslation();
  const loc = numLocale(i18n);
  const sectionLabel = (key) => t(`reconstruction.section${key}`, { defaultValue: key });
  const noRadius = t("reconstruction.noRadius");
  const [focusBlade, setFocusBlade] = useState(null);
  const [sevFilter, setSevFilter] = useState(null); // null = todas; n = solo esa categoría
  const visibleSev = useMemo(() => (sevFilter ? [sevFilter] : [1, 2, 3, 4, 5]), [sevFilter]);
  const showTextures = false;
  const [mode, setMode] = useState("3d"); // "3d" | "faces"
  const viewerRef = useRef(null);
  const [hover, setHover] = useState(null); // { item, x, y }
  const [listHover, setListHover] = useState(null);
  const [listPos, setListPos] = useState(null); // posición en pantalla del daño resaltado desde la lista
  const [viewKey, setViewKey] = useState(0);

  // En la vista de caras siempre hay una pala seleccionada
  const activeBlade = mode === "faces" ? focusBlade || "A" : focusBlade;
  const visibleBlades = useMemo(() => (activeBlade ? [activeBlade] : ["A", "B", "C"]), [activeBlade]);
  const placed = useMemo(() => items.filter((i) => Number.isFinite(i.s)), [items]);

  const listed = useMemo(
    () =>
      items
        .filter((i) => visibleBlades.includes(i.blade) && visibleSev.includes(i.sev))
        .sort((a, b) => b.sev - a.sev || (b.radiusM ?? -1) - (a.radiusM ?? -1)),
    [items, visibleBlades, visibleSev],
  );
  const withoutRadius = listed.filter((i) => !Number.isFinite(i.s)).length;

  const sevCounts = useMemo(() => {
    const c = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    items.filter((i) => visibleBlades.includes(i.blade)).forEach((i) => (c[i.sev] = (c[i.sev] || 0) + 1));
    return c;
  }, [items, visibleBlades]);

  const bladeStats = useMemo(
    () =>
      ["A", "B", "C"].map((b) => {
        const own = items.filter((i) => i.blade === b);
        return { blade: b, total: own.length, worst: own.reduce((m, i) => Math.max(m, i.sev), 0) };
      }),
    [items],
  );


  const hasStitched = Object.keys(stitchedUrls || {}).length > 0;

  // Ficha visible: la del punto bajo el cursor o, al pasar por la lista, la del daño resaltado
  const listItem = listHover ? items.find((i) => i.id === listHover) : null;
  let tip = hover;
  if (!tip && listItem) {
    let pos = mode === "3d" ? listPos : null;
    if (mode === "faces" && viewerRef.current) {
      const el = viewerRef.current.querySelector(`[data-damage-id="${listItem.id}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        const v = viewerRef.current.getBoundingClientRect();
        pos = { x: r.left + r.width / 2 - v.left, y: r.top + r.height / 2 - v.top };
      }
    }
    // Sin posición (daño sin radio o de otra pala): la ficha se muestra en la esquina del visor
    tip = { item: listItem, ...(pos || { x: 16, y: 16 }) };
  }

  return (
    <div className="space-y-4">
      {/* Encabezado y controles */}
      <div className={`${PANEL} flex flex-col gap-4 p-4 lg:flex-row lg:items-end lg:justify-between`}>
        <div className="min-w-0">
          <p className={OVERLINE}>{t("reconstruction.overline")}</p>
          <h3 className="mt-1 text-base font-semibold text-white">{t("reconstruction.title")}</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">{t("reconstruction.description")}</p>
        </div>
        <div className="flex flex-col gap-2 lg:items-end">
          <div role="group" aria-label={t("reconstruction.viewMode")} className="flex flex-wrap gap-1.5">
            <Chip active={mode === "3d"} onClick={() => setMode("3d")} title={t("reconstruction.model3dTitle")}>
              <Box className="h-3.5 w-3.5" aria-hidden="true" /> {t("reconstruction.model3d")}
            </Chip>
            <Chip active={mode === "faces"} onClick={() => setMode("faces")} title={t("reconstruction.facesTitle")}>
              <Columns className="h-3.5 w-3.5" aria-hidden="true" /> {t("reconstruction.faces")}
            </Chip>
          </div>
          <div role="group" aria-label={t("reconstruction.bladeGroup")} className="flex flex-wrap gap-1.5">
            {mode === "3d" && (
              <Chip active={!focusBlade} onClick={() => setFocusBlade(null)}>
                {t("reconstruction.rotor")}
              </Chip>
            )}
            {["A", "B", "C"].map((b) => (
              <Chip key={b} active={activeBlade === b} onClick={() => setFocusBlade(b)} title={t("reconstruction.bladePosition", { blade: b, clock: BLADE_CLOCK[b] })}>
                {t("reconstruction.blade", { blade: b })} <span className="font-normal opacity-70">{BLADE_CLOCK[b]}</span>
              </Chip>
            ))}
          </div>
          <div className={`flex flex-wrap gap-1.5 ${mode === "3d" ? "" : "hidden"}`}>
            {/* Texturas stitched en 3D desactivadas: el recorte automático de la pala no es fiable */}
            <Chip active={false} onClick={() => setViewKey((k) => k + 1)} title={t("reconstruction.resetViewTitle")}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> {t("reconstruction.resetView")}
            </Chip>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Visor 3D */}
        <section ref={viewerRef} data-faces-root aria-label={t("reconstruction.viewerAria")} className="relative xl:col-span-8">
          {mode === "faces" ? (
            <BladeFacesMap
              blade={activeBlade}
              urls={stitchedUrls?.[activeBlade]}
              calibrations={calibrations?.[activeBlade]}
              items={items.filter((i) => i.blade === activeBlade && visibleSev.includes(i.sev))}
              bladeLength={bladeLength}
              onHover={(d, pos) => setHover(d ? { item: d, ...pos } : null)}
              onSelect={(d) => onOpenDamage(d.raw)}
              highlightId={listHover}
              height={640}
            />
          ) : (
          <RotorDamageMap3D
            key={viewKey}
            bladeLength={bladeLength}
            stitchedUrls={stitchedUrls}
            calibrations={calibrations}
            damages={placed}
            visibleBlades={visibleBlades}
            visibleSev={visibleSev}
            showTextures={showTextures}
            highlightId={listHover}
            focusBlade={focusBlade}
            onHover={(d, pos) => setHover(d ? { item: d, ...pos } : null)}
            onSelect={(d) => onOpenDamage(d.raw)}
            onHighlightScreen={setListPos}
            height={640}
          />
          )}

          {/* Ficha rápida al pasar el cursor */}
          {tip && (
            <div
              role="tooltip"
              key={tip.item.id}
              className="pointer-events-none absolute z-10 w-64 rounded-md border border-white/15 bg-slate-950/95 p-3 shadow-xl"
              style={{
                left: Math.min(tip.x + 14, 9999),
                top: tip.y + 14,
                // Se voltea hacia la izquierda / arriba si no cabe junto al cursor
                transform: `${tip.x > (viewerRef.current?.clientWidth || 800) - 280 ? "translateX(calc(-100% - 28px))" : ""} ${
                  tip.y > (viewerRef.current?.clientHeight || 640) - 380 ? "translateY(calc(-100% - 28px))" : ""
                }`,
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className={`rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold ${SEV[tip.item.sev]?.chip}`}>
                  Cat {tip.item.sev}
                </span>
                <span className="truncate text-[11px] text-slate-400">
                  {t("reconstruction.blade", { blade: tip.item.blade })} · {sectionLabel(tip.item.section)}
                </span>
              </div>
              <p className="mb-2 truncate text-xs font-medium text-white">{tip.item.typeLabel}</p>
              <DamageThumb item={tip.item} />
              <DamageFacts item={tip.item} />
              <p className="mt-2 flex items-center gap-1 text-[11px] text-amber-300">
                <MousePointerClick className="h-3 w-3" aria-hidden="true" /> {t("reconstruction.clickToOpen")}
              </p>
            </div>
          )}

          {/* Leyenda */}
          <div className={`pointer-events-none ${mode === "3d" ? "" : "hidden"} absolute bottom-3 right-3 rounded-md border border-white/10 bg-slate-950/85 px-3 py-2 text-[11px] text-slate-300`}>
            <p className="mb-1 font-semibold uppercase tracking-wider text-slate-400">{t("reconstruction.legendTitle")}</p>
            <p>A 12 h · B 4 h · C 8 h</p>
            <p className="text-slate-400">{t("reconstruction.legendFront")}</p>
          </div>
          {!hasStitched && mode === "3d" && (
            <p className="absolute left-3 top-3 rounded-md border border-white/10 bg-slate-950/85 px-3 py-2 text-xs text-slate-300">
              {t("reconstruction.noStitched")}
            </p>
          )}
        </section>

        {/* Panel lateral: resumen y lista */}
        <aside className="flex min-h-0 flex-col gap-4 xl:col-span-4">
          <div className="grid grid-cols-3 gap-2">
            {bladeStats.map(({ blade, total, worst }) => (
              <button
                key={blade}
                type="button"
                onClick={() => setFocusBlade(focusBlade === blade ? null : blade)}
                aria-pressed={focusBlade === blade}
                className={`rounded-md border p-3 text-left transition-colors ${FOCUS} ${
                  focusBlade === blade ? "border-amber-500/50 bg-amber-500/[0.08]" : "border-white/10 bg-slate-900/70 hover:border-white/25"
                }`}
              >
                <p className={OVERLINE}>{t("reconstruction.blade", { blade })}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums leading-none text-white">{total}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {worst ? (
                    <>
                      {t("reconstruction.maxCat")} <span style={{ color: SEV_HEX[worst] }}>Cat {worst}</span>
                    </>
                  ) : (
                    t("reconstruction.noDamages")
                  )}
                </p>
              </button>
            ))}
          </div>

          <div className={`${PANEL} p-3`}>
            <p className={`${OVERLINE} mb-2`}>{t("reconstruction.categories")}</p>
            <div role="group" aria-label={t("reconstruction.filterByCategory")} className="flex flex-wrap gap-1.5">
              <Chip active={!sevFilter} onClick={() => setSevFilter(null)}>
                {t("reconstruction.all")} <span className="font-normal opacity-70">{Object.values(sevCounts).reduce((a, b) => a + b, 0)}</span>
              </Chip>
              {[1, 2, 3, 4, 5].map((n) => (
                <Chip key={n} active={sevFilter === n} onClick={() => setSevFilter(n)} color={SEV_HEX[n]}>
                  Cat {n} <span className="font-normal opacity-70">{sevCounts[n]}</span>
                </Chip>
              ))}
            </div>
          </div>

          <div className={`${PANEL} flex min-h-0 flex-1 flex-col p-3`}>
            <div className="mb-2 flex items-center justify-between">
              <p className={OVERLINE}>{t("reconstruction.damages")} {focusBlade ? `· ${t("reconstruction.blade", { blade: focusBlade })}` : ""}</p>
              <span className="text-xs tabular-nums text-slate-400">{listed.length}</span>
            </div>
            {listed.length === 0 ? (
              <p className="rounded-md border border-dashed border-white/10 px-3 py-8 text-center text-xs text-slate-500">
                {t("reconstruction.noDamagesFiltered")}
              </p>
            ) : (
              <ul className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
                {listed.map((i) => (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => onOpenDamage(i.raw)}
                      onMouseEnter={() => setListHover(i.id)}
                      onMouseLeave={() => setListHover(null)}
                      onFocus={() => setListHover(i.id)}
                      onBlur={() => setListHover(null)}
                      className={`flex w-full items-start gap-2.5 rounded-md border border-white/10 bg-white/[0.02] px-2.5 py-2 text-left transition-colors hover:border-white/25 ${FOCUS}`}
                    >
                      <span className={`mt-0.5 shrink-0 rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold ${SEV[i.sev]?.chip}`}>
                        Cat {i.sev}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-white">{i.typeLabel}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                          {t("reconstruction.blade", { blade: i.blade })} · {i.section} · {fmtM(i.radiusM, loc, noRadius)} · {fmtMm(i.lengthMm, loc)} × {fmtMm(i.widthMm, loc)}
                        </span>
                      </span>
                      {Number.isFinite(i.s) && <Crosshair className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {withoutRadius > 0 && (
              <p className="mt-2 text-[11px] text-slate-500">
                {t("reconstruction.withoutRadius", { count: withoutRadius })}
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
