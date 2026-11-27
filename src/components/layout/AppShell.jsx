import React from 'react';
import SideNav from './SideNav';

/**
 * Split View: menú lateral fijo a la izquierda y contenido a la derecha, en todas las páginas autenticadas.
 * El botón para ocultar/mostrar el menú vive en el header (App lo controla con `collapsed`).
 * Con `enabled=false` solo muestra el contenido.
 */
const AppShell = ({ children, enabled = true, collapsed = false }) => {
  if (!enabled) return <>{children}</>;

  return (
    <div className="flex w-full">
      <SideNav collapsed={collapsed} />
      <div className="relative min-w-0 flex-1">{children}</div>
    </div>
  );
};

export default AppShell;
