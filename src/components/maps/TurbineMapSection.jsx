import React, { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { tx } from '@/i18n/tx';
import { cn } from '@/lib/utils';
import { BTN_DANGER, BTN_SECONDARY } from '@/lib/classes';

// MapLibre pesa ~200 kB: solo se descarga cuando un proyecto de dron abre su mapa.
const TurbineMap = lazy(() => import('./TurbineMap'));

const SKELETON_HEIGHT = 'h-[300px] sm:h-[420px]';

const MapSkeleton = () => (
  <div
    role="status"
    aria-busy="true"
    aria-label={tx('Cargando mapa')}
    className={cn('mx-5 my-4 animate-pulse rounded-lg border border-line-subtle bg-surface-card', SKELETON_HEIGHT)}
  />
);

/** Contiene cualquier fallo del mapa (p. ej. no se pudo descargar el módulo) sin tumbar el resto de la pantalla. */
class MapErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('[TurbineMap]', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        role="alert"
        className="mx-5 my-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error-border bg-error-bg px-4 py-3 text-sm text-error-text"
      >
        <span>{tx('No se pudo cargar el mapa')}</span>
        <button type="button" onClick={() => window.location.reload()} className={cn(BTN_SECONDARY, '!h-9')}>
          {tx('Recargar página')}
        </button>
      </div>
    );
  }
}

/**
 * Mapa de turbinas listo para la pantalla: carga diferida con esqueleto, contención de errores y aviso
 * (con reintento) si fallan los datos de daño. Si la RPC falla el mapa sigue funcionando, solo sin color de severidad.
 *
 * @param {{
 *   items: Array,                 // ver TurbineMap
 *   loading?: boolean,
 *   error?: Error|null,           // error de la RPC get_project_map_data
 *   onRetry?: () => void,
 *   onOpenReport: (item) => void,
 *   onDeleteReport?: (item) => void,   // solo para admin/dev; sin él no hay acciones de eliminación
 *   getPhotoUrl?: (path) => Promise<string>|string,   // firma la foto de identificación al abrir el popup
 *   styleKey?: string,
 * }} props
 */
const TurbineMapSection = ({
  items,
  loading = false,
  error = null,
  onRetry,
  onOpenReport,
  onDeleteReport,
  getPhotoUrl,
  styleKey,
}) => {
  useTranslation();
  return (
    <div>
      {error && (
        <div
          role="alert"
          className="mx-5 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-error-border bg-error-bg px-3 py-2 text-xs text-error-text"
        >
          <span>{tx('No se pudieron cargar los datos de daños. Se muestran las turbinas sin color de severidad.')}</span>
          <button type="button" onClick={() => onRetry?.()} className={cn(BTN_DANGER, '!h-8 !px-3')}>
            {tx('Reintentar')}
          </button>
        </div>
      )}
      {loading ? (
        <MapSkeleton />
      ) : (
        <MapErrorBoundary>
          <Suspense fallback={<MapSkeleton />}>
            <TurbineMap
              items={items}
              onOpenReport={onOpenReport}
              onDeleteReport={onDeleteReport}
              getPhotoUrl={getPhotoUrl}
              styleKey={styleKey}
            />
          </Suspense>
        </MapErrorBoundary>
      )}
    </div>
  );
};

export default TurbineMapSection;
