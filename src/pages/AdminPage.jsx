import { tx } from "@/i18n/tx";
import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { MotionConfig } from "framer-motion";
import { Users, Database, Shield, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { isMasterDevEmail } from "@/lib/masterDev";
import LoadingSpinner from "@/components/LoadingSpinner";
import PageHeader from "@/components/layout/PageHeader";
import BentoCard from "@/components/ui/BentoCard";
import KpiGrid from "@/components/ui/KpiGrid";
import KpiMetric from "@/components/ui/KpiMetric";
import Reveal from "@/components/ui/Reveal";
import UsersSection from "@/pages/admin/UsersSection";
import ChangeEmailDialog from "@/pages/admin/ChangeEmailDialog";
import { ICON_BLUE, ICON_GREEN } from "@/pages/admin/adminStyles";
// import UserManagement from '@/components/UserManagement';

const AdminPage = () => {
  const { t } = useTranslation("common");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [emailTarget, setEmailTarget] = useState(null); // usuario al que se le cambia el correo (diálogo abierto)
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const isMaster = isMasterDevEmail(currentUserEmail);
  // Un admin gestiona usuarios como un dev que no es el Master, con una excepción: no toca cuentas dev
  // (ni rol, ni estado). La base también lo exige.
  const currentRole = users.find((u) => u.id === currentUserId)?.role;
  const callerIsDev = isMaster || currentRole === "dev";
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProjects: 0,
    activeUsers: 0,
    adminUsers: 0,
  });

  useEffect(() => {
    loadAdminData();
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data?.user?.id ?? null);
      setCurrentUserEmail(data?.user?.email ?? "");
    });
  }, []);

  const loadAdminData = async () => {
    try {
      setLoading(true);

      // Cargar usuarios
      const { data: usersData, error: usersError } = await supabase
        .from("user_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (usersError) throw usersError;

      // Cargar proyectos
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (projectsError) throw projectsError;

      setUsers(usersData || []);

      // Calcular estadísticas
      const totalUsers = usersData?.length || 0;
      const activeUsers = usersData?.filter((u) => u.is_active)?.length || 0;
      const adminUsers =
        usersData?.filter((u) => u.role === "admin")?.length || 0;

      setStats({
        totalUsers,
        totalProjects: projectsData?.length || 0,
        activeUsers,
        adminUsers,
      });
    } catch (error) {
      console.error("Error loading admin data:", error);
      toast({
        title: t("messages.error"),
        description: t("admin.messages.loadError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId, newRole) => {
    // Reglas del Master Dev (la BD las vuelve a validar):
    // solo él asigna 'dev', su fila está protegida y los demás no cambian su propio rol.
    const target = users.find((u) => u.id === userId);
    if (!callerIsDev && target?.role === "dev") return; // un admin no toca cuentas dev
    if (!isMaster && (userId === currentUserId || newRole === "dev" || isMasterDevEmail(target?.email))) return;
    try {
      const { data, error } = await supabase.rpc("update_user_role", {
        target_user_id: userId,
        new_role: newRole,
      });

      if (error) throw error;

      toast({
        title: t("messages.success"),
        description: t("admin.messages.roleUpdated", { role: newRole }),
        variant: "default",
      });

      loadAdminData(); // Recargar datos
    } catch (error) {
      console.error("Error updating user role:", error);
      toast({
        title: t("messages.error"),
        description: error.message || t("admin.messages.roleUpdateError"),
        variant: "destructive",
      });
    }
  };

  const toggleUserStatus = async (userId, isActive) => {
    const target = users.find((u) => u.id === userId);
    if (userId === currentUserId && !callerIsDev) return; // un admin no se desactiva a sí mismo
    if (!isMaster && isMasterDevEmail(target?.email)) return; // fila del Master Dev protegida
    // Cuentas dev: solo el Master Dev las activa/desactiva, y nadie la propia (la base también lo exige)
    if (target?.role === "dev" && (userId === currentUserId || !isMaster)) return;
    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({ is_active: !isActive, updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: t("messages.success"),
        description: isActive ? t("admin.messages.userDeactivated") : t("admin.messages.userActivated"),
        variant: "default",
      });

      loadAdminData(); // Recargar datos
    } catch (error) {
      console.error("Error toggling user status:", error);
      toast({
        title: t("messages.error"),
        description: t("admin.messages.statusToggleError"),
        variant: "destructive",
      });
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === "all" || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background">
        <LoadingSpinner size="lg" text={t("admin.loading")} />
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <Helmet>
        <title>{t("admin.title")} - VINDGROUP</title>
      </Helmet>

      <div className="min-h-[calc(100vh-4rem)] w-full bg-background p-4 text-ink sm:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Encabezado */}
          <Reveal>
            <PageHeader
              icon={<Shield size={24} />}
              overline={tx("Gestión de activos eólicos")}
              title={t("admin.title", "Panel de Administración")}
              description={t("admin.subtitle", "Gestiona usuarios, proyectos y configuración del sistema")}
            />
          </Reveal>

          {/* Estadísticas */}
          <Reveal delay={0.05}>
            <BentoCard as="section" flat aria-label={t("admin.title", "Panel de Administración")}>
              <KpiGrid className="lg:grid-cols-4">
                <KpiMetric className="p-5" label={t("admin.stats.totalUsers")} value={stats.totalUsers} icon={<Users size={18} />} iconClassName={ICON_BLUE} />
                <KpiMetric className="p-5" label={t("admin.stats.totalProjects")} value={stats.totalProjects} icon={<Database size={18} />} iconClassName={ICON_GREEN} />
                <KpiMetric
                  className="p-5"
                  label={t("admin.stats.activeUsers")}
                  value={stats.activeUsers}
                  icon={<CheckCircle size={18} />}
                  iconClassName="text-status-done"
                />
                <KpiMetric
                  className="p-5"
                  label={t("admin.stats.admins")}
                  value={stats.adminUsers}
                  icon={<Shield size={18} />}
                  iconClassName="text-brand"
                />
              </KpiGrid>
            </BentoCard>
          </Reveal>

          {/* Gestión de Usuarios */}
          <Reveal delay={0.1}>
            <UsersSection
              users={filteredUsers}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              filterRole={filterRole}
              onFilterRoleChange={setFilterRole}
              currentUserId={currentUserId}
              onChangeEmail={setEmailTarget}
              isMaster={isMaster}
              callerIsDev={callerIsDev}
              onRoleChange={updateUserRole}
              onToggleStatus={toggleUserStatus}
            />
          </Reveal>

        </div>
      </div>

      {emailTarget && (
        <ChangeEmailDialog
          user={emailTarget}
          onClose={() => setEmailTarget(null)}
          onDone={loadAdminData} // recarga la tabla con el correo nuevo
        />
      )}
    </MotionConfig>
  );
};

export default AdminPage;
