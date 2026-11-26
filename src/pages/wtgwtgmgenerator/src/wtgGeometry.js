import { tx } from "@/i18n/tx";
// Port 1:1 de ml/wtg_geometry.py — mantener ambos sincronizados (ver scripts/parity.mjs).

export const PHOTO1_KEYPOINTS = [
  { id: 'spinner_tip', label: 'Punta del spinner', hint: 'Extremo delantero del cono (spinner), justo en la punta, a la altura del eje del rotor (centro del cono).', use: 'Largo del buje (con el punto 2) y dirección del eje.' },
  { id: 'hub_rear', label: 'Unión spinner / góndola', hint: 'Donde el cono se une al resto del buje/góndola, sobre el mismo eje del rotor (centro vertical del cono en esa unión).', use: 'Largo del buje y origen del eje del rotor.' },
  { id: 'nacelle_roof_front', label: 'Techo góndola · frente', hint: 'Esquina SUPERIOR delantera del techo de la góndola (la más cercana al buje).', use: 'Inclinación del eje del rotor (con el punto 4) y grosor de la góndola.' },
  { id: 'nacelle_roof_rear', label: 'Techo góndola · atrás', hint: 'Esquina SUPERIOR trasera del techo de la góndola (la más lejana al buje).', use: 'Inclinación del eje del rotor (con el punto 3).' },
  { id: 'nacelle_bottom', label: 'Fondo de la góndola', hint: 'Cualquier punto del borde INFERIOR de la góndola, debajo del techo.', use: 'Grosor (alto) de la góndola.' },
  { id: 'tower_top_up', label: 'Torre arriba · lado rotor', hint: 'Borde de la torre del lado del rotor, justo debajo de la góndola.', use: 'Radio de la torre en la cima y vertical de la torre.' },
  { id: 'tower_top_down', label: 'Torre arriba · lado trasero', hint: 'Borde opuesto de la torre, a LA MISMA ALTURA que el punto 6.', use: 'Radio de la torre en la cima.' },
  { id: 'tower_low_up', label: 'Torre abajo · lado rotor', hint: 'Borde de la torre del lado del rotor, lo más abajo que se vea en la foto.', use: 'Vertical de la torre (con el punto 9).' },
  { id: 'tower_low_down', label: 'Torre abajo · lado trasero', hint: 'Borde opuesto de la torre, a LA MISMA ALTURA que el punto 8.', use: 'Vertical de la torre.' },
  { id: 'flange_up', label: 'Brida · lado rotor', hint: 'RAÍZ de la pala: tramo cilíndrico donde la pala sale del buje. Marca su borde del lado del rotor, justo al salir del buje.', use: 'Radio de la brida, eje de la pala y distancia buje → brida.' },
  { id: 'flange_down', label: 'Brida · lado trasero', hint: 'Borde opuesto del cilindro de la raíz, a LA MISMA ALTURA que el punto 10.', use: 'Radio de la brida y eje de la pala.' },
  { id: 'chord_up', label: 'Cuerda máx. · lado rotor', hint: 'Zona MÁS ANCHA de la pala (la «hombrera», cerca de la raíz). Marca su borde del lado del rotor en el punto de mayor ancho.', use: 'Cuerda máxima, inclinación (cono) de la pala y distancia buje → cuerda máx.' },
  { id: 'chord_down', label: 'Cuerda máx. · lado trasero', hint: 'Borde opuesto de la pala, a LA MISMA ALTURA que el punto 12 (donde la pala es más ancha).', use: 'Cuerda máxima y eje de la pala.' },
  { id: 'blade_tip', label: 'Punta de pala', hint: 'Extremo más lejano de la pala respecto al buje (el final de la punta, hacia abajo).', use: 'Escala de la foto (con la longitud de pala que capturaste).' },
];

export const PHOTO2_KEYPOINTS = [
  { id: 'tower_top_left', label: 'Torre arriba · izquierda', hint: 'Borde izquierdo de la torre, justo debajo de la góndola.', use: 'Afinamiento de la torre (con los puntos de la base).' },
  { id: 'tower_top_right', label: 'Torre arriba · derecha', hint: 'Borde derecho de la torre, a LA MISMA ALTURA que el punto 1.', use: 'Afinamiento de la torre.' },
  { id: 'tower_base_left', label: 'Torre base · izquierda', hint: 'Borde izquierdo de la torre en su base, justo sobre la cimentación.', use: 'Radio de la torre en la base.' },
  { id: 'tower_base_right', label: 'Torre base · derecha', hint: 'Borde derecho de la torre en su base, a LA MISMA ALTURA que el punto 3.', use: 'Radio de la torre en la base.' },
];

export const FIELDS = [
  { id: 'hubLength', unit: 'm', label: 'Largo del buje (spinner)' },
  { id: 'bladeFlangeRadius', unit: 'm', label: 'Radio de la brida de pala' },
  { id: 'bladeMaxChordWidth', unit: 'm', label: 'Cuerda máxima de la pala' },
  { id: 'hubCenterToBladeFlange', unit: 'm', label: 'Centro del buje a la brida' },
  { id: 'hubCenterToMaxChordWidth', unit: 'm', label: 'Centro del buje a la cuerda máxima' },
  { id: 'bladeTiltAngle', unit: '°', label: 'Inclinación (cono) de la pala' },
  { id: 'rotorAxisAngle', unit: '°', label: 'Inclinación del eje del rotor' },
  { id: 'towerCenterToHubCenter', unit: 'm', label: 'Voladizo torre → buje' },
  { id: 'towerBottomRadius', unit: 'm', label: 'Radio de la torre en la base' },
  { id: 'towerTopRadius', unit: 'm', label: 'Radio de la torre en la cima' },
  { id: 'nacelleThickness', unit: 'm', label: 'Grosor de la góndola' },
];

export const GENERIC = {
  hubLength: 2.5, bladeFlangeRadius: 1.255, bladeMaxChordWidth: 3.8, hubCenterToBladeFlange: 2.0,
  hubCenterToMaxChordWidth: 12.4, bladeTiltAngle: 4.5, rotorAxisAngle: 9.0,
  towerCenterToHubCenter: 3.0, towerBottomRadius: 3.0, towerTopRadius: 2.0, nacelleThickness: 2.5,
};

const PLAUSIBLE = {
  hubLength: [1, 8], bladeFlangeRadius: [0.6, 2.5], bladeMaxChordWidth: [1.5, 6.5],
  hubCenterToBladeFlange: [0.8, 4], hubCenterToMaxChordWidth: [4, 25], bladeTiltAngle: [0, 8],
  rotorAxisAngle: [2, 12], towerCenterToHubCenter: [1.5, 8], towerBottomRadius: [1.5, 4],
  towerTopRadius: [1, 3], nacelleThickness: [2, 6],
};

export class GeometryError extends Error {}

const V = (p) => [p[0], -p[1]]; // imagen (y abajo) -> y arriba
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const norm = (a) => Math.hypot(a[0], a[1]);
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const deg = (r) => (r * 180) / Math.PI;
const unit = (a) => {
  const n = norm(a);
  if (n < 1e-9) throw new GeometryError(tx("Dos puntos coinciden; no se puede definir una dirección."));
  return [a[0] / n, a[1] / n];
};
const intersect = (p1, d1, p2, d2) => {
  const den = cross(d1, d2);
  if (Math.abs(den) < 1e-9) throw new GeometryError(tx("El eje de la pala y el eje del rotor son paralelos."));
  return add(p1, mul(d1, cross(sub(p2, p1), d2) / den));
};

export function missingPoints(photo1 = {}, photo2 = {}) {
  return [
    ...PHOTO1_KEYPOINTS.filter((k) => !photo1[k.id]).map((k) => `photo1.${k.id}`),
    ...PHOTO2_KEYPOINTS.filter((k) => !photo2[k.id]).map((k) => `photo2.${k.id}`),
  ];
}

/**
 * @param {{photo1: Object, photo2: Object, bladeLength: number, bladeLengthRef?: 'flange'|'hub',
 *          rotorDiameter?: number, towerHeight?: number, axisSource?: 'nacelle_roof'|'spinner'}} inp
 */
export function compute(inp) {
  const miss = missingPoints(inp.photo1, inp.photo2);
  if (miss.length) throw new GeometryError(`Faltan puntos: ${miss.join(', ')}`);
  if (!(inp.bladeLength > 0)) throw new GeometryError(tx("La longitud de pala debe ser > 0."));

  const P = Object.fromEntries(PHOTO1_KEYPOINTS.map((k) => [k.id, V(inp.photo1[k.id])]));

  const topMid = mid(P.tower_top_up, P.tower_top_down);
  const lowMid = mid(P.tower_low_up, P.tower_low_down);
  const u = unit(sub(topMid, lowMid));
  let h = [u[1], -u[0]];
  if (dot(sub(P.spinner_tip, topMid), h) < 0) h = mul(h, -1);
  const X = (p) => dot(sub(p, topMid), h);

  const angleOf = (d) => {
    const dx = dot(d, h), dy = dot(d, u);
    if (dx <= 0) throw new GeometryError(tx("Los puntos del eje deben ir de atrás (lado torre) hacia el rotor."));
    return deg(Math.atan2(dy, dx));
  };
  const rSpin = unit(sub(P.spinner_tip, P.hub_rear));
  const rRoof = unit(sub(P.nacelle_roof_front, P.nacelle_roof_rear));
  const angleSpin = angleOf(rSpin), angleRoof = angleOf(rRoof);
  const useSpinner = inp.axisSource === 'spinner';
  const r = useSpinner ? rSpin : rRoof;
  const rotorAxisAngle = useSpinner ? angleSpin : angleRoof;

  const F = mid(P.flange_up, P.flange_down);
  const C = mid(P.chord_up, P.chord_down);
  const T = P.blade_tip;
  // Eje de la pala = tramo recto de la raíz (brida -> cuerda máxima). La parte exterior viene
  // curvada hacia barlovento (prebend); usar la punta inflaría el cono.
  const b = unit(sub(C, F));
  const H = intersect(P.hub_rear, r, F, b);
  if (dot(b, u) > 0) throw new GeometryError(tx("La pala debe apuntar hacia abajo (posición Y del procedimiento)."));

  let pDir = [r[1], -r[0]];
  if (dot(pDir, u) > 0) pDir = mul(pDir, -1);
  const bladeTiltAngle = deg(Math.atan2(dot(b, r), dot(b, pDir)));

  // Longitud del fabricante = sobre el eje de pitch recto: se proyecta la punta sobre ese eje.
  const bladePx = inp.bladeLengthRef === 'hub' ? dot(sub(T, H), b) : dot(sub(T, F), b);
  if (bladePx <= 1) throw new GeometryError(tx("Longitud de pala en píxeles inválida."));
  const s = inp.bladeLength / bladePx;

  const towerTopRadius = (Math.abs(X(P.tower_top_up) - X(P.tower_top_down)) * s) / 2;

  const Q = Object.fromEntries(PHOTO2_KEYPOINTS.map((k) => [k.id, V(inp.photo2[k.id])]));
  const qTop = mid(Q.tower_top_left, Q.tower_top_right);
  const qBase = mid(Q.tower_base_left, Q.tower_base_right);
  const u2 = unit(sub(qTop, qBase));
  const h2 = [u2[1], -u2[0]];
  const wTop2 = Math.abs(dot(sub(Q.tower_top_right, Q.tower_top_left), h2));
  const wBase2 = Math.abs(dot(sub(Q.tower_base_right, Q.tower_base_left), h2));
  if (wTop2 < 1) throw new GeometryError(tx("Ancho de torre en la cima (foto 2) inválido."));

  const values = {
    hubLength: norm(sub(P.spinner_tip, P.hub_rear)) * s,
    bladeFlangeRadius: (Math.abs(cross(sub(P.flange_down, P.flange_up), b)) * s) / 2,
    bladeMaxChordWidth: Math.abs(cross(sub(P.chord_down, P.chord_up), b)) * s,
    hubCenterToBladeFlange: dot(sub(F, H), b) * s,
    hubCenterToMaxChordWidth: dot(sub(C, H), b) * s,
    bladeTiltAngle,
    rotorAxisAngle,
    towerCenterToHubCenter: X(H) * s,
    towerBottomRadius: (towerTopRadius * wBase2) / wTop2,
    towerTopRadius,
    nacelleThickness: Math.abs(cross(sub(P.nacelle_bottom, P.nacelle_roof_front), rRoof)) * s,
  };

  const diagnostics = {
    scaleMetersPerPixel: s,
    bladePixels: bladePx,
    photo2TaperRatio: wBase2 / wTop2,
    rotorAxisAngleFromSpinner: angleSpin,
    rotorAxisAngleFromRoof: angleRoof,
  };
  const warnings = [];
  if (Math.abs(angleSpin - angleRoof) > 2) {
    warnings.push(tx("Ángulo del eje: spinner {{v1}}° vs techo góndola {{v2}}°. Verifica los puntos.", { v1: angleSpin.toFixed(1), v2: angleRoof.toFixed(1) }));
  }
  // Radio real barrido por la punta = distancia de la punta al eje del rotor
  const rotorRadiusEst = Math.abs(cross(sub(T, H), r)) * s;
  diagnostics.rotorRadiusEstimated = rotorRadiusEst;
  let nUp = [b[1], -b[0]];
  if (dot(nUp, r) < 0) nUp = mul(nUp, -1);
  diagnostics.bladePrebendTip = dot(sub(T, F), nUp) * s; // + = hacia barlovento
  if (inp.rotorDiameter > 0) {
    const R = inp.rotorDiameter / 2;
    const err = ((rotorRadiusEst - R) / R) * 100;
    diagnostics.rotorRadiusErrorPct = err;
    if (Math.abs(err) > 3) {
      warnings.push(tx("Radio de rotor estimado {{v1}} m difiere {{v2}}% de D/2 ({{v3}} m). Revisa la longitud de pala o su referencia.", { v1: rotorRadiusEst.toFixed(2), v2: err.toFixed(1), v3: R.toFixed(2) }));
    }
  }
  if (inp.towerHeight > 0) {
    const s2 = inp.towerHeight / dot(sub(qTop, qBase), u2);
    diagnostics.towerTopRadiusFromPhoto2 = (wTop2 * s2) / 2;
    diagnostics.towerBottomRadiusFromPhoto2 = (wBase2 * s2) / 2;
  }
  const roll = deg(Math.atan2(u[0], u[1]));
  diagnostics.photo1TowerRollDeg = roll;
  if (Math.abs(roll) > 5) warnings.push(tx("La torre aparece inclinada {{v1}}° en la foto 1 (roll del gimbal).", { v1: roll.toFixed(1) }));
  for (const [k, [lo, hi]] of Object.entries(PLAUSIBLE)) {
    if (!(values[k] >= lo && values[k] <= hi)) warnings.push(`${k} = ${values[k].toFixed(3)} fuera del rango típico [${lo}, ${hi}].`);
  }

  const img = (p) => [p[0], -p[1]];
  // Puntos auxiliares para dibujar ejes sobre la foto 1
  // Eje recto de la raíz prolongado hasta el largo de la pala: la separación con la punta = prebend
  const bladeEnd = img(add(H, mul(b, dot(sub(T, H), b))));
  const overlay = {
    hubCenter: img(H),
    towerAxisTop: img(topMid),
    towerAxisLow: img(lowMid),
    flangeCenter: img(F),
    chordCenter: img(C),
    rotorAxisA: img(sub(H, mul(r, bladePx * 0.25))),
    rotorAxisB: img(add(H, mul(r, bladePx * 0.08))),
    bladeAxisEnd: bladeEnd,
    bladeTip: img(T),
    prebendM: diagnostics.bladePrebendTip,
  };
  return { values, diagnostics, warnings, overlay };
}

/** Estimación partial: ejes que se pueden dibujar aunque falten puntos. */
export function partialOverlay(photo1 = {}) {
  const o = {};
  const has = (...ids) => ids.every((i) => photo1[i]);
  if (has('tower_top_up', 'tower_top_down')) o.towerAxisTop = mid(photo1.tower_top_up, photo1.tower_top_down);
  if (has('tower_low_up', 'tower_low_down')) o.towerAxisLow = mid(photo1.tower_low_up, photo1.tower_low_down);
  if (has('flange_up', 'flange_down')) o.flangeCenter = mid(photo1.flange_up, photo1.flange_down);
  if (has('chord_up', 'chord_down')) o.chordCenter = mid(photo1.chord_up, photo1.chord_down);
  return o;
}
