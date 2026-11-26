/**
 * Dónde abrir la tarjeta de una turbina para que NUNCA quede cortada por el borde del mapa.
 *
 * MapLibre puede elegir el ancla solo, pero lo decide antes de que la tarjeta tenga su tamaño final (la foto carga
 * después) y no sabe que la figura de la turbina ocupa espacio sobre la coordenada. Aquí se decide con el espacio
 * real del mapa y el tamaño de la tarjeta.
 *
 * Orden de preferencia: arriba de la figura → debajo de la etiqueta → a un lado (a la derecha, luego a la izquierda).
 * Si no cabe en ningún sitio, se usa el lado vertical con más espacio y se devuelve `maxHeight` para que la tarjeta
 * desplace por dentro en vez de salirse.
 *
 * Anclas de MapLibre: "bottom" = la tarjeta queda ARRIBA del punto; "top" = ABAJO; "left" = a la DERECHA; "right" = a
 * la IZQUIERDA. Los sufijos "-left"/"-right" la alinean hacia dentro cuando el punto está cerca de un borde lateral.
 *
 * @param {{
 *   point: {x:number,y:number}|null,           // posición de la coordenada en píxeles del mapa
 *   container: {w:number,h:number},            // tamaño del mapa
 *   card: {w:number,h:number},                 // tamaño estimado de la tarjeta (incluye su relleno)
 *   figureHeight: number, labelHeight: number, // alto de la figura (sobre el punto) y de la etiqueta (bajo el punto)
 *   margin?: number,
 * }} args
 * @returns {{ anchor: string, maxHeight: number|undefined }}
 */
const MIN_MAX_HEIGHT = 160; // por debajo de esto la tarjeta sería ilegible
const SIDE_GAP = 30; // separación horizontal cuando se abre a un lado (igual que el lateral de POPUP_OFFSETS en TurbineMap)

export const choosePopupPlacement = ({ point, container, card, figureHeight, labelHeight, margin = 8 }) => {
  if (!point || !container?.w || !container?.h) return { anchor: 'bottom', maxHeight: undefined };

  const { x, y } = point;
  const atLeast = (v) => Math.max(MIN_MAX_HEIGHT, Math.floor(v));

  const spaceAbove = y - figureHeight - margin;
  const spaceBelow = container.h - y - labelHeight - margin;
  const spaceRight = container.w - x - SIDE_GAP - margin;
  const spaceLeft = x - SIDE_GAP - margin;

  // Alineación horizontal al abrir arriba/abajo: si la tarjeta centrada se saldría, que crezca hacia dentro.
  const half = card.w / 2;
  let suffix = '';
  if (card.w < container.w - 2 * margin) {
    if (x - half < margin) suffix = '-left';
    else if (x + half > container.w - margin) suffix = '-right';
  }

  if (spaceAbove >= card.h) return { anchor: `bottom${suffix}`, maxHeight: atLeast(spaceAbove) };
  if (spaceBelow >= card.h) return { anchor: `top${suffix}`, maxHeight: atLeast(spaceBelow) };

  const sideMax = container.h - 2 * margin;
  if (spaceRight >= card.w) return { anchor: 'left', maxHeight: atLeast(sideMax) };
  if (spaceLeft >= card.w) return { anchor: 'right', maxHeight: atLeast(sideMax) };

  return spaceAbove >= spaceBelow
    ? { anchor: `bottom${suffix}`, maxHeight: atLeast(spaceAbove) }
    : { anchor: `top${suffix}`, maxHeight: atLeast(spaceBelow) };
};
