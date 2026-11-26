import { tx } from "@/i18n/tx";
import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { MotionConfig } from "framer-motion";
import { User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import PageHeader from "@/components/layout/PageHeader";
import BentoCard from "@/components/ui/BentoCard";
import Overline from "@/components/ui/Overline";
import Reveal from "@/components/ui/Reveal";
import RoleChip from "@/components/ui/RoleChip";
import { getRoleName } from "@/lib/roleLabel";
import ChangePasswordCard from "@/pages/profile/ChangePasswordCard";
import ProfileDataView from "@/pages/profile/ProfileDataView";

const ProfilePage = () => {
  useTranslation(); // re-renderiza al cambiar de idioma (tx lee el idioma activo)
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(""); // correo actual de la cuenta (auth)
  const [role, setRole] = useState("client");
  const [memberSince, setMemberSince] = useState(""); // fecha de alta de la cuenta (auth)

  // Todos los perfiles son de SOLO LECTURA: nombre y correo los administra TI / un dev; cada persona solo cambia
  // su contraseña. El client lleva las leyendas ("Solo lectura" y la nota de TI); el resto de roles
  // (admin, technician, dev y el Master Dev) ve su perfil limpio, sin leyendas.
  const isClient = role === "client";

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user) throw authError;

        setEmail(user.email || "");
        setMemberSince(user.created_at || "");

        const { data: profile, error: profileError } = await supabase
          .from("user_profiles")
          .select("full_name, role")
          .eq("id", user.id)
          .single();

        if (profileError) throw profileError;

        setFullName(profile?.full_name || "");
        setRole(profile?.role || "client");
      } catch (error) {
        console.error("Error cargando perfil:", error);
        toast({
          title: tx("Error"),
          description: tx("No se pudo cargar la información del perfil."),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background">
        <LoadingSpinner size="lg" text={tx("Cargando perfil...")} />
      </div>
    );
  }

  const displayName = fullName.trim() || email;
  const initials =
    displayName
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "U";

  return (
    <MotionConfig reducedMotion="user">
      <Helmet>
        <title>{tx("Mi Perfil - VINDGROUP")}</title>
      </Helmet>

      <div className="min-h-[calc(100vh-4rem)] w-full bg-background p-4 text-ink sm:p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <Reveal>
            <PageHeader
              icon={<User size={24} />}
              overline={tx("Cuenta y credenciales")}
              title={tx("Perfil de Usuario")}
              description={tx(
                "Visualiza y actualiza tu información personal, nivel de acceso y credenciales de seguridad.",
              )}
            />
          </Reveal>

          {/* Resumen de cuenta */}
          <Reveal delay={0.05}>
            <BentoCard flat className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
              <div className="flex min-w-0 items-center gap-4">
                <span
                  aria-hidden="true"
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-line-medium bg-surface-panel text-lg font-semibold text-info"
                >
                  {initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-ink">{displayName}</p>
                  <p className="truncate text-sm text-ink-muted">{email}</p>
                </div>
              </div>

              {/* Nivel de acceso: SOLO LECTURA */}
              <div className="flex flex-col items-start gap-1.5 sm:items-end">
                <span className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
                  {tx("Nivel de acceso")}
                </span>
                <RoleChip role={role} label={getRoleName(role)} />
              </div>
            </BentoCard>
          </Reveal>

          <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
            {/* Datos personales (ficha de solo lectura para todos los roles) */}
            <Reveal delay={0.1} className="h-full">
              <BentoCard flat className="flex h-full flex-col p-5 sm:p-6">
                <Overline as="h2" className="mb-4 flex items-center gap-2 text-ink">
                  <User size={14} className="text-info" />
                  {tx("Datos Personales")}
                </Overline>

                <ProfileDataView
                  fullName={fullName}
                  email={email}
                  memberSince={memberSince}
                  showNotice={isClient}
                />
              </BentoCard>
            </Reveal>

            {/* Seguridad y contraseña */}
            <Reveal delay={0.15} className="h-full">
              <ChangePasswordCard />
            </Reveal>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
};

export default ProfilePage;
