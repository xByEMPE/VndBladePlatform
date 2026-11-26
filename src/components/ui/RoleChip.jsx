import React from 'react';
import Pill from '@/components/ui/Pill';
import { cn } from '@/lib/utils';
import { getRoleChip } from '@/lib/roleLabel';

/**
 * Rol de un usuario como píldora con borde (administrador oro, técnico celeste, cliente verde salvia).
 * Es un dato de la fila de una tabla; el rol del usuario actual vive en el Header superior.
 * `label` es el texto visible (por defecto, el propio rol).
 * @param {{ role: string, label?: string, className?: string }} props
 */
const RoleChip = ({ role, label, className }) => (
  <Pill bordered data-role={role} className={cn(getRoleChip(role), className)}>
    {label ?? role}
  </Pill>
);

export default RoleChip;
