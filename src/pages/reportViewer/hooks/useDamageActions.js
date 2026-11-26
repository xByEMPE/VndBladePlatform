import { useState } from "react";
import { getDamageExtraData } from "../../shared/damage";
import { updateFinding, insertFindingReturning, deleteFinding } from "../../shared/data";
import { toast } from "@/components/ui/use-toast";

// Acciones sobre daños y detecciones: edición, borrado (con diálogo de confirmación) y CRUD de detecciones.
// NOTA: recibe `imageModal` (estado del visor de imágenes). Cuando ese estado se mueva a su propio hook,
// ese hook debe llamarse ANTES que este.
export const useDamageActions = ({ damages, t, loadData, imageModal, setDamages }) => {
  // Estados para edición de daños
  const [editingDamage, setEditingDamage] = useState(null);

  const [editingFields, setEditingFields] = useState({});

  // Estado para eliminar daños
  const [deletingDamages, setDeletingDamages] = useState(new Set());

  // Estado para confirmación de eliminación
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [damageToDelete, setDamageToDelete] = useState(null);

  // Función para actualizar campos en edición local
  const updateDamageField = (damageId, field, value) => {
    setEditingFields((prev) => ({
      ...prev,
      [damageId]: {
        ...(prev[damageId] || {}),
        [field]: value,
      },
    }));
  };

  // Función para guardar cambios en BD
  const saveDamageChanges = async (damageId) => {
    const changes = editingFields[damageId];
    if (!changes) return;

    try {
      const damage = damages.find((d) => d.id === damageId);
      if (!damage) return;

      const extraData = getDamageExtraData(damage);
      const newData = { ...extraData, ...changes };

      // Preparar payload para Supabase (Findings V2)
      // Fix: DB expects '1', '2', '3'... not 'Cat 1'
      let severityValue = newData.severity;
      if (severityValue && severityValue.startsWith("Cat ")) {
        severityValue = severityValue.replace("Cat ", "");
      }

      const updatePayload = {
        severity: severityValue, // Columna directa
        // Actualizar status si es necesario
        updated_at: new Date().toISOString(),
      };

      // Logic para empaquetar datos extra en 'attributes', 'region' o 'description' (según schema)
      // Schema V2 usa 'region' y 'attributes'.
      // Sin embargo, para mantener compatibilidad con reportes PDF que leean description JSON:
      // Actualizamos description tambien.

      const newDescription = {
        ...newData,
        last_edited: new Date().toISOString(),
      };

      if (
        damage.description &&
        typeof damage.description === "string" &&
        damage.description.startsWith("{")
      ) {
        // Mantener otros campos del JSON original
        try {
          const orig = JSON.parse(damage.description);
          Object.assign(newDescription, orig, newData);
        } catch (e) {}
      }

      // Determinar donde guardar radius, length, width...
      // V2 Schema Findings tiene: region (jsonb), attributes (jsonb)
      // Guardemos dimensiones en attributes para queries futuros
      const attributes = damage.attributes || {};
      attributes.radius_mm = newData.radius_mm;
      attributes.length_mm = newData.length_mm;
      attributes.width_mm = newData.width_mm;
      attributes.height_mm = newData.height_mm;
      attributes.damage_type = newData.damage_type;
      attributes.additional_notes = newData.additional_notes;

      updatePayload.attributes = attributes;
      // updatePayload.description = JSON.stringify(newDescription); // Si la col existe en findings?findings no tiene description.
      // Findings tiene columns: type, severity, confidence, region, attributes, ai_metadata...

      // ERROR: Findings table NO tiene 'description'. El frontend lo simulaba en loadData line 1167.
      // Debemos guardar en 'attributes' o campos JSONB.

      const { error } = await updateFinding(damageId, updatePayload);

      if (error) throw error;

      toast({
        title: t("reportViewer.saved"),
        description: t("reportViewer.damageUpdated"),
      });

      setEditingDamage(null);
      setEditingFields((prev) => {
        const next = { ...prev };
        delete next[damageId];
        return next;
      });

      await loadData();
    } catch (e) {
      console.error("Error saving damage:", e);
      toast({
        title: t("reportViewer.error"),
        description: "Error updating damage",
        variant: "destructive",
      });
    }
  };

  const getImageDetections = (src) => {
    // Busca la imagen actual en el modal
    const currentImg = imageModal.images.find(
      (img) =>
        img.src === src ||
        img.path === src ||
        (img.publicUrl && img.publicUrl === src) ||
        (img.url && img.url === src),
    );

    // Si no encontramos la imagen exacta por URL, intentamos usar el índice actual si coincide
    const fallbackImg = imageModal.images[imageModal.currentIndex];
    const targetImg = currentImg || fallbackImg;

    if (!targetImg || !targetImg.id) return [];

    // Filtrar findings por capture_id
    // Nota: 'damages' contiene los findings enriquecidos
    return damages
      .filter((d) => d.capture_id === targetImg.id)
      .map((d) => {
        // Convertir region JSONB a array [x,y,w,h]
        let bbox = null;
        if (d.region) {
          // Asumimos formato {x,y,width,height} o similar
          const { x, y, width, height, w, h } = d.region;
          if (x !== undefined && y !== undefined) {
            bbox = [x, y, width || w, height || h];
          }
        }

        return {
          id: d.id,
          bbox: bbox
            ? [bbox[0], bbox[1], bbox[0] + bbox[2], bbox[1] + bbox[3]]
            : null, // Convert [x,y,w,h] to [x1,y1,x2,y2]
          severity: d.severity?.toString().startsWith("Cat ")
            ? d.severity
            : `Cat ${d.severity}`, // Ensure "Cat X" format
          confidence: d.attributes?.confidence || 1.0,
          category: d.severity?.toString().startsWith("Cat ")
            ? d.severity
            : `Cat ${d.severity}`,
          width_mm: d.attributes?.width_mm,
          length_mm: d.attributes?.length_mm,
          radius_mm: d.attributes?.radius_mm,
          area: d.attributes?.area,
        };
      });
  };

  const handleSaveDetection = async (detection) => {
    console.log("Saving detection (V2):", detection);

    const currentImg = imageModal.images[imageModal.currentIndex];
    if (!currentImg || !currentImg.id) {
      console.error("No valid image to save detection to");
      return;
    }

    try {
      const region = {
        x: detection.bbox[0],
        y: detection.bbox[1],
        width: detection.bbox[2],
        height: detection.bbox[3],
      };

      const { data, error } = await insertFindingReturning({
          capture_id: currentImg.id,
          severity: detection.severity || "Cat 3",
          region: region,
          attributes: { confidence: detection.confidence || 1.0 },
          status: "Open",
        });

      if (error) throw error;

      await loadData();

      toast({ title: t("reportViewer.saved") || "Guardado" });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleUpdateDetection = async (detection) => {
    try {
      const region = {
        x: detection.bbox[0],
        y: detection.bbox[1],
        width: detection.bbox[2],
        height: detection.bbox[3],
      };

      const { error } = await updateFinding(detection.id, {
          severity: detection.severity,
          region: region,
        });

      if (error) throw error;

      await loadData();
      toast({ title: t("common.updated") || "Actualizado" });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleDeleteDetection = async (detectionId) => {
    try {
      const { error } = await deleteFinding(detectionId);
      if (error) throw error;

      await loadData();
      toast({ title: t("common.deleted") || "Eliminado" });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", variant: "destructive" });
    }
  };

  // === Mostrar confirmación de eliminación ===
  const handleDeleteDamage = (damageId) => {
    setDamageToDelete(damageId);
    setDeleteConfirmOpen(true);
  };

  // === Confirmar eliminación de daño ===
  const confirmDeleteDamage = async () => {
    if (!damageToDelete || deletingDamages.has(damageToDelete)) return;

    try {
      setDeletingDamages((prev) => new Set(prev).add(damageToDelete));

      const { error } = await deleteFinding(damageToDelete);

      if (error) throw error;

      setDamages((prevDamages) =>
        prevDamages.filter((d) => d.id !== damageToDelete),
      );

      toast({
        title: t("reportViewer.deleteDamageSuccess"),
        description: t("reportViewer.deleteDamageSuccessDescription"),
      });
    } catch (error) {
      console.error("Error eliminando daño:", error);
      toast({
        title: t("messages.error"),
        description: error.message || t("messages.error"),
        variant: "destructive",
      });
    } finally {
      setDeletingDamages((prev) => {
        const newSet = new Set(prev);
        newSet.delete(damageToDelete);
        return newSet;
      });
      setDeleteConfirmOpen(false);
      setDamageToDelete(null);
    }
  };

  // === Cancelar eliminación ===
  const cancelDeleteDamage = () => {
    setDeleteConfirmOpen(false);
    setDamageToDelete(null);
  };

  return { editingDamage, editingFields, deletingDamages, deleteConfirmOpen, damageToDelete, setEditingDamage, setDeleteConfirmOpen, updateDamageField, saveDamageChanges, getImageDetections, handleSaveDetection, handleUpdateDetection, handleDeleteDetection, handleDeleteDamage, confirmDeleteDamage, cancelDeleteDamage };
};
