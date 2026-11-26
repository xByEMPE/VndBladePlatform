import React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Estado vacío centrado: icono atenuado + mensaje.
 * @param {{ icon?: React.ElementType, className?: string, children: React.ReactNode }} props
 */
const EmptyState = ({ icon: Icon = Inbox, className, children }) => (
  <div className={cn('flex flex-col items-center justify-center px-4 py-12 text-center text-ink-muted', className)}>
    <Icon size={28} className="mb-2 opacity-60" aria-hidden="true" />
    <p className="text-sm">{children}</p>
  </div>
);

export default EmptyState;
