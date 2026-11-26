import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Map, { Marker, Popup, NavigationControl, FullscreenControl } from 'react-map-gl/maplibre';
import { Eye, LocateFixed, ChevronDown, MapPin, MapPinOff, Trash2 } from 'lucide-react';
import maplibregl from '@/lib/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import './turbine-map.css';
import { tx } from '@/i18n/tx';
import { cn } from '@/lib/utils';
import { BTN_BRAND_OUTLINE, BTN_DANGER, BTN_SECONDARY, FOCUS } from '@/lib/classes';
import { getInitialViewState } from '@/lib/coordinates';
import { getMapStyle, DEFAULT_MAP_STYLE } from '@/lib/mapStyles';
import { SEVERITY, SEVERITY_LEVELS, NEUTRAL_SEVERITY, getSeverity, parseSeverity, severityLabel } from '@/lib/severity';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import WindTurbineIcon from './WindTurbineIcon';
import SeverityBadge from './SeverityBadge';
import { choosePopupPlacement } from '@/lib/popupPlacement';
import { chooseMarkerSize, markerMode, markerZIndex, nearestNeighborDistances, pickLabelIds } from '@/lib/markerLayout';

/**
 * Mapa interactivo de aerogeneradores (MapLibre + OpenFreeMap). Solo presentación: no consulta datos.
 *
 * @param {{
 *   items: Array<{
 *     id: string, name: string, model?: string,
 *     statusKey: 'done'|'progress'|'pending', statusLabel: string,   // ya traducido
 *     severity: number|string|null,                                   // severidad máxima (1–5) o null
 *     damageCount: number,
 *     position: { lat: number, lon: number, source: 'registered'|'estimated' } | null,
 *   }>,
 *   onOpenReport: (item) => void,
 *   onDeleteReport?: (item) => void,      // solo admin/dev; sin él no hay acciones de eliminación
 *   getPhotoUrl?: (path) => Promise<string>|string,   // firma la URL de `item.photoPath` al abrir el popup
 *   styleKey?: string,        // clave de src/lib/mapStyles.js (p. ej. 'dark' | 'light')
 *   className?: string,
 * }} props
 */

const FIT_OPTIONS = { padding: 60, maxZoom: 14 };
const DISC = 26; // diámetro del círculo en reposo (px); al pasar el mouse o seleccionar crece a 2x (52 px)
const ICON_SIZE = 20; // alto del aerogenerador dentro del círculo (px)
const ABOVE_POINT = DISC + 4; // espacio que ocupa el círculo ampliado sobre la coordenada (radio 26 + margen)
const BELOW_POINT = DISC + 4 + 14; // ídem bajo la coordenada, más la etiqueta del nombre
const CARD_SIZE = { w: 372, h: 300 }; // tarjeta de detalle con el relleno del popup (px); medida ≈ 294 con foto y acciones
const MAX_SPINNING_MARKERS = 60; // con más turbinas visibles, solo gira la del cursor/seleccionada (ver turbine-map.css)
const HIDE_DELAY_MS = 250; // espera antes de cerrar el detalle al salir el mouse (da tiempo a llegar al popup)
const NONE = 'none';

// Separación del detalle respecto a la coordenada para CADA ancla posible (el ancla la elige
// choosePopupPlacement según el espacio real del mapa, así el detalle nunca queda cortado por el borde).
// Con el detalle arriba de la coordenada se deja libre la figura; abajo, la etiqueta del nombre.
const POPUP_OFFSETS = {
  top: [0, BELOW_POINT],
  'top-left': [0, BELOW_POINT],
  'top-right': [0, BELOW_POINT],
  bottom: [0, -ABOVE_POINT],
  'bottom-left': [0, -ABOVE_POINT],
  'bottom-right': [0, -ABOVE_POINT],
  left: [ABOVE_POINT, 0],
  right: [-ABOVE_POINT, 0],
};

/** Fase de giro estable por turbina (0–1, hash FNV-1a del id): así las aspas no giran todas sincronizadas. */
const phaseOf = (id) => {
  let h = 2166136261;
  for (const ch of String(id)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h / 2 ** 32;
};

/** Clave de categoría para la leyenda y el filtro: 1–5 o 'none' (sin daños / sin inspeccionar). */
const categoryOf = (item) => parseSeverity(item.severity) ?? NONE;

// Marcador minimalista: círculo centrado en la coordenada, con fondo tintado y borde del color del daño máximo, y un
// aerogenerador dentro. El círculo se dibuja siempre a DISC px y se ESCALA (clase turbine-disc, turbine-map.css): en
// reposo a `size / DISC` (según el espacio libre en pantalla, ver lib/markerLayout) y a 2x con mouse/foco/selección.
// Si el espacio no alcanza para un icono legible se dibuja un punto de color. El botón mide `size` px para que su
// área de clic no tape a los vecinos. El nombre va en texto plano debajo y se omite si choca con otro.
const markerClass = 'turbine-marker group relative block outline-none';

const discClass = (sev) =>
  cn(
    'turbine-disc absolute left-1/2 top-1/2 -ml-[13px] -mt-[13px] flex h-[26px] w-[26px] items-center justify-center rounded-full border-[1.5px]',
    'group-focus-visible:ring-2 group-focus-visible:ring-brand',
    sev.border,
    sev.tint,
    sev.glow,
  );

const TurbineMap = ({ items = [], onOpenReport, onDeleteReport, getPhotoUrl, styleKey = DEFAULT_MAP_STYLE, className }) => {
  useTranslation();
  const mapRef = useRef(null);
  const loadedRef = useRef(false); // true cuando el estilo y las primeras teselas ya cargaron
  const [hidden, setHidden] = useState(() => new Set()); // categorías desactivadas en la leyenda
  // El detalle se abre al pasar el mouse (o enfocar con el teclado) y se FIJA con un clic. Con una fijada, el mouse
  // sobre otra turbina muestra la de debajo del cursor y al salir vuelve a la fijada.
  const [pinnedId, setPinnedId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const hideTimer = useRef(null);
  const [viewTick, setViewTick] = useState(0); // fuerza recalcular la colocación del detalle al mover/redimensionar el mapa
  const [mapError, setMapError] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const [trayOpen, setTrayOpen] = useState(true);

  const positioned = useMemo(() => items.filter((i) => i.position), [items]);
  const unlocated = useMemo(() => items.filter((i) => !i.position), [items]);
  const visible = useMemo(() => positioned.filter((i) => !hidden.has(categoryOf(i))), [positioned, hidden]);
  const activeId = hoverId ?? pinnedId;
  // La referencia al mapa solo existe tras montar: un repintado inicial calcula la disposición real (después lo hacen
  // onMoveEnd, onResize y onLoad).
  useEffect(() => {
    setViewTick((t) => t + 1);
  }, []);

  // Disposición según el espacio real en pantalla: tamaño, icono o punto, y qué etiquetas caben. Se recalcula al
  // mover, hacer zoom o redimensionar (viewTick), no al pasar el mouse.
  const layout = useMemo(() => {
    const points = [];
    try {
      visible.forEach((item) => {
        const p = mapRef.current?.project([item.position.lon, item.position.lat]);
        if (p) points.push({ id: item.id, name: item.name, x: p.x, y: p.y, priority: parseSeverity(item.severity) ?? 0 });
      });
    } catch {
      points.length = 0; // el mapa aún no está listo: círculos de tamaño completo y todas las etiquetas
    }
    const size = chooseMarkerSize(nearestNeighborDistances(points));
    return { size, mode: markerMode(size), labelIds: points.length ? pickLabelIds({ points, size }) : null };
    // viewTick no se lee dentro: cambia cuando el mapa se mueve y obliga a reproyectar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, viewTick]);
  const selected = visible.find((i) => i.id === activeId) || null; // si el filtro lo oculta, el popup se cierra

  // Colocación del detalle según dónde cae la turbina en pantalla y el tamaño del mapa (se recalcula al mover).
  let placement = { anchor: 'bottom', maxHeight: undefined };
  if (selected) {
    let point = null;
    let box = null;
    try {
      point = mapRef.current?.project([selected.position.lon, selected.position.lat]) ?? null;
      box = mapRef.current?.getContainer?.() ?? null;
    } catch {
      /* el mapa aún no está listo: se usa la colocación por defecto */
    }
    placement = choosePopupPlacement({
      point,
      container: { w: box?.clientWidth, h: box?.clientHeight },
      card: CARD_SIZE,
      figureHeight: ABOVE_POINT,
      labelHeight: BELOW_POINT,
    });
  }

  const cancelHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
  };
  const showHover = (id) => {
    cancelHide();
    setHoverId(id);
  };
  const scheduleHide = () => {
    cancelHide();
    hideTimer.current = setTimeout(() => setHoverId(null), HIDE_DELAY_MS);
  };
  const pin = (id) => {
    cancelHide();
    setPinnedId(id);
  };
  const closeDetail = () => {
    cancelHide();
    setPinnedId(null);
    setHoverId(null);
  };
  useEffect(() => cancelHide, []); // al desmontar, sin temporizadores pendientes

  // La vista inicial usa TODAS las turbinas con posición (no cambia al filtrar).
  const viewState = useMemo(
    () => getInitialViewState(positioned.map((i) => i.position), FIT_OPTIONS),
    [positioned],
  );

  const counts = useMemo(() => {
    const c = { [NONE]: 0 };
    SEVERITY_LEVELS.forEach((n) => (c[n] = 0));
    items.forEach((i) => (c[categoryOf(i)] += 1));
    return c;
  }, [items]);

  const toggleCategory = (key) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const recenter = () => {
    const map = mapRef.current;
    if (!map || !viewState) return;
    if (viewState.bounds) {
      map.fitBounds(viewState.bounds, { ...viewState.fitBoundsOptions, duration: 600 });
    } else {
      map.flyTo({ center: [viewState.longitude, viewState.latitude], zoom: viewState.zoom, duration: 600 });
    }
  };

  const retry = () => {
    setMapError(false);
    loadedRef.current = false;
    setMapKey((k) => k + 1); // recrea el mapa y vuelve a pedir estilo y tiles
  };

  const handleMapLoad = () => {
    loadedRef.current = true;
    setViewTick((t) => t + 1);
    setMapError(false);
  };

  // MapLibre emite `error` también por recursos secundarios (un glifo o un icono suelto). Solo se avisa al
  // usuario si falla el estilo (antes de cargar) o las teselas/fuentes; el resto se registra y el mapa sigue.
  // El detalle técnico (mensaje, estado HTTP, url, fuente) queda en consola para poder diagnosticar.
  const handleMapError = (e) => {
    const err = e?.error;
    if (err?.name === 'AbortError') return;
    console.warn('[TurbineMap] error del mapa', {
      message: err?.message,
      status: err?.status,
      url: err?.url,
      sourceId: e?.sourceId,
    });
    if (e?.sourceId || e?.tile || !loadedRef.current) setMapError(true);
  };

  if (items.length === 0) {
    return <EmptyState icon={MapPin}>{tx('No hay turbinas para mostrar en el mapa')}</EmptyState>;
  }

  const legend = [
    ...SEVERITY_LEVELS.map((n) => ({ key: n, label: severityLabel(n), sev: SEVERITY[n] })),
    { key: NONE, label: tx('Sin daños'), sev: NEUTRAL_SEVERITY },
  ];

  return (
    <div
      className={cn('flex flex-col gap-3', visible.length > MAX_SPINNING_MARKERS && 'turbine-map-static', className)}
    >
      {positioned.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
          <div role="group" aria-label={tx('Filtrar por daño')} className="flex flex-wrap gap-1.5">
            {legend.map(({ key, label, sev }) => {
              const on = !hidden.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleCategory(key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                    FOCUS,
                    on
                      ? 'border-line-medium bg-surface-card text-ink'
                      : 'border-line-subtle text-ink-muted line-through opacity-60 hover:opacity-100',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn('h-2.5 w-2.5 rounded-full border', sev.level ? 'border-transparent' : sev.border, sev.level ? sev.bg : 'bg-transparent')}
                  />
                  {label}
                  <span className="tabular-nums opacity-70">{counts[key]}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-ink-muted">
            {tx('Color según el daño máximo. Gris: sin daños o sin inspeccionar.')}
          </p>
        </div>
      )}

      {positioned.length === 0 ? (
        <EmptyState icon={MapPinOff}>{tx('Ninguna turbina tiene ubicación')}</EmptyState>
      ) : (
        <div className="relative mx-5 h-[300px] overflow-hidden rounded-lg border border-line-subtle bg-surface-card sm:h-[460px]">
          <Map
            key={mapKey}
            ref={mapRef}
            mapLib={maplibregl}
            initialViewState={viewState}
            mapStyle={getMapStyle(styleKey).url}
            style={{ width: '100%', height: '100%' }}
            aria-label={tx('Mapa de aerogeneradores')}
            onLoad={handleMapLoad}
            onError={handleMapError}
            onMoveEnd={() => setViewTick((t) => t + 1)}
            onResize={() => setViewTick((t) => t + 1)}
          >
            <NavigationControl position="top-right" showCompass />
            <FullscreenControl position="top-right" />

            {visible.map((item) => {
              const sev = getSeverity(item.severity);
              const sevText = severityLabel(item.severity) || tx('Sin daños');
              const active = item.id === activeId;
              const labelHidden = layout.labelIds && !layout.labelIds.has(item.id) && !active;
              return (
                <Marker
                  key={item.id}
                  longitude={item.position.lon}
                  latitude={item.position.lat}
                  anchor="center"
                  style={{ zIndex: markerZIndex(item.severity, active) }}
                >
                  <button
                    type="button"
                    aria-label={tx('Turbina {{name}}, {{severity}}', { name: item.name, severity: sevText })}
                    aria-pressed={item.id === pinnedId}
                    onClick={() => pin(item.id)}
                    onMouseEnter={() => showHover(item.id)}
                    onMouseLeave={scheduleHide}
                    onFocus={() => showHover(item.id)}
                    onBlur={scheduleHide}
                    className={markerClass}
                    style={{ width: layout.size, height: layout.size, '--label-shift': `${DISC - layout.size / 2}px` }}
                  >
                    <span
                      data-part="disc"
                      data-mode={layout.mode}
                      data-active={active ? 'true' : 'false'}
                      className={discClass(sev)}
                      style={{ '--disc-rest': Number((layout.size / DISC).toFixed(3)) }}
                    >
                      {layout.mode === 'dot' && (
                        <span
                          data-part="dot"
                          className={cn('turbine-dot absolute inset-0 rounded-full', sev.level ? sev.bg : 'bg-ink-muted')}
                        />
                      )}
                      <span className="wind-turbine-icon-wrap flex items-center justify-center">
                        <WindTurbineIcon size={ICON_SIZE} phase={phaseOf(item.id)} className={sev.text} />
                      </span>
                      <SeverityBadge severity={item.severity} />
                    </span>
                    <span
                      className={cn(
                        'turbine-marker-label pointer-events-none absolute left-1/2 top-full mt-1 max-w-[88px] -translate-x-1/2 truncate whitespace-nowrap text-[10px] font-medium leading-none text-ink-muted',
                        labelHidden && 'turbine-label-hidden',
                      )}
                    >
                      {item.name}
                    </span>
                  </button>
                </Marker>
              );
            })}

            {selected && (
              <Popup
                longitude={selected.position.lon}
                latitude={selected.position.lat}
                anchor={placement.anchor}
                offset={POPUP_OFFSETS}
                maxWidth="380px"
                closeOnClick={false}
                onClose={closeDetail}
                className="turbine-map-popup"
              >
                <TurbinePopup
                  item={selected}
                  onOpenReport={onOpenReport}
                  onDeleteReport={onDeleteReport}
                  getPhotoUrl={getPhotoUrl}
                  onCardEnter={cancelHide}
                  onCardLeave={scheduleHide}
                  maxHeight={placement.maxHeight}
                />
              </Popup>
            )}
          </Map>

          <button
            type="button"
            onClick={recenter}
            aria-label={tx('Recentrar mapa')}
            title={tx('Recentrar mapa')}
            className={cn(BTN_SECONDARY, '!h-9 absolute left-3 top-3 !px-2.5 shadow-md')}
          >
            <LocateFixed size={16} aria-hidden="true" />
          </button>

          {visible.length === 0 && (
            <p
              role="status"
              className="absolute inset-x-3 top-14 rounded-md border border-line-subtle bg-surface-panel px-3 py-2 text-center text-xs text-ink-muted"
            >
              {tx('Ningún marcador coincide con el filtro')}
            </p>
          )}

          {mapError && (
            <div
              role="alert"
              className="absolute inset-x-3 bottom-8 flex flex-wrap items-center justify-between gap-2 rounded-md border border-error-border bg-error-bg px-3 py-2 text-sm text-error-text"
            >
              <span>{tx('No se pudo cargar el mapa. Revisa tu conexión e inténtalo de nuevo.')}</span>
              <button type="button" onClick={retry} className={cn(BTN_DANGER, '!h-8 !px-3')}>
                {tx('Reintentar')}
              </button>
            </div>
          )}
        </div>
      )}

      {unlocated.length > 0 && (
        <div
          role="group"
          aria-label={tx('Turbinas sin ubicación')}
          className="mx-5 mb-4 rounded-lg border border-line-subtle bg-surface-card"
        >
          <button
            type="button"
            aria-expanded={trayOpen}
            onClick={() => setTrayOpen((o) => !o)}
            className={cn('flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-ink', FOCUS)}
          >
            <span>
              {tx('Turbinas sin ubicación')} ({unlocated.length})
            </span>
            <ChevronDown size={16} aria-hidden="true" className={cn('transition-transform', trayOpen && 'rotate-180')} />
          </button>
          {trayOpen && (
            <div className="border-t border-line-subtle px-3 py-2">
              <p className="mb-2 text-[11px] text-ink-muted">
                {tx('Sin coordenadas registradas ni fotos con GPS válido.')}
              </p>
              <ul className="flex max-h-40 flex-col gap-1 overflow-auto">
                {unlocated.map((item) => {
                  const rowClass =
                    'flex w-full items-center justify-between gap-3 rounded-md border border-line-subtle bg-surface-panel px-3 py-2 text-left text-sm text-ink';
                  const content = (
                    <>
                      <span className="font-semibold">{item.name}</span>
                      <StatusBadge status={item.statusKey} label={item.statusLabel} />
                    </>
                  );
                  return (
                    <li key={item.id} className="flex items-center gap-1.5">
                      {item.canOpenReport === false ? (
                        <div className={rowClass}>{content}</div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenReport?.(item)}
                          className={cn(rowClass, 'transition-colors hover:border-line-medium', FOCUS)}
                        >
                          {content}
                        </button>
                      )}
                      {onDeleteReport && <DeleteButton item={item} onDeleteReport={onDeleteReport} iconOnly />}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/** Acción de eliminar: solo existe si la pantalla entrega `onDeleteReport` (admin/dev). */
const DeleteButton = ({ item, onDeleteReport, iconOnly = false }) => (
  <button
    type="button"
    onClick={() => onDeleteReport(item)}
    aria-label={tx('Eliminar reporte de {{name}}', { name: item.name })}
    title={tx('Eliminar reporte')}
    // Rojo (estilo de peligro del Design System) para que se distinga de las demás acciones
    className={cn(BTN_DANGER, iconOnly ? 'h-10 w-10 shrink-0 px-0' : 'mt-2 h-9 w-full')}
  >
    <Trash2 size={15} aria-hidden="true" />
    {!iconOnly && tx('Eliminar reporte')}
  </button>
);

/**
 * Foto de identificación de la turbina. La URL se firma al abrir el popup (no antes) con `getPhotoUrl`
 * (ruta → URL); mientras tanto un esqueleto. Si no se puede firmar o la imagen no carga, simplemente no se muestra.
 */
const TurbinePhoto = ({ name, path, getPhotoUrl }) => {
  const [photo, setPhoto] = useState({ status: 'loading', url: '' });

  useEffect(() => {
    let cancelled = false;
    setPhoto({ status: 'loading', url: '' });
    Promise.resolve()
      .then(() => getPhotoUrl(path))
      .then((url) => {
        if (!cancelled) setPhoto(url ? { status: 'ready', url } : { status: 'none', url: '' });
      })
      .catch(() => {
        if (!cancelled) setPhoto({ status: 'none', url: '' });
      });
    return () => {
      cancelled = true;
    };
  }, [path, getPhotoUrl]);

  if (photo.status === 'none') return null;
  if (photo.status === 'loading') {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label={tx('Cargando foto')}
        className="h-24 w-full animate-pulse rounded-md border border-line-subtle bg-surface-card"
      />
    );
  }
  return (
    <img
      src={photo.url}
      alt={tx('Foto de la turbina {{name}}', { name })}
      loading="lazy"
      onError={() => setPhoto({ status: 'none', url: '' })}
      className="h-24 w-full rounded-md border border-line-subtle bg-surface-card object-cover"
    />
  );
};

/**
 * Detalle de la turbina. Tarjeta de tamaño predecible (la colocación depende de él): arriba foto + nombre/estado,
 * luego los datos en filas a todo el ancho (etiqueta a la izquierda, valor a la derecha, sin envolver) y, por último,
 * las acciones en una sola fila. Si no cabe en el mapa, desplaza por dentro (`maxHeight`) en vez de cortarse.
 * Pasar el mouse por la tarjeta evita que se cierre mientras se usan sus botones.
 */
const TurbinePopup = ({ item, onOpenReport, onDeleteReport, getPhotoUrl, onCardEnter, onCardLeave, maxHeight }) => {
  const sev = getSeverity(item.severity);
  const label = severityLabel(item.severity);
  const origin = item.position.source === 'estimated' ? tx('Estimada por fotos') : tx('Coordenada registrada');
  const hasPhoto = Boolean(item.photoPath && getPhotoUrl);
  const row = 'flex items-baseline justify-between gap-4 py-1.5';
  return (
    <div
      data-hover-card
      onMouseEnter={onCardEnter}
      onMouseLeave={onCardLeave}
      style={maxHeight ? { maxHeight } : undefined}
      className="w-[330px] max-w-[calc(100vw-6rem)] overflow-y-auto overscroll-contain"
    >
      <div data-layout={hasPhoto ? 'side-by-side' : 'single'} className="flex gap-3">
        {hasPhoto && (
          // `empty:hidden`: si la foto no carga el hueco desaparece y el texto ocupa todo el ancho
          <div className="w-24 shrink-0 empty:hidden">
            <TurbinePhoto name={item.name} path={item.photoPath} getPhotoUrl={getPhotoUrl} />
          </div>
        )}
        <div className="min-w-0 flex-1 pr-5">
          <h3 className="truncate text-base font-semibold leading-tight text-ink">{item.name}</h3>
          {item.model && <p className="mt-0.5 truncate text-xs text-ink-muted">{item.model}</p>}
          <StatusBadge status={item.statusKey} label={item.statusLabel} className="mt-2" />
        </div>
      </div>

      <dl className="mt-3 divide-y divide-line-subtle border-t border-line-subtle text-xs">
        <div className={row}>
          <dt className="text-ink-muted">{tx('Posición')}</dt>
          <dd className="text-right">
            <span className="block whitespace-nowrap font-medium text-ink">{origin}</span>
            <span className="block whitespace-nowrap tabular-nums text-ink-muted">
              {item.position.lat.toFixed(6)}, {item.position.lon.toFixed(6)}
            </span>
          </dd>
        </div>
        <div className={row}>
          <dt className="text-ink-muted">{tx('Severidad máxima')}</dt>
          <dd className="flex items-center gap-1.5 whitespace-nowrap text-ink">
            <span
              aria-hidden="true"
              className={cn('h-2.5 w-2.5 rounded-full border', sev.level ? 'border-transparent' : sev.border, sev.level ? sev.bg : 'bg-transparent')}
            />
            {label ? <span className="font-semibold">{label}</span> : <span>{tx('Ninguna')}</span>}
          </dd>
        </div>
        <div className={row}>
          <dt className="text-ink-muted">{tx('Daños')}</dt>
          <dd className="tabular-nums text-ink">
            <span>{item.damageCount ?? 0}</span>
          </dd>
        </div>
      </dl>

      <div data-actions className="mt-3 flex items-center gap-2">
        {item.canOpenReport === false ? (
          <p className="flex-1 rounded-md border border-dashed border-line-subtle px-3 py-2 text-xs italic text-ink-muted">
            {tx('El reporte estará disponible al completar la inspección')}
          </p>
        ) : (
          <button type="button" onClick={() => onOpenReport?.(item)} className={cn(BTN_BRAND_OUTLINE, 'flex-1')}>
            <Eye size={16} aria-hidden="true" />
            {tx('Click para ver reporte')}
          </button>
        )}
        {onDeleteReport && <DeleteButton item={item} onDeleteReport={onDeleteReport} iconOnly />}
      </div>
    </div>
  );
};

export default TurbineMap;
