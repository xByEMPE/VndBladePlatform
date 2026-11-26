import { useTranslation } from "react-i18next";
import { tx } from "@/i18n/tx";
// Esquema de apoyo: muestra DÓNDE va el punto que se está marcando.
// Coordenadas en un lienzo 300 × 260 (foto 1: vista lateral, pala hacia abajo, rotor a la izquierda).

const P1 = {
  spinner_tip: [46, 74],
  hub_rear: [82, 74],
  nacelle_roof_front: [84, 54],
  nacelle_roof_rear: [206, 54],
  nacelle_bottom: [150, 92],
  tower_top_up: [140, 94],
  tower_top_down: [160, 94],
  tower_low_up: [134, 226],
  tower_low_down: [166, 226],
  flange_up: [86, 112],
  flange_down: [104, 112],
  chord_up: [78, 150],
  chord_down: [116, 150],
  blade_tip: [96, 252],
};

const P2 = {
  tower_top_left: [112, 46],
  tower_top_right: [188, 46],
  tower_base_left: [84, 226],
  tower_base_right: [216, 226],
};

// Puntos que forman pareja con cada uno (se resaltan juntos)
const PAIRS = {
  tower_top_up: 'tower_top_down', tower_top_down: 'tower_top_up',
  tower_low_up: 'tower_low_down', tower_low_down: 'tower_low_up',
  flange_up: 'flange_down', flange_down: 'flange_up',
  chord_up: 'chord_down', chord_down: 'chord_up',
  nacelle_roof_front: 'nacelle_roof_rear', nacelle_roof_rear: 'nacelle_roof_front',
  spinner_tip: 'hub_rear', hub_rear: 'spinner_tip',
  tower_top_left: 'tower_top_right', tower_top_right: 'tower_top_left',
  tower_base_left: 'tower_base_right', tower_base_right: 'tower_base_left',
};

function Photo1Scene() {
  return (
    <g className="wc-guide-body">
      {/* torre */}
      <polygon points="139,94 161,94 167,230 133,230" />
      {/* góndola */}
      <rect x="82" y="54" width="126" height="38" rx="4" />
      {/* spinner */}
      <polygon points="46,74 82,56 82,92" />
      {/* pala: raíz cilíndrica (brida) -> cuerda máxima -> punta */}
      <path d="M86 94 L86 112 L78 150 L93 250 L96 254 L99 250 L116 150 L104 112 L104 94 Z" />
      {/* eje del rotor */}
      <line x1="30" y1="74" x2="130" y2="74" className="wc-guide-axis" />
      <g className="wc-guide-label">
        <text x="20" y="48">{tx("Spinner")}</text>
        <text x="212" y="76">{tx("Góndola")}</text>
        <text x="170" y="170">{tx("Torre")}</text>
        <text x="124" y="200">{tx("Pala")}</text>
        <text x="12" y="68">{tx("eje")}</text>
      </g>
    </g>
  );
}

function Photo2Scene() {
  return (
    <g className="wc-guide-body">
      <rect x="92" y="14" width="116" height="26" rx="4" />
      <polygon points="112,40 188,40 216,230 84,230" />
      <line x1="60" y1="230" x2="240" y2="230" className="wc-guide-axis" />
      <g className="wc-guide-label">
        <text x="214" y="30">{tx("Góndola")}</text>
        <text x="226" y="140">{tx("Torre")}</text>
        <text x="124" y="248">{tx("Cimentación")}</text>
      </g>
    </g>
  );
}

export default function PointGuide({ view, point }) {
  useTranslation();
  const pts = view === 'photo1' ? P1 : P2;
  const active = point?.id;
  const mate = PAIRS[active];
  return (
    <figure className="wc-guide" aria-label={tx("Esquema: {{label}}", { label: tx(point?.label ?? '') })}>
      <svg viewBox="0 0 300 268" role="img" aria-hidden="true">
        {view === 'photo1' ? <Photo1Scene /> : <Photo2Scene />}
        {Object.entries(pts).map(([id, [x, y]]) => {
          const isActive = id === active;
          const isMate = id === mate;
          return (
            <g key={id} className={isActive ? 'is-active' : isMate ? 'is-mate' : ''}>
              <circle cx={x} cy={y} r={isActive ? 6 : isMate ? 4.5 : 2.5} />
              {isActive && <circle cx={x} cy={y} r="11" className="wc-guide-pulse" />}
            </g>
          );
        })}
        {mate && active && (
          <line x1={pts[active][0]} y1={pts[active][1]} x2={pts[mate][0]} y2={pts[mate][1]} className="wc-guide-pair" />
        )}
      </svg>
    </figure>
  );
}
