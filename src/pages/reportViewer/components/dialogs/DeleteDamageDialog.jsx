import React from "react";
import { ALERT_DESTRUCTIVE } from "@/lib/classes";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

export const DeleteDamageDialog = ({ t, deletingDamages, deleteConfirmOpen, damageToDelete, setDeleteConfirmOpen, confirmDeleteDamage, cancelDeleteDamage }) => (
  <AlertDialog
    open={deleteConfirmOpen}
    onOpenChange={setDeleteConfirmOpen}
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {t("reportViewer.deleteDamageConfirm")}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {t("reportViewer.deleteDamageConfirmDescription")}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={cancelDeleteDamage}>
          {t("reportViewer.deleteDamageCancelButton")}
        </AlertDialogCancel>
        <AlertDialogAction
          onClick={confirmDeleteDamage}
          className={ALERT_DESTRUCTIVE}
          disabled={deletingDamages.has(damageToDelete)}
        >
          {deletingDamages.has(damageToDelete) ? "..." : ""}{" "}
          {t("reportViewer.deleteDamageConfirmButton")}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
