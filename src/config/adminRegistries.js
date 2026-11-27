import {
  Zap,
  Factory,
  Users,
  Package,
  UserCog,
  FolderKanban,
  Wrench,
  Truck,
  ClipboardList,
  Gauge,
  Cog,
} from 'lucide-react';

/**
 * Registros del Centro Administrativo. Cada entrada define una vista de tabla.
 * `rows` aún no tiene fuente de datos: las vistas muestran el estado vacío.
 * @typedef {{ id: string, label: string, icon: import('lucide-react').LucideIcon, columns: Array<{ key: string, label: string }> }} AdminRegistry
 */

const DEFAULT_COLUMNS = [
  { key: 'name', label: 'Nombre' },
  { key: 'status', label: 'Estado' },
  { key: 'updated_at', label: 'Actualizado' },
];

/** @type {ReadonlyArray<AdminRegistry>} */
export const ADMIN_REGISTRIES = Object.freeze([
  { id: 'pe', label: 'Reg. P.E', icon: Zap, columns: DEFAULT_COLUMNS },
  { id: 'fabricantes', label: 'Reg. Fabricantes', icon: Factory, columns: DEFAULT_COLUMNS },
  { id: 'cliente', label: 'Reg. Cliente', icon: Users, columns: DEFAULT_COLUMNS },
  { id: 'materiales', label: 'Reg. Materiales', icon: Package, columns: DEFAULT_COLUMNS },
  { id: 'rh', label: 'Reg. R.H.', icon: UserCog, columns: DEFAULT_COLUMNS },
  { id: 'proyectos', label: 'Reg. Proyectos (ID. Proyecto)', icon: FolderKanban, columns: DEFAULT_COLUMNS },
  { id: 'servicios', label: 'Reg. Servicios', icon: Wrench, columns: DEFAULT_COLUMNS },
  { id: 'vehiculos', label: 'Reg. Vehículos', icon: Truck, columns: DEFAULT_COLUMNS },
  { id: 'procedimientos', label: 'Reg. Procedimientos', icon: ClipboardList, columns: DEFAULT_COLUMNS },
  { id: 'indicadores', label: 'Reg. Indicadores', icon: Gauge, columns: DEFAULT_COLUMNS },
  { id: 'componentes', label: 'Reg. Componentes', icon: Cog, columns: DEFAULT_COLUMNS },
]);

/** @param {string} id @returns {AdminRegistry | undefined} */
export const findAdminRegistry = (id) => ADMIN_REGISTRIES.find((r) => r.id === id);
