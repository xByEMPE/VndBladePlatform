import React from "react";
import { insertFindingReturning } from "../../shared/data";
import DetectionEditModal from "@/components/DetectionEditModal";

export const ViewerDetectionModal = ({ t, toast, editingDetection, setEditingDetection, setNewDetection, setIsCreatingDetection, currentImage }) => (
  <DetectionEditModal
    detection={editingDetection}
    onClose={() => {
        setEditingDetection(null);
        setIsCreatingDetection(false);
        setNewDetection(null);
    }}
    onSave={async (updated) => {
         try {
            console.log("Saving detection:", updated);
             const currentImageId = currentImage?.id || currentImage?.inspection_file_id;
            if (!currentImage || !currentImageId) {
                toast({ title: t("common.error"), description: t("imageViewer.noImageSelected"), variant: "destructive" });
                return;
            }

            const region = {
              x: updated.bbox[0],
              y: updated.bbox[1],
              width: updated.bbox[2] - updated.bbox[0], 
              height: updated.bbox[3] - updated.bbox[1],
            };

            const { data, error } = await insertFindingReturning({
                capture_id: currentImageId,
                severity: (updated.severity || "Cat 3").replace("Cat ", ""),
                region: region,
                attributes: { 
                    confidence: updated.confidence || 1.0, 
                    category: updated.category, 
                    damage_type: updated.damage_type, 
                    description: updated.description,
                    width_mm: Math.round(updated.width_mm || 0),
                    length_mm: Math.round(updated.length_mm || 0),
                    area: Math.round(updated.area || 0),
                    radius_mm: Math.round(updated.radius_mm || 0),
                    radius: updated.radius // Keep raw for calculation if needed, or round too? User asked for no decimals.
                },
              });

            if (error) throw error;

            toast({ title: t("messages.saved"), description: t("messages.damageAddedSuccess") });
            setEditingDetection(null);
            setIsCreatingDetection(false);
            setNewDetection(null);
         } catch(e) {
             console.error(e);
             toast({ title: t("common.error"), description: t("messages.errorSavingDamage"), variant: "destructive" });
         }
    }}
  />
);
