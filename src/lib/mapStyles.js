/**
 * Estilos de mapa disponibles (OpenFreeMap: tiles vectoriales OpenMapTiles con datos de OpenStreetMap).
 * Configuración desacoplada del componente: para añadir una capa nueva (p. ej. satélite) basta con
 * agregar una entrada aquí; TurbineMap solo recibe la clave (`styleKey`).
 *
 * `url` puede ser la URL de un style.json de MapLibre o un objeto de estilo inline (p. ej. ráster).
 * `attribution` lo incluye cada estilo; no se debe quitar el control de atribución del mapa.
 */
export const MAP_STYLES = Object.freeze({
  light: Object.freeze({
    key: 'light',
    label: 'Claro',
    url: 'https://tiles.openfreemap.org/styles/positron',
  }),
  dark: Object.freeze({
    key: 'dark',
    label: 'Oscuro',
    url: 'https://tiles.openfreemap.org/styles/dark',
  }),
  // Pendiente (fase posterior): satellite → { key: 'satellite', label: 'Satélite', url: <estilo ráster> }
});

/** La app es de tema oscuro; el estilo oscuro es el predeterminado. */
export const DEFAULT_MAP_STYLE = 'dark';

/** Definición del estilo; si la clave es desconocida usa el predeterminado. */
export const getMapStyle = (key) => MAP_STYLES[key] ?? MAP_STYLES[DEFAULT_MAP_STYLE];
