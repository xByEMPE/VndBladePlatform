import { useTranslation } from "react-i18next";
import { tx } from "@/i18n/tx";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Image as ImageIcon } from "lucide-react";
import OptimizedImage, { useImagePreloader } from "@/components/OptimizedImage";
import { OVERLINE, FOCUS } from "./viewerKit";

const NAV_BTN = `absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md border border-line-medium bg-surface-base/60 text-ink backdrop-blur transition-colors hover:bg-surface-base/80 ${FOCUS}`;

/**
 * Carrusel de fotos de una sección de la pala.
 *
 * Carga optimizada:
 *  - La tira de miniaturas usa los WebP de /thumbnails (con la original como respaldo si faltan)
 *    y carga de forma diferida solo las que entran en pantalla.
 *  - La foto principal se muestra primero en miniatura y luego en alta resolución.
 *  - Se precargan únicamente la anterior y la siguiente, cuando el usuario deja de navegar.
 *
 * Solo presentación: las URLs y la acción de abrir la foto vienen del padre.
 */
const ImageCarousel = ({
  sections,
  activeSection,
  onSectionChange,
  images,
  getFullUrl,
  getThumbUrl,
  onOpen,
  sectionExtra = null,
  labels = {},
}) => {
  useTranslation();
  const L = {
    region: tx("Carrusel de imágenes"),
    empty: tx("No hay imágenes en esta sección"),
    previous: tx("Foto anterior"),
    next: tx("Foto siguiente"),
    open: tx("Abrir en el visor"),
    hint: tx("Usa las flechas del teclado o desliza para cambiar de foto"),
    ...labels,
  };

  const [index, setIndex] = useState(0);
  const { preloadImages } = useImagePreloader();
  const stripRef = useRef(null);
  const touchStartX = useRef(null);

  const total = images.length;
  const safeIndex = Math.min(index, Math.max(0, total - 1));
  const current = images[safeIndex];

  // Al cambiar de sección (o de cantidad de fotos) se vuelve a la primera
  useEffect(() => {
    setIndex(0);
  }, [activeSection, total]);

  const go = useCallback(
    (delta) => {
      if (total <= 1) return;
      setIndex((i) => (Math.min(i, total - 1) + delta + total) % total);
    },
    [total],
  );

  // Mantener la miniatura activa centrada en la tira (sin mover la página)
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const el = strip.querySelector(`[data-idx="${safeIndex}"]`);
    if (el) {
      strip.scrollTo({
        left: el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2,
        behavior: "smooth",
      });
    }
  }, [safeIndex, activeSection]);

  // Precarga de vecinas, solo cuando el usuario se detiene
  useEffect(() => {
    if (total < 2) return undefined;
    const timer = setTimeout(() => {
      const urls = [images[safeIndex + 1], images[safeIndex - 1]]
        .filter(Boolean)
        .map(getFullUrl)
        .filter(Boolean);
      if (urls.length) preloadImages(urls).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [safeIndex, images, total, getFullUrl, preloadImages]);

  const onKeyDown = (e) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      setIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setIndex(Math.max(0, total - 1));
    } else if ((e.key === "Enter" || e.key === " ") && current) {
      e.preventDefault();
      onOpen(current);
    }
  };

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
  };

  return (
    <div className="space-y-4">
      {/* Selector de sección */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label={tx("Sección de la pala")} className="flex flex-wrap gap-2">
          {sections.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={activeSection === s.key}
              onClick={() => onSectionChange(s.key)}
              className={`inline-flex items-center gap-2 rounded-md border px-3.5 py-2 text-sm font-semibold transition-colors ${FOCUS} ${
                activeSection === s.key
                  ? "border-brand/50 bg-brand/10 text-brand"
                  : "border-line-subtle bg-surface-card text-ink hover:border-line-medium hover:text-ink"
              }`}
            >
              {s.label}
              <span className="rounded-sm bg-line-subtle px-1.5 py-0.5 text-xs font-medium tabular-nums text-ink">
                {s.count}
              </span>
            </button>
          ))}
        </div>
        {sectionExtra}
      </div>

      {total === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-md border border-dashed border-line-subtle text-ink-muted">
          <ImageIcon size={28} className="mb-2 opacity-60" aria-hidden="true" />
          <p className="text-sm">{L.empty}</p>
        </div>
      ) : (
        <>
          {/* Foto principal */}
          <div
            role="region"
            aria-roledescription="carrusel"
            aria-label={L.region}
            tabIndex={0}
            onKeyDown={onKeyDown}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            className={`relative h-[min(62vh,620px)] min-h-[260px] overflow-hidden rounded-md border border-line-subtle bg-surface-base ${FOCUS}`}
          >
            <OptimizedImage
              key={current.path}
              src={getFullUrl(current)}
              thumbnailSrc={getThumbUrl(current) || undefined}
              useProgressiveLoading
              lazyLoad={false}
              alt={current.name}
              className="h-full w-full cursor-zoom-in object-contain"
              onClick={() => onOpen(current)}
            />

            <div className="pointer-events-none absolute left-3 top-3 flex max-w-[calc(100%-5rem)] items-center gap-2">
              <span className="rounded-sm bg-surface-base/70 px-2 py-1 text-xs font-semibold tabular-nums text-ink">
                {safeIndex + 1} / {total}
              </span>
              <span className="truncate rounded-sm bg-surface-base/70 px-2 py-1 text-xs text-ink">
                {current.name}
              </span>
            </div>

            <button
              type="button"
              onClick={() => onOpen(current)}
              aria-label={L.open}
              title={L.open}
              className={`absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-md border border-line-medium bg-surface-base/60 text-ink backdrop-blur transition-colors hover:bg-surface-base/80 ${FOCUS}`}
            >
              <Maximize2 size={16} aria-hidden="true" />
            </button>

            {total > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label={L.previous} className={`${NAV_BTN} left-3`}>
                  <ChevronLeft size={22} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => go(1)} aria-label={L.next} className={`${NAV_BTN} right-3`}>
                  <ChevronRight size={22} aria-hidden="true" />
                </button>
              </>
            )}
          </div>

          {/* Tira de miniaturas */}
          <div
            ref={stripRef}
            className="relative flex gap-2 overflow-x-auto pb-2"
            aria-label={tx("Miniaturas")}
          >
            {images.map((file, i) => {
              const active = i === safeIndex;
              return (
                <button
                  key={`${file.path}-${i}`}
                  type="button"
                  data-idx={i}
                  onClick={() => setIndex(i)}
                  aria-label={tx("Foto {{n}} de {{total}}", { n: i + 1, total })}
                  aria-current={active ? "true" : undefined}
                  className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-md border bg-surface-panel transition-all ${FOCUS} ${
                    active
                      ? "border-brand ring-2 ring-brand/50"
                      : "border-line-subtle opacity-75 hover:opacity-100"
                  }`}
                >
                  <OptimizedImage
                    src={getFullUrl(file)}
                    thumbnailSrc={getThumbUrl(file) || undefined}
                    lazyLoad
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <span className="pointer-events-none absolute bottom-0 right-0 rounded-tl-sm bg-surface-base/70 px-1 text-[10px] font-medium tabular-nums text-ink">
                    {i + 1}
                  </span>
                </button>
              );
            })}
          </div>
          <p className={`${OVERLINE} !text-[10px] !normal-case !tracking-normal text-ink-muted`}>{L.hint}</p>
        </>
      )}
    </div>
  );
};

export default ImageCarousel;
