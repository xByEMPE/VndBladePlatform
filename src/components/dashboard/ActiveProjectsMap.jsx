import React, { useMemo, useRef } from 'react';
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre';
import { Wind, MapPinOff } from 'lucide-react';
import maplibregl from '@/lib/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { tx } from '@/i18n/tx';
import { cn } from '@/lib/utils';
import { getInitialViewState } from '@/lib/coordinates';
import { getMapStyle, DEFAULT_MAP_STYLE } from '@/lib/mapStyles';
import BentoCard from '@/components/ui/BentoCard';
import Overline from '@/components/ui/Overline';
import EmptyState from '@/components/ui/EmptyState';

const FIT_OPTIONS = { padding: 60, maxZoom: 12 };

/**
 * Mapa de los parques eólicos (proyectos activos). Cada proyecto se ubica en el centro de sus turbinas.
 * @param {{
 *   items: Array<{ id: string, name: string, statusKey: string, statusLabel: string,
 *                  position: { lat: number, lon: number } | null }>,
 *   styleKey?: string,
 * }} props
 */
const ActiveProjectsMap = ({ items, styleKey = DEFAULT_MAP_STYLE }) => {
  const mapRef = useRef(null);
  const positioned = useMemo(() => items.filter((i) => i.position), [items]);
  const unlocated = items.length - positioned.length;
  const viewState = useMemo(
    () => getInitialViewState(positioned.map((i) => i.position), FIT_OPTIONS),
    [positioned],
  );

  return (
    <BentoCard as="section" flat aria-labelledby="active-projects-map-title" className="flex flex-col">
      <div className="flex items-center justify-between border-b border-line-subtle px-5 py-4">
        <Overline as="h2" id="active-projects-map-title">{tx('Parques eólicos activos')}</Overline>
        <span className="text-xs text-ink-muted tabular-nums">
          {positioned.length} {tx('en mapa')}
          {unlocated > 0 && ` · ${unlocated} ${tx('sin ubicación')}`}
        </span>
      </div>

      {positioned.length === 0 ? (
        <EmptyState icon={MapPinOff}>{tx('Ningún proyecto activo tiene ubicación')}</EmptyState>
      ) : (
        <div className="relative h-[320px] overflow-hidden rounded-b-lg">
          <Map
            ref={mapRef}
            mapLib={maplibregl}
            initialViewState={viewState}
            mapStyle={getMapStyle(styleKey).url}
            style={{ width: '100%', height: '100%' }}
            aria-label={tx('Mapa de parques eólicos activos')}
          >
            <NavigationControl position="top-right" showCompass />
            {positioned.map((item) => (
              <Marker key={item.id} longitude={item.position.lon} latitude={item.position.lat} anchor="center">
                <div
                  title={`${item.name} · ${item.statusLabel}`}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-status-done bg-surface-panel text-status-done shadow-md',
                  )}
                >
                  <Wind size={18} aria-hidden="true" />
                  <span className="sr-only">{item.name}</span>
                </div>
              </Marker>
            ))}
          </Map>
        </div>
      )}
    </BentoCard>
  );
};

export default ActiveProjectsMap;
