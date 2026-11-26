import { tx } from "@/i18n/tx";
import React, { useState, useEffect } from "react";
import { Check, AlertCircle, Mail, Lock } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AuthShell from "@/components/auth/AuthShell";
import AuthHeader from "@/components/auth/AuthHeader";
import AuthField from "@/components/auth/AuthField";
import AuthAlert from "@/components/auth/AuthAlert";
import AuthButton from "@/components/auth/AuthButton";
import PasswordRules from "@/components/auth/PasswordRules";

const SetupPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPasswordReset, setIsPasswordReset] = useState(false); // Nuevo estado para diferenciar flujos

  const navigate = useNavigate();
  const { t } = useTranslation();

  // Validaciones de contraseña
  const hasMinLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const passwordsMatch = password === confirmPassword && password.length > 0;

  const isPasswordValid =
    hasMinLength &&
    hasUpperCase &&
    hasLowerCase &&
    hasSpecialChar &&
    passwordsMatch;

  // ✅ MEJORADO: Manejo de invitación con debugging completo
  useEffect(() => {
    const handleInviteRedirect = async () => {
      // 🔍 Debug: Capturar toda la información de URL
      const fullUrl = window.location.href;
      const hash = window.location.hash.substring(1);
      const search = window.location.search.substring(1);

      const debugData = {
        fullUrl,
        hash,
        search,
        hashParams: hash ? Object.fromEntries(new URLSearchParams(hash)) : {},
        searchParams: search
          ? Object.fromEntries(new URLSearchParams(search))
          : {},
      };


      // ✅ Buscar tokens en hash primero, luego en search params
      let access_token = null;
      let refresh_token = null;
      let type = null;
      let errorParam = null;
      let errorCode = null;
      let errorDescription = null;

      if (hash) {
        const hashParams = new URLSearchParams(hash);
        access_token = hashParams.get("access_token");
        refresh_token = hashParams.get("refresh_token");
        type = hashParams.get("type");
        errorParam = hashParams.get("error");
        errorCode = hashParams.get("error_code");
        errorDescription = hashParams.get("error_description");
      }

      if (!access_token && search) {
        const searchParams = new URLSearchParams(search);
        access_token = searchParams.get("access_token");
        refresh_token = searchParams.get("refresh_token");
        type = searchParams.get("type");
        errorParam = errorParam || searchParams.get("error");
        errorCode = errorCode || searchParams.get("error_code");
        errorDescription =
          errorDescription || searchParams.get("error_description");
      }


      // ❌ Manejar errores
      if (errorParam) {
        if (errorCode === "otp_expired") {
          // Determinar el tipo de enlace para el mensaje de error apropiado
          const isRecoveryFlow = type === "recovery";
          if (isRecoveryFlow) {
            setError(t("auth.passwordSetup.errors.expiredRecovery"));
          } else {
            setError(t("auth.passwordSetup.errors.expiredInvite"));
          }
        } else {
          const isRecoveryFlow = type === "recovery";
          if (isRecoveryFlow) {
            setError(
              decodeURIComponent(
                errorDescription || t("auth.passwordSetup.errors.invalidLink")
              )
            );
          } else {
            setError(
              decodeURIComponent(
                errorDescription || t("auth.passwordSetup.errors.invalidLink")
              )
            );
          }
        }
        return;
      }

      // ✅ Manejar tokens de invitación y recovery
      if (
        access_token &&
        (type === "invite" || type === "signup" || type === "recovery")
      ) {
        // Determinar si es reset de contraseña
        if (type === "recovery") {
          setIsPasswordReset(true);
        }
        try {

          const { data, error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });

          if (error) {
            console.error("Error al establecer sesión:", error);
            const isRecoveryFlow = type === "recovery";
            if (isRecoveryFlow) {
              setError(t("auth.passwordSetup.errors.invalidLink"));
            } else {
              setError(t("auth.passwordSetup.errors.invalidLink"));
            }
          } else {

            // Obtener usuario autenticado
            const {
              data: { user },
              error: userError,
            } = await supabase.auth.getUser();

            if (userError) {
              console.error("Error obteniendo usuario:", userError);
              setError(tx("Error obteniendo información del usuario."));
            } else if (user?.email) {
              setEmail(user.email);
            }
          }
        } catch (err) {
          console.error("Error procesando invitación:", err);
          const isRecoveryFlow = type === "recovery";
          if (isRecoveryFlow) {
            setError(t("auth.passwordSetup.errors.processingRecoveryError"));
          } else {
            setError(t("auth.passwordSetup.errors.processingError"));
          }
        }
      } else {
        // Verificar sesión existente
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.user) {
            setEmail(session.user.email || "");
          } else {
            setError(t("auth.passwordSetup.errors.invalidLinkMessage"));
          }
        } catch (err) {
          console.error("Error verificando sesión:", err);
          setError(t("auth.passwordSetup.errors.sessionError"));
        }
      }
    };

    handleInviteRedirect();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!hasMinLength) {
      setError(t("auth.passwordSetup.errors.minLength"));
      return;
    }

    if (!hasUpperCase) {
      setError(t("auth.passwordSetup.errors.uppercase"));
      return;
    }

    if (!hasLowerCase) {
      setError(t("auth.passwordSetup.errors.lowercase"));
      return;
    }

    if (!hasSpecialChar) {
      setError(t("auth.passwordSetup.errors.specialChar"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("auth.passwordSetup.errors.noMatch"));
      return;
    }

    setLoading(true);

    try {

      const { data, error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        console.error("Error actualizando contraseña:", updateError);
        throw updateError;
      }


      // ✅ Obtener el usuario actual después de actualizar la contraseña
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error(
          "❌ Error obteniendo usuario después de actualizar contraseña:",
          userError
        );
        setError(tx("Error obteniendo información del usuario."));
        return;
      }


      // ✅ Verificar que el perfil se haya creado antes de continuar
      try {
        const { data: profile, error: profileError } = await supabase
          .from("user_profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();


        if (!profile) {
          const { error: insertError } = await supabase
            .from("user_profiles")
            .insert({
              id: user.id,
              role: "client",
              full_name: user.email || "",
            });

          if (insertError) {
            console.error("Error creando perfil:", insertError);
          }
        }
      } catch (err) {
        console.error("Error en verificación de perfil:", err);
      }

      const successMessage = isPasswordReset
        ? t("auth.passwordSetup.resetSuccess")
        : t("auth.passwordSetup.setupSuccess");
      setSuccess(successMessage);

      // ✅ NO cerrar sesión, mantener la sesión activa y redirigir al dashboard
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 2000);
    } catch (error) {
      console.error("Error configurando contraseña:", error);
      setError(t("auth.passwordSetup.errors.updateError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthHeader
        icon={<Lock size={24} />}
        title={
          isPasswordReset
            ? t("auth.passwordSetup.resetTitle")
            : t("auth.passwordSetup.setupTitle")
        }
        subtitle={
          isPasswordReset
            ? t("auth.passwordSetup.resetSubtitle")
            : t("auth.passwordSetup.setupSubtitle")
        }
        subtitleClassName="mb-4"
      >
        {email && (
          <AuthAlert tone="info" icon={<Mail size={16} />} className="mb-6 justify-center">
            <span>
              {isPasswordReset
                ? t("auth.passwordSetup.resettingFor")
                : t("auth.passwordSetup.settingUpFor")}
              <strong>{email}</strong>
            </span>
          </AuthAlert>
        )}
      </AuthHeader>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Mensajes de error y éxito */}
        {error && (
          <AuthAlert tone="error" icon={<AlertCircle size={16} />}>
            <span>{error}</span>
          </AuthAlert>
        )}

        {success && (
          <AuthAlert tone="success" icon={<Check size={16} />}>
            <p className="font-medium">{success}</p>
          </AuthAlert>
        )}

        {/* Campos de contraseña */}
        <AuthField
          id="password"
          label={t("auth.passwordSetup.newPassword")}
          type={showPassword ? "text" : "password"}
          placeholder={t("auth.passwordSetup.passwordPlaceholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength="8"
          disabled={loading || success}
          toggle={{ shown: showPassword, onToggle: () => setShowPassword(!showPassword) }}
        />

        <AuthField
          id="confirmPassword"
          label={t("auth.passwordSetup.confirmPassword")}
          type={showConfirmPassword ? "text" : "password"}
          placeholder={t("auth.passwordSetup.confirmPlaceholder")}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength="8"
          disabled={loading || success}
          toggle={{ shown: showConfirmPassword, onToggle: () => setShowConfirmPassword(!showConfirmPassword) }}
        />

        {/* Requisitos de contraseña */}
        <PasswordRules
          title={t("auth.passwordSetup.requirements.title")}
          rules={[
            { key: "minLength", ok: hasMinLength, label: t("auth.passwordSetup.requirements.minLength") },
            { key: "uppercase", ok: hasUpperCase, label: t("auth.passwordSetup.requirements.uppercase") },
            { key: "lowercase", ok: hasLowerCase, label: t("auth.passwordSetup.requirements.lowercase") },
            { key: "specialChar", ok: hasSpecialChar, label: t("auth.passwordSetup.requirements.specialChar") },
            { key: "match", ok: passwordsMatch, label: t("auth.passwordSetup.requirements.match") },
          ]}
        />

        <AuthButton
          type="submit"
          disabled={loading || success || !isPasswordValid}
          loading={loading}
          icon={success ? <Check size={20} /> : <Lock size={20} />}
        >
          {loading
            ? isPasswordReset
              ? t("auth.passwordSetup.resetting")
              : t("auth.passwordSetup.settingUp")
            : success
              ? isPasswordReset
                ? t("auth.passwordSetup.passwordReset")
                : t("auth.passwordSetup.passwordSet")
              : isPasswordReset
                ? t("auth.passwordSetup.resetButton")
                : t("auth.passwordSetup.setupButton")}
        </AuthButton>
      </form>

      <div className="text-center text-sm text-ink-muted">
        <p>
          {isPasswordReset
            ? t("auth.passwordSetup.resetFooter")
            : t("auth.passwordSetup.setupFooter")}
        </p>
      </div>
    </AuthShell>
  );
};

export default SetupPasswordPage;
