import React from 'react';
import { useParams } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { tx } from '@/i18n/tx';
import AdminRegistryTemplate from '@/components/admin/AdminRegistryTemplate';
import { findAdminRegistry } from '@/config/adminRegistries';
import EmptyState from '@/components/ui/EmptyState';
import BentoCard from '@/components/ui/BentoCard';

/**
 * Vista de un registro administrativo. Las filas aún no tienen fuente de datos.
 */
const AdminRegistryPage = () => {
  const { registryId } = useParams();
  const registry = findAdminRegistry(registryId);

  if (!registry) {
    return (
      <div className="p-4 sm:p-8">
        <BentoCard flat>
          <EmptyState>{tx('Registro no encontrado')}</EmptyState>
        </BentoCard>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-8 sm:pt-8">
        <BentoCard flat role="status" className="flex items-center gap-3 border-status-alert/40 p-4">
          <Construction size={20} className="shrink-0 text-status-alert" aria-hidden="true" />
          <p className="text-sm text-ink">
            {tx('Esta sección está en desarrollo por el equipo. Pronto podrás gestionar sus registros aquí.')}
          </p>
        </BentoCard>
      </div>
      <AdminRegistryTemplate
        title={registry.label}
        columns={registry.columns}
        rows={[]}
      />
    </>
  );
};

export default AdminRegistryPage;
