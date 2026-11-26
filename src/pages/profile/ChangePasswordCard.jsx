import { tx } from "@/i18n/tx";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { INPUT, BTN_INFO } from "@/lib/classes";
import BentoCard from "@/components/ui/BentoCard";
import Overline from "@/components/ui/Overline";

/** Tarjeta de cambio de contraseña: maneja su propio estado y validaciones. */
const ChangePasswordCard = () => {
  useTranslation(); // re-renderiza al cambiar de idioma
  const [savingPassword, setSavingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast({
        title: tx("Contraseña insegura"),
        description: tx("La nueva contraseña debe tener al menos 8 caracteres."),
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: tx("No coinciden"),
        description: tx("La confirmación de contraseña no coincide."),
        variant: "destructive",
      });
      return;
    }

    try {
      setSavingPassword(true);
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setNewPassword("");
      setConfirmPassword("");

      toast({
        title: tx("Contraseña actualizada"),
        description: tx("Tu contraseña se ha cambiado correctamente."),
      });
    } catch (error) {
      console.error("Error cambiando contraseña:", error);
      toast({
        title: tx("Error"),
        description: error.message || tx("No se pudo actualizar la contraseña."),
        variant: "destructive",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <BentoCard flat className="flex h-full flex-col p-5 sm:p-6">
      <Overline as="h2" className="mb-4 flex items-center gap-2 text-ink">
        <KeyRound size={14} className="text-brand" />
        {tx("Seguridad y Contraseña")}
      </Overline>

      <form onSubmit={handleChangePassword} className="flex flex-1 flex-col gap-4">
        <div>
          <label htmlFor="new-password" className="mb-1.5 block text-xs font-medium text-ink-muted">
            {tx("Nueva contraseña")}
          </label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={tx("Mínimo 8 caracteres")}
            className={INPUT}
            required
            minLength={8}
          />
        </div>

        <div>
          <label htmlFor="confirm-password" className="mb-1.5 block text-xs font-medium text-ink-muted">
            {tx("Confirmar nueva contraseña")}
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={tx("Repite la nueva contraseña")}
            className={INPUT}
            required
            minLength={8}
          />
        </div>

        <div className="rounded-lg border border-line-subtle bg-surface-card/40 p-3 text-xs text-ink-muted">
          {tx("Usa una combinación de letras mayúsculas, minúsculas y números para mantener segura tu cuenta.")}
        </div>

        <div className="mt-auto pt-2">
          <button
            type="submit"
            disabled={savingPassword}
            className={`${BTN_INFO} w-full`}
          >
            <KeyRound className="h-4 w-4" />
            {savingPassword ? tx("Actualizando...") : tx("Actualizar Contraseña")}
          </button>
        </div>
      </form>
    </BentoCard>
  );
};

export default ChangePasswordCard;
