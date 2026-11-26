/**
 * Disposición de los marcadores del mapa según el espacio real en pantalla (lógica pura, sin React ni MapLibre).
 *
 * Un círculo de tamaño fijo se amontona cuando el zoom aleja las turbinas. Aquí se decide, con las posiciones en
 * píxeles: (1) qué tamaño darles, (2) si se dibujan como icono o como punto, (3) qué etiquetas caben sin pisarse y
 * (4) el orden de apilado.
 */
import { parseSeverity } from './severity';

export const DISC_MAX = 26; // diámetro de reposo con espacio de sobra (px)
export const DOT_MIN = 10; // diámetro mínimo: un punto de color
export const ICON_MIN = 18; // por debajo de este diámetro el aerogenerador interior no se lee: se dibuja un punto
const GAP = 2; // holgura entre círculos vecinos (px)
const QUANTILE = 0.15; // se dimensiona con los vecinos más juntos, pero sin que un solo par aislado encoja todo

const LABEL_HEIGHT = 12;
const LABEL_CHAR_WIDTH = 6;
const LABEL_MAX_WIDTH = 88;
const LABEL_PAD = 2;
const LABEL_OFFSET = 4; // separación entre el círculo y la etiqueta

const isFinitePoint = (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y);

/** Distancia (px) de cada punto a su vecino más cercano. Ignora los que no tienen coordenadas de pantalla. */
export const nearestNeighborDistances = (points) => {
  const valid = (points ?? []).filter(isFinitePoint);
  if (valid.length < 2) return [];
  return valid.map((p, i) => {
    let min = Infinity;
    for (let j = 0; j < valid.length; j += 1) {
      if (j === i) continue;
      const d = Math.hypot(p.x - valid[j].x, p.y - valid[j].y);
      if (d < min) min = d;
    }
    return min;
  });
};

/** Diámetro de los círculos (entre DOT_MIN y DISC_MAX) para que no se solapen en el parque visible. */
export const chooseMarkerSize = (distances) => {
  if (!distances?.length) return DISC_MAX;
  const sorted = [...distances].sort((a, b) => a - b);
  const q = sorted[Math.floor(QUANTILE * (sorted.length - 1))];
  return Math.min(DISC_MAX, Math.max(DOT_MIN, Math.floor(q - GAP)));
};

/** 'icon' si el círculo es lo bastante grande para mostrar el aerogenerador; 'dot' si no. */
export const markerMode = (size) => (size >= ICON_MIN ? 'icon' : 'dot');

const labelBox = (p, size) => {
  const w = Math.min(LABEL_MAX_WIDTH, String(p.name ?? '').length * LABEL_CHAR_WIDTH + 4);
  const top = p.y + size / 2 + LABEL_OFFSET;
  return { l: p.x - w / 2 - LABEL_PAD, r: p.x + w / 2 + LABEL_PAD, t: top - LABEL_PAD, b: top + LABEL_HEIGHT + LABEL_PAD };
};

const overlaps = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

/**
 * Ids cuyas etiquetas se muestran: se recorren por prioridad (más grave primero, luego por nombre) y se acepta la
 * etiqueta solo si no pisa a otra ya aceptada.
 * @param {{ points: Array<{id:string,name:string,x:number,y:number,priority:number}>, size: number }} args
 * @returns {Set<string>}
 */
export const pickLabelIds = ({ points, size }) => {
  const accepted = [];
  const ids = new Set();
  [...(points ?? [])]
    .filter(isFinitePoint)
    .sort((a, b) => b.priority - a.priority || String(a.name).localeCompare(String(b.name)))
    .forEach((p) => {
      const box = labelBox(p, size);
      if (accepted.some((o) => overlaps(box, o))) return;
      accepted.push(box);
      ids.add(p.id);
    });
  return ids;
};

/** Orden de apilado: la categoría más grave arriba; el marcador activo (hover/seleccionado) sobre todos. */
export const markerZIndex = (severity, active) => (active ? 1000 : (parseSeverity(severity) ?? 0) * 10);
