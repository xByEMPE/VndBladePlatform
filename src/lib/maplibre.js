// MapLibre GL listo para Vite: registra el worker de forma explícita.
//
// MapLibre 6 calcula la URL de su worker con `new URL('./maplibre-gl-worker.mjs', import.meta.url)`. Al
// empaquetarlo, Vite mueve `maplibre-gl` (a `node_modules/.vite/deps` en desarrollo y a `assets/` en
// producción) y el worker ya no está junto a él: el mapa queda vacío con "Worker failed to load".
// `?worker&url` hace que Vite empaquete el worker como archivo propio y devuelva su URL final.
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

maplibregl.setWorkerUrl(workerUrl);

export { workerUrl };
export default maplibregl;
