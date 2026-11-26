import { useTranslation } from "react-i18next";
import { tx } from "@/i18n/tx";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FIELDS, GENERIC, GeometryError, PHOTO1_KEYPOINTS, PHOTO2_KEYPOINTS, compute, missingPoints, partialOverlay,
} from './wtgGeometry.js';
import { WTGM_MIME, buildWtgm, downloadJson, wtgmFileName } from './wtgmFormat.js';
import TurbineInfoDialog, { missingInfo } from './TurbineInfoDialog.jsx';
import PointGuide from './PointGuide.jsx';
import './WtgCalibrator.css';

const VIEWS = {
  photo1: { title: 'Foto 1', subtitle: 'Góndola → punta de pala', points: PHOTO1_KEYPOINTS },
  photo2: { title: 'Foto 2', subtitle: 'Góndola → cimentación', points: PHOTO2_KEYPOINTS },
};
const STORAGE_KEY = 'wtg-calibrator-session-v1';
const EMPTY_TURBINE = {
  type: '', manufacturer: '', windpark: '', powerRating: '', rotorDiameter: '', towerHeight: '',
  bladeLength: '', bladeLengthRef: 'flange', axisSource: 'nacelle_roof',
};

// Conexiones dibujadas entre puntos para dar contexto visual
const LINKS = {
  photo1: [
    ['spinner_tip', 'hub_rear'], ['nacelle_roof_front', 'nacelle_roof_rear'],
    ['tower_top_up', 'tower_top_down'], ['tower_low_up', 'tower_low_down'],
    ['flange_up', 'flange_down'], ['chord_up', 'chord_down'],
  ],
  photo2: [['tower_top_left', 'tower_top_right'], ['tower_base_left', 'tower_base_right']],
};

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

function saveSession(s) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* almacenamiento no disponible: se ignora */
  }
}

// RNG determinista para la incertidumbre Monte Carlo
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function monteCarlo(inp, sigma, n = 150) {
  if (!(sigma > 0)) return {};
  const rnd = mulberry32(7);
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const jitter = (pts) => Object.fromEntries(
    Object.entries(pts).map(([k, v]) => [k, v && [v[0] + gauss() * sigma, v[1] + gauss() * sigma]]),
  );
  const acc = Object.fromEntries(FIELDS.map((f) => [f.id, []]));
  for (let i = 0; i < n; i++) {
    try {
      const r = compute({ ...inp, photo1: jitter(inp.photo1), photo2: jitter(inp.photo2), rotorDiameter: 0, towerHeight: 0 });
      FIELDS.forEach((f) => acc[f.id].push(r.values[f.id]));
    } catch { /* muestra degenerada */ }
  }
  return Object.fromEntries(FIELDS.map((f) => {
    const a = acc[f.id];
    if (a.length < 2) return [f.id, NaN];
    const m = a.reduce((x, y) => x + y, 0) / a.length;
    return [f.id, Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1))];
  }));
}

/* ------------------------------------------------------------------------------------ */
/* Lienzo de calibración: zoom con rueda, arrastrar para mover, clic para colocar punto   */
/* ------------------------------------------------------------------------------------ */
function CalibrationCanvas({ view, image, points, aiConf, active, onPlace, onSelect, overlay, onDropFile }) {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const [vb, setVb] = useState(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [hover, setHover] = useState(null);
  const [cursor, setCursor] = useState(null); // posición del cursor dentro del lienzo (px de pantalla)
  const drag = useRef(null);

  useEffect(() => {
    if (image) setVb({ x: 0, y: 0, w: image.width, h: image.height });
  }, [image]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toImage = useCallback((evt) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [p.x, p.y];
  }, []);

  // Rueda: zoom alrededor del cursor (listener no pasivo para poder bloquear el scroll)
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !image) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const [px, py] = toImage(e);
      const k = Math.exp(e.deltaY * 0.0015);
      setVb((v) => {
        const w = Math.min(Math.max(v.w * k, 20), image.width * 2);
        const h = (w / v.w) * v.h;
        return { x: px - ((px - v.x) * w) / v.w, y: py - ((py - v.y) * h) / v.h, w, h };
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [image, toImage]);

  const unitsPerPx = vb ? Math.max(vb.w / size.w, vb.h / size.h) : 1;

  const onPointerDown = (e, pointId = null) => {
    if (!image) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (pointId) {
      e.stopPropagation();
      onSelect(pointId);
      drag.current = { mode: 'point', id: pointId };
      return;
    }
    drag.current = { mode: 'maybe-pan', sx: e.clientX, sy: e.clientY, vb0: vb };
  };

  const onPointerMove = (e) => {
    if (!image) return;
    const p = toImage(e);
    setHover(p);
    const box = wrapRef.current?.getBoundingClientRect();
    if (box) setCursor({ x: e.clientX - box.left, y: e.clientY - box.top, w: box.width, h: box.height });
    const d = drag.current;
    if (!d) return;
    if (d.mode === 'point') {
      onPlace(d.id, p, { keepActive: true });
    } else {
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if (d.mode === 'maybe-pan' && Math.hypot(dx, dy) > 4) d.mode = 'pan';
      if (d.mode === 'pan') setVb({ ...d.vb0, x: d.vb0.x - dx * unitsPerPx, y: d.vb0.y - dy * unitsPerPx });
    }
  };

  const onPointerUp = (e) => {
    const d = drag.current;
    drag.current = null;
    if (d?.mode === 'maybe-pan' && active) onPlace(active, toImage(e));
  };

  const fit = () => image && setVb({ x: 0, y: 0, w: image.width, h: image.height });
  const zoomBy = (k) => setVb((v) => {
    const cx = v.x + v.w / 2, cy = v.y + v.h / 2, w = v.w * k, h = v.h * k;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  });

  const defs = VIEWS[view].points;
  const focus = (active && points[active]) || hover;
  const loupeSpan = 160 * unitsPerPx / 5; // 5x sobre el zoom actual
  // La lupa acompaña al cursor (a su derecha/abajo; se voltea cerca de los bordes)
  const loupeStyle = (() => {
    if (!cursor || !hover) return undefined;
    const size = 160, gap = 22;
    const left = cursor.x + gap + size > cursor.w ? cursor.x - gap - size : cursor.x + gap;
    const top = cursor.y + gap + size > cursor.h ? cursor.y - gap - size : cursor.y + gap;
    return { left: Math.max(4, left), top: Math.max(4, top), right: 'auto' };
  })();

  const renderScene = (scale, showLabels) => (
    <>
      <image href={image.url} x="0" y="0" width={image.width} height={image.height} />
      {LINKS[view].map(([a, b]) => points[a] && points[b] && (
        <line key={a + b} x1={points[a][0]} y1={points[a][1]} x2={points[b][0]} y2={points[b][1]}
          className="wc-link" strokeWidth={1.5 * scale} />
      ))}
      {overlay?.towerAxisTop && overlay?.towerAxisLow && (
        <line x1={overlay.towerAxisLow[0]} y1={overlay.towerAxisLow[1]} x2={overlay.towerAxisTop[0]}
          y2={overlay.towerAxisTop[1]} className="wc-axis wc-axis--tower" strokeWidth={1.5 * scale} />
      )}
      {overlay?.hubCenter && (
        <>
          <line x1={overlay.rotorAxisA[0]} y1={overlay.rotorAxisA[1]} x2={overlay.rotorAxisB[0]}
            y2={overlay.rotorAxisB[1]} className="wc-axis wc-axis--rotor" strokeWidth={1.5 * scale} />
          {/* Eje de pitch: recta definida por la raíz (10-11) y la cuerda máxima (12-13) */}
          <line x1={overlay.hubCenter[0]} y1={overlay.hubCenter[1]} x2={overlay.bladeAxisEnd[0]}
            y2={overlay.bladeAxisEnd[1]} className="wc-axis wc-axis--blade" strokeWidth={1.5 * scale} />
          <circle cx={overlay.hubCenter[0]} cy={overlay.hubCenter[1]} r={5 * scale} className="wc-hub" strokeWidth={2 * scale} />
          {/* Prebend: separación entre el eje recto y la punta real (la pala viene curvada a barlovento) */}
          {overlay.bladeTip && (
            <>
              <line x1={overlay.bladeAxisEnd[0]} y1={overlay.bladeAxisEnd[1]} x2={overlay.bladeTip[0]}
                y2={overlay.bladeTip[1]} className="wc-axis wc-axis--prebend" strokeWidth={2 * scale} />
              {showLabels && Number.isFinite(overlay.prebendM) && (
                <text x={(overlay.bladeAxisEnd[0] + overlay.bladeTip[0]) / 2 + 10 * scale}
                  y={overlay.bladeAxisEnd[1] - 12 * scale} fontSize={12 * scale} className="wc-axis-label">
                  prebend {overlay.prebendM.toFixed(2)} m
                </text>
              )}
            </>
          )}
        </>
      )}
      {/* Centros de brida y de cuerda máxima: los dos puntos que definen el eje de pitch */}
      {[overlay?.flangeCenter, overlay?.chordCenter].filter(Boolean).map((c, i) => (
        <circle key={i} cx={c[0]} cy={c[1]} r={3.5 * scale} className="wc-axis-dot" strokeWidth={1.5 * scale} />
      ))}
      {defs.map((k, i) => {
        const p = points[k.id];
        if (!p) return null;
        const cls = ['wc-pt', k.id === active && 'is-active', aiConf[k.id] != null && 'is-ai'].filter(Boolean).join(' ');
        return (
          <g key={k.id} className={cls} onPointerDown={showLabels ? (e) => onPointerDown(e, k.id) : undefined}>
            <circle cx={p[0]} cy={p[1]} r={(showLabels ? 7 : 4) * scale} strokeWidth={2 * scale} />
            <line x1={p[0] - 3 * scale} y1={p[1]} x2={p[0] + 3 * scale} y2={p[1]} strokeWidth={scale} />
            <line x1={p[0]} y1={p[1] - 3 * scale} x2={p[0]} y2={p[1] + 3 * scale} strokeWidth={scale} />
            {showLabels && (
              <text x={p[0] + 10 * scale} y={p[1] - 8 * scale} fontSize={12 * scale}>{i + 1}</text>
            )}
          </g>
        );
      })}
    </>
  );

  return (
    <div className="wc-canvas" ref={wrapRef}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onDropFile(f); }}>
      {!image && (
        <label className="wc-drop">
          <input type="file" accept="image/*" onChange={(e) => e.target.files[0] && onDropFile(e.target.files[0])} />
          <strong>{tx("Arrastra la {{title}} aquí", { title: tx(VIEWS[view].title).toLowerCase() })}</strong>
          <span>{tx("o haz clic para elegir el JPG del dron")}</span>
        </label>
      )}
      {image && vb && (
        <>
          <svg ref={svgRef} className={`wc-svg${active ? ' is-placing' : ''}`}
            viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} preserveAspectRatio="xMidYMid meet"
            onPointerDown={(e) => onPointerDown(e)} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
            onPointerLeave={() => { setHover(null); setCursor(null); }}>
            {renderScene(unitsPerPx, true)}
          </svg>
          {focus && (
            <svg className={`wc-loupe${cursor && hover ? ' is-follow' : ''}`} style={loupeStyle} viewBox={`${focus[0] - loupeSpan / 2} ${focus[1] - loupeSpan / 2} ${loupeSpan} ${loupeSpan}`}>
              {renderScene(loupeSpan / 160, false)}
              <line x1={focus[0] - loupeSpan} y1={focus[1]} x2={focus[0] + loupeSpan} y2={focus[1]} className="wc-cross" strokeWidth={loupeSpan / 160} />
              <line x1={focus[0]} y1={focus[1] - loupeSpan} x2={focus[0]} y2={focus[1] + loupeSpan} className="wc-cross" strokeWidth={loupeSpan / 160} />
            </svg>
          )}
          {view === 'photo1' && overlay && (
            <div className="wc-legend" aria-label={tx("Leyenda de ejes")}>
              <span><i className="wc-lg wc-lg--rotor" />{" "}{tx("Eje del rotor")}</span>
              <span><i className="wc-lg wc-lg--tower" />{" "}{tx("Eje de la torre")}</span>
              <span><i className="wc-lg wc-lg--blade" />{" "}{tx("Eje de pitch (recto: brida → cuerda máx.)")}</span>
              <span><i className="wc-lg wc-lg--prebend" />{" "}{tx("Prebend (curvatura hasta la punta real)")}</span>
            </div>
          )}
          <div className="wc-zoom">
            <button type="button" onClick={() => zoomBy(0.7)} aria-label={tx("Acercar")}>+</button>
            <button type="button" onClick={() => zoomBy(1 / 0.7)} aria-label={tx("Alejar")}>−</button>
            <button type="button" onClick={fit}>{tx("Ajustar")}</button>
          </div>
          {hover && (
            <div className="wc-coords">{hover[0].toFixed(1)}, {hover[1].toFixed(1)} px</div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------------------ */
/**
 * Props opcionales (sin ellas funciona como app independiente):
 *  - requireInfo: pide los datos de la turbina al cargar las 2 fotos, antes de anotar.
 *  - allowExport: false oculta "Generar .wtgm" (la web lo ofrece desde la lista de calibraciones guardadas).
 *  - onSave({ id, turbine, points, images, result, uncertainty, wtgm, method, sigmaPx, missingFields }):
 *    persiste la calibración; debe devolver { id }. Habilita el botón Guardar.
 */
export default function WtgCalibrator({ apiUrl: apiUrlProp = '', requireInfo = false, onSave = null, allowExport = true }) {
  useTranslation();
  const saved = useMemo(loadSession, []);
  const [turbine, setTurbine] = useState({ ...EMPTY_TURBINE, ...(saved?.turbine || {}) });
  const [points, setPoints] = useState(saved?.points || { photo1: {}, photo2: {} });
  const [aiConf, setAiConf] = useState({ photo1: {}, photo2: {} });
  const [images, setImages] = useState({ photo1: null, photo2: null });
  const [view, setView] = useState('photo1');
  const [active, setActive] = useState(
    () => PHOTO1_KEYPOINTS.find((k) => !saved?.points?.photo1?.[k.id])?.id ?? null,
  );
  const [apiUrl, setApiUrl] = useState(saved?.apiUrl ?? apiUrlProp);
  const [sigmaPx, setSigmaPx] = useState(2);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState(null);
  const [infoDone, setInfoDone] = useState(false);
  const [recordId, setRecordId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirtySinceSave, setDirtySinceSave] = useState(false);

  // Con las dos fotos cargadas se piden los datos de la turbina antes de anotar
  const infoOpen = requireInfo && !infoDone && Boolean(images.photo1 && images.photo2);

  useEffect(() => saveSession({ turbine, points, apiUrl }), [turbine, points, apiUrl]);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const defs = VIEWS[view].points;
  const vpts = points[view];

  const nextMissing = useCallback((v, pts, after) => {
    const list = VIEWS[v].points;
    const start = Math.max(0, list.findIndex((k) => k.id === after));
    for (let i = 1; i <= list.length; i++) {
      const k = list[(start + i) % list.length];
      if (!pts[k.id]) return k.id;
    }
    return null;
  }, []);

  const place = useCallback((id, xy, { keepActive = false } = {}) => {
    setPoints((prev) => {
      const nextView = { ...prev[view], [id]: [xy[0], xy[1]] };
      if (!keepActive) setActive(nextMissing(view, nextView, id));
      return { ...prev, [view]: nextView };
    });
    setAiConf((prev) => {
      if (prev[view][id] == null) return prev;
      const c = { ...prev[view] }; delete c[id];
      return { ...prev, [view]: c };
    });
  }, [view, nextMissing]);

  const removePoint = (id) => {
    setPoints((prev) => { const c = { ...prev[view] }; delete c[id]; return { ...prev, [view]: c }; });
    setActive(id);
  };

  // Teclado: flechas para ajuste fino (Shift = 10 px), Supr para borrar, Esc para soltar
  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (!active) return;
      const step = e.shiftKey ? 10 : 1;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (d && vpts[active]) {
        e.preventDefault();
        place(active, [vpts[active][0] + d[0], vpts[active][1] + d[1]], { keepActive: true });
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && vpts[active]) {
        removePoint(active);
      } else if (e.key === 'Escape') {
        setActive(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const loadImage = (v, file) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setImages((prev) => {
      if (prev[v]?.url) URL.revokeObjectURL(prev[v].url);
      return { ...prev, [v]: { url, width: img.naturalWidth, height: img.naturalHeight, name: file.name, file } };
    });
    img.onerror = () => setToast({ kind: 'error', text: tx("No se pudo leer la imagen.") });
    img.src = url;
  };

  const switchView = (v) => {
    setView(v);
    setActive(nextMissing(v, points[v], VIEWS[v].points[VIEWS[v].points.length - 1].id));
  };

  // ---------------------------------------------------------------- cálculo en vivo
  const inp = useMemo(() => ({
    photo1: points.photo1, photo2: points.photo2,
    bladeLength: Number(turbine.bladeLength), bladeLengthRef: turbine.bladeLengthRef,
    rotorDiameter: Number(turbine.rotorDiameter) || 0, towerHeight: Number(turbine.towerHeight) || 0,
    axisSource: turbine.axisSource,
  }), [points, turbine]);

  const { result, error } = useMemo(() => {
    const miss = missingPoints(points.photo1, points.photo2);
    if (miss.length) return { result: null, error: tx("{{n}} punto(s) pendiente(s)", { n: miss.length }) };
    if (!(inp.bladeLength > 0)) return { result: null, error: tx("Captura la longitud de pala") };
    try {
      return { result: compute(inp), error: null };
    } catch (e) {
      if (e instanceof GeometryError) return { result: null, error: e.message };
      throw e;
    }
  }, [inp, points]);

  const uncertainty = useMemo(() => (result ? monteCarlo(inp, sigmaPx) : {}), [result, inp, sigmaPx]);
  const overlay = view === 'photo1' ? (result?.overlay || partialOverlay(points.photo1)) : null;

  // ---------------------------------------------------------------- IA (Hugging Face)
  const detect = async () => {
    const img = images[view];
    if (!img || !apiUrl) return;
    setBusy('Detectando puntos…');
    try {
      const fd = new FormData();
      fd.append('image', img.file, img.name);
      fd.append('view', view);
      const res = await fetch(`${apiUrl.replace(/\/$/, '')}/detect`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      const found = Object.entries(data.keypoints).filter(([, v]) => v);
      setPoints((prev) => ({
        ...prev,
        [view]: { ...prev[view], ...Object.fromEntries(found.map(([k, v]) => [k, v.xy])) },
      }));
      setAiConf((prev) => ({ ...prev, [view]: Object.fromEntries(found.map(([k, v]) => [k, v.conf])) }));
      setToast({ kind: 'ok', text: tx("IA: {{length}}/{{v2}} puntos. Revisa los marcados en violeta.", { length: found.length, v2: defs.length }) });
    } catch (e) {
      setToast({ kind: 'error', text: tx("Detección falló: {{message}}", { message: e.message }) });
    } finally {
      setBusy('');
    }
  };

  // ---------------------------------------------------------------- exportar / importar
  const sources = () => Object.fromEntries(['photo1', 'photo2'].map((v) => [v, images[v]
    ? { fileName: images[v].name, width: images[v].width, height: images[v].height } : null]));

  const exportWtgm = async () => {
    try {
      const usedAi = Object.values(aiConf).some((o) => Object.keys(o).length);
      const doc = await buildWtgm({ turbine, result, uncertainty, sources: sources(), method: usedAi ? 'ai+review' : 'manual', sigmaPx });
      downloadJson(doc, wtgmFileName(turbine), WTGM_MIME);
      setToast({ kind: 'ok', text: `Generado ${wtgmFileName(turbine)}` });
    } catch (e) {
      setToast({ kind: 'error', text: e.message });
    }
  };

  const exportAnnotations = () => {
    const items = ['photo1', 'photo2'].filter((v) => images[v]).map((v) => ({
      image: images[v].name, view: v, width: images[v].width, height: images[v].height, keypoints: points[v],
    }));
    if (!items.length) return setToast({ kind: 'error', text: tx("Carga al menos una foto.") });
    downloadJson({ schema: 'wtg-keypoints/1', turbine, items }, `${(turbine.type || tx("turbina")).replace(/[^\w.-]+/g, '-')}.wtg-annotations.json`);
    return null;
  };

  const importAnnotations = async (file) => {
    try {
      const data = JSON.parse(await file.text());
      if (data.schema !== 'wtg-keypoints/1') throw new Error(tx("No es un archivo de anotaciones wtg-keypoints/1"));
      const next = { photo1: {}, photo2: {} };
      data.items.forEach((it) => { next[it.view] = it.keypoints; });
      setPoints(next);
      if (data.turbine) setTurbine({ ...EMPTY_TURBINE, ...data.turbine });
      setToast({ kind: 'ok', text: tx("Anotaciones cargadas. Vuelve a cargar las fotos correspondientes.") });
    } catch (e) {
      setToast({ kind: 'error', text: e.message });
    }
  };

  const resetAll = () => {
    if (!window.confirm(tx("¿Borrar todos los puntos y datos de la turbina?"))) return;
    setPoints({ photo1: {}, photo2: {} });
    setAiConf({ photo1: {}, photo2: {} });
    setTurbine(EMPTY_TURBINE);
    setInfoDone(false);
    setRecordId(null);
    setActive(VIEWS[view].points[0].id);
  };

  const t = (k) => (e) => setTurbine((s) => ({ ...s, [k]: e.target.value }));

  // Cualquier cambio posterior al último guardado deja la calibración "sin guardar"
  useEffect(() => { setDirtySinceSave(true); }, [turbine, points, images, sigmaPx]);

  const confirmInfo = (draft) => {
    setTurbine((s) => ({ ...s, ...draft }));
    setInfoDone(true);
  };

  const canSave = Boolean(onSave && result && images.photo1 && images.photo2);
  const saveTitle = canSave
    ? tx("Guardar la calibración y las fotos")
    : (!images.photo1 || !images.photo2 ? tx("Carga las 2 fotos para guardar") : error || tx("Completa las marcaciones"));

  const saveCalibration = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const usedAi = Object.values(aiConf).some((o) => Object.keys(o).length);
      const method = usedAi ? 'ai+review' : 'manual';
      const wtgm = await buildWtgm({ turbine, result, uncertainty, sources: sources(), method, sigmaPx });
      const saved = await onSave({
        id: recordId, turbine, points, images, result, uncertainty, wtgm, method, sigmaPx,
        missingFields: missingInfo(turbine).map((f) => f.key),
      });
      setRecordId(saved?.id ?? recordId);
      setDirtySinceSave(false);
      setToast({ kind: 'ok', text: tx("Calibración guardada.") });
    } catch (e) {
      setToast({ kind: 'error', text: tx("No se pudo guardar: {{e}}", { e: e.message || e }) });
    } finally {
      setSaving(false);
    }
  };
  const doneCount = (v) => VIEWS[v].points.filter((k) => points[v][k.id]).length;

  return (
    <div className="wc">
      <header className="wc-head">
        <p className="wc-caption">{tx("Survey Shot · 2 fotos laterales a 90° de la góndola")}</p>
        <div className="wc-actions">
          <label className="wc-btn wc-btn--ghost">
            {tx("Importar anotaciones")}
            <input type="file" accept=".json,application/json" hidden
              onChange={(e) => e.target.files[0] && importAnnotations(e.target.files[0])} />
          </label>
          <button type="button" className="wc-btn wc-btn--ghost" onClick={exportAnnotations}>{tx("Exportar anotaciones")}</button>
          <button type="button" className="wc-btn wc-btn--ghost" onClick={resetAll}>{tx("Reiniciar")}</button>
          {allowExport && (
            <button type="button" className="wc-btn wc-btn--primary" disabled={!result} onClick={exportWtgm}
              title={result ? tx("Descargar archivo para la app de vuelo") : error}>
              {tx("Generar .wtgm")}
            </button>
          )}
          {onSave && (
            <>
              {recordId && !dirtySinceSave && <span className="wc-saved" role="status">{tx("Guardado")}</span>}
              <button type="button" className="wc-btn wc-btn--primary" disabled={!canSave || saving}
                onClick={saveCalibration} title={saveTitle}>
                {saving ? 'Guardando…' : tx("Guardar")}
              </button>
            </>
          )}
        </div>
      </header>

      <section className="wc-turbine" aria-label={tx("Datos de la turbina")}>
        <Field label={tx("Fabricante")}><input value={turbine.manufacturer} onChange={t('manufacturer')} placeholder="Vestas" /></Field>
        <Field label={tx("Modelo WTG")}><input value={turbine.type} onChange={t('type')} placeholder="V112" /></Field>
        <Field label={tx("Parque")}><input value={turbine.windpark} onChange={t('windpark')} placeholder="Windy Heights" /></Field>
        <Field label={tx("Potencia")}><input value={turbine.powerRating} onChange={t('powerRating')} placeholder="3.45 MW" /></Field>
        <Field label={tx("Diámetro rotor (m)")}><input type="number" step="0.1" value={turbine.rotorDiameter} onChange={t('rotorDiameter')} placeholder="112" /></Field>
        <Field label={tx("Altura torre (m)")}><input type="number" step="0.1" value={turbine.towerHeight} onChange={t('towerHeight')} placeholder="94" /></Field>
        <Field label={tx("Long. pala (m)")} required><input type="number" step="0.01" value={turbine.bladeLength} onChange={t('bladeLength')} placeholder="54.65" /></Field>
        <Field label={tx("Medida desde")}>
          <select value={turbine.bladeLengthRef} onChange={t('bladeLengthRef')}>
            <option value="flange">{tx("Brida → punta")}</option>
            <option value="hub">{tx("Centro buje → punta")}</option>
          </select>
        </Field>
        <Field label={tx("Eje del rotor")}>
          <select value={turbine.axisSource} onChange={t('axisSource')}>
            <option value="nacelle_roof">{tx("Techo góndola")}</option>
            <option value="spinner">{tx("Spinner")}</option>
          </select>
        </Field>
      </section>

      <main className="wc-body">
        <aside className="wc-points">
          <div className="wc-tabs" role="tablist">
            {Object.entries(VIEWS).map(([v, d]) => (
              <button key={v} type="button" role="tab" aria-selected={view === v}
                className={view === v ? 'is-on' : ''} onClick={() => switchView(v)}>
                <span>{tx(d.title)}</span>
                <small>{doneCount(v)}/{d.points.length}</small>
              </button>
            ))}
          </div>
          <p className="wc-sub">{tx(VIEWS[view].subtitle)}</p>
          {active && defs.find((k) => k.id === active) && (
            <div className="wc-guide-card">
              <PointGuide view={view} point={defs.find((k) => k.id === active)} />
              <div className="wc-guide-text">
                <strong>{defs.findIndex((k) => k.id === active) + 1}. {tx(defs.find((k) => k.id === active).label)}</strong>
                <p>{tx(defs.find((k) => k.id === active).hint)}</p>
                <small>{tx("Se usa para:")} {tx(defs.find((k) => k.id === active).use)}</small>
              </div>
            </div>
          )}
          <ol className="wc-list">
            {defs.map((k, i) => {
              const p = vpts[k.id];
              const conf = aiConf[view][k.id];
              return (
                <li key={k.id} className={[k.id === active && 'is-active', p && 'is-done', conf != null && 'is-ai'].filter(Boolean).join(' ')}>
                  <button type="button" onClick={() => setActive(k.id)}>
                    <span className="wc-num">{i + 1}</span>
                    <span className="wc-lbl">
                      {tx(k.label)}
                    </span>
                    {conf != null && <span className="wc-conf">{Math.round(conf * 100)}%</span>}
                  </button>
                  {p && <button type="button" className="wc-x" aria-label={tx("Borrar {{label}}", { label: tx(k.label) })} onClick={() => removePoint(k.id)}>×</button>}
                </li>
              );
            })}
          </ol>
          <div className="wc-ai">
            <label htmlFor="wc-api">{tx("Endpoint IA (Hugging Face)")}</label>
            <input id="wc-api" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://usuario-wtg-measure.hf.space" />
            <button type="button" className="wc-btn wc-btn--ai" disabled={!apiUrl || !images[view] || !!busy} onClick={detect}>
              {busy || tx("Detectar puntos en {{title}}", { title: tx(VIEWS[view].title) })}
            </button>
          </div>
          <p className="wc-help">{tx("Clic: colocar · Arrastrar: mover vista o punto · Rueda: zoom · Flechas: ajuste fino (Shift ×10) · Supr: borrar")}</p>
        </aside>

        <section className="wc-stage">
          <CalibrationCanvas
            key={view}
            view={view}
            image={images[view]}
            points={vpts}
            aiConf={aiConf[view]}
            active={active}
            onPlace={place}
            onSelect={setActive}
            overlay={overlay}
            onDropFile={(f) => loadImage(view, f)}
          />
          {images[view] && (
            <div className="wc-stagebar">
              <span>{images[view].name} · {images[view].width}×{images[view].height}px</span>
              <label className="wc-link-btn">
                {tx("Cambiar foto")}
                <input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && loadImage(view, e.target.files[0])} />
              </label>
            </div>
          )}
        </section>

        <aside className="wc-results">
          <div className="wc-results-head">
            <h2>{tx("Valores calculados")}</h2>
            <label className="wc-sigma" title={tx("Error de clic supuesto para la incertidumbre")}>
              ±<input type="number" min="0" max="20" step="0.5" value={sigmaPx} onChange={(e) => setSigmaPx(Number(e.target.value))} /> px
            </label>
          </div>
          {!result && <p className="wc-pending">{error}</p>}
          <table className="wc-table">
            <thead>
              <tr><th>{tx("Campo")}</th><th>{tx("Valor")}</th><th>±1σ</th><th>{tx("Gen.")}</th></tr>
            </thead>
            <tbody>
              {FIELDS.map((f) => {
                const v = result?.values[f.id];
                const dev = v != null ? (v - GENERIC[f.id]) / GENERIC[f.id] : 0;
                return (
                  <tr key={f.id} title={tx(f.label)}>
                    <td><code>{f.id}</code><small>{tx(f.label)}</small></td>
                    <td className="wc-val">{v != null ? `${v.toFixed(f.unit === '°' ? 2 : 3)} ${f.unit}` : '—'}</td>
                    <td className="wc-unc">{Number.isFinite(uncertainty[f.id]) ? uncertainty[f.id].toFixed(f.unit === '°' ? 2 : 3) : ''}</td>
                    <td className={`wc-gen${Math.abs(dev) > 0.35 ? ' is-far' : ''}`}>{GENERIC[f.id]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {result && (
            <dl className="wc-diag">
              <dt>{tx("Escala foto 1")}</dt><dd>{(result.diagnostics.scaleMetersPerPixel * 100).toFixed(2)} cm/px</dd>
              <dt>{tx("Radio rotor estimado")}</dt><dd>{result.diagnostics.rotorRadiusEstimated.toFixed(2)} m
                {result.diagnostics.rotorRadiusErrorPct != null && ` (${result.diagnostics.rotorRadiusErrorPct >= 0 ? '+' : ''}${result.diagnostics.rotorRadiusErrorPct.toFixed(1)}% vs D/2)`}</dd>
              <dt>{tx("Prebend en la punta")}</dt><dd>{result.diagnostics.bladePrebendTip.toFixed(2)} m</dd>
              <dt>{tx("Eje: techo / spinner")}</dt><dd>{result.diagnostics.rotorAxisAngleFromRoof.toFixed(2)}° / {result.diagnostics.rotorAxisAngleFromSpinner.toFixed(2)}°</dd>
              <dt>{tx("Roll torre foto 1")}</dt><dd>{result.diagnostics.photo1TowerRollDeg.toFixed(2)}°</dd>
            </dl>
          )}
          {result?.warnings.length > 0 && (
            <ul className="wc-warn">{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          )}
        </aside>
      </main>

      {infoOpen && <TurbineInfoDialog initial={turbine} onConfirm={confirmInfo} />}

      {toast && <div className={`wc-toast wc-toast--${toast.kind}`} role="status">{toast.text}</div>}
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="wc-field">
      <span>{label}{required && <b aria-hidden="true">*</b>}</span>
      {children}
    </label>
  );
}
