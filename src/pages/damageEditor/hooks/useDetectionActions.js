import { deleteFinding, getFindingAttributesAndRegion, upsertFindingReturning } from "../../shared/data";

// Acciones de persistencia del editor: eliminar y guardar una detección. Incluyen los postMessage de salida
// hacia window.opener (visor de reportes) y la actualización del estado local de la página.
export const useDetectionActions = ({ t, damageInfo, stateData, currentImage, section, bladeName, allDamages, calculateMetrics, setDownloading, setDetections, setRemovedDamageIds, setSelectedDamageId, setEditingDetection, setDamageInfo, setDamageOverrides, setAddedDamages }) => {
  // Función para manejar eliminación de detección
  const handleDeleteDetection = async (detectionId) => {
    if (!detectionId) return;
    
    try {
        setDownloading(true);
        // 1. Delete from Supabase (only if it's a real persistent ID)
        if (!detectionId.toString().startsWith("new-")) {
             const { error } = await deleteFinding(detectionId);
              
             if (error) throw error;
        }

        // 2. Broadcast delete completion
        if (window.opener) {
          window.opener.postMessage({
              type: "DAMAGE_DELETED", // CHANGED: Signal completion
              damageId: detectionId
          }, window.location.origin);
        }
        
        // 3. Update local state
        setDetections(prev => prev.filter(d => d.id !== detectionId));
        setRemovedDamageIds(prev => new Set(prev).add(String(detectionId)));
        setSelectedDamageId(null);
        setEditingDetection(null);
        setDamageInfo({}); // Clear info

    } catch (e) {
        console.error("Error deleting detection:", e);
        alert(t("messages.errorDeletingDamage"));
    } finally {
        setDownloading(false);
    }
  };

  // Función para manejar actualización de detección
  const handleSaveDetection = async (detection) => {
    try {
        setDownloading(true);
        
        // 1. Prepare payload
        const region = {
            x: detection.bbox[0],
            y: detection.bbox[1],
            width: detection.bbox[2],
            height: detection.bbox[3],
        };

        const captureId = currentImage?.id || stateData?.imageId || detection.capture_id;
        
        if (!captureId) {
            console.error("No capture ID found for saving detection");
            alert(t("messages.errorNoImageId"));
            return;
        }

        // CORRECCIÓN: BD requiere ENUM (ej: "3"), pero BroadCast prefiere "Cat 3".
        const severityRaw = detection.severity || "Cat 3";
        const severityValue = severityRaw.startsWith("Cat ") 
            ? severityRaw.replace("Cat ", "") 
            : severityRaw;

        // Calculate metrics
        // If calculation fails (e.g. missing metadata), fallback to existing info to avoid data loss.
        let metrics = calculateMetrics(detection.bbox);
        
        if (!metrics) {
             console.warn("[DamageEditor] Metrics calculation failed/null. Preserving existing data.");
             metrics = {};
        }

        // PRESERVATION LOGIC:
        // If new metrics are missing critical values (like radio), assume we should keep the ones we loaded.
        if (!metrics.radio && (damageInfo.radio || damageInfo.radius)) {
             metrics.radio = damageInfo.radio || damageInfo.radius;
        }
        if (!metrics.width && (damageInfo.width || damageInfo.width_mm)) {
             metrics.width = damageInfo.width || damageInfo.width_mm;
        }
        if (!metrics.length && (damageInfo.length || damageInfo.length_mm)) {
             metrics.length = damageInfo.length || damageInfo.length_mm;
        }
        if (!metrics.area && damageInfo.area) {
             metrics.area = damageInfo.area;
        }


        // === INICIO CORRECCIÓN: Autocompletar Tipo Genérico a "Categoría X" ===
        // Usamos severityRaw y severityValue que ya fueron declaradas al inicio de la función
        
        // Extraer el número real para usarlo en el formato bonito
        const sevNum = String(severityRaw).replace(/\D/g, "") || "3";
        let finalDamageType = detection.damage_type || severityRaw;
        
        // Evaluar si el tipo actual es genérico o se dejó en blanco
        const isGenericType = !finalDamageType || 
                              finalDamageType === "Unknown" || 
                              /^\d+$/.test(finalDamageType.trim()) || 
                              /^Cat\s*\d+/i.test(finalDamageType.trim()) || 
                              /^Categor[ií]a\s*\d+/i.test(finalDamageType.trim());

        // Si es genérico, forzamos el formato "Categoría X"
        if (isGenericType) {
            finalDamageType = `Categoría ${sevNum}`; 
        }

        // Conservar los atributos que ya tiene el daño (p. ej. los del modelo de ML):
        // el upsert reemplaza la columna completa. Se leen frescos para no pisar otros cambios.
        const localDamage = allDamages.find((d) => String(d.id) === String(detection.id));
        let existingAttributes = localDamage?.attributes || detection.attributes || {};
        let existingRegion = localDamage?.region && typeof localDamage.region === "object" ? localDamage.region : {};
        if (detection.id && !detection.id.toString().startsWith("new-")) {
            const { data: current } = await getFindingAttributesAndRegion(detection.id);
            if (current?.attributes && typeof current.attributes === "object") {
                existingAttributes = current.attributes;
            }
            if (current?.region && typeof current.region === "object") {
                existingRegion = current.region;
            }
        }
        // Región: se conservan los datos del modelo de ML (image_dims, bbox en píxeles) y se
        // actualizan con el nuevo recuadro, además del formato {x, y, width, height}
        const regionDims = existingRegion.image_dims;
        const regionToSave = {
            ...existingRegion,
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height,
            bbox_xywh_norm: [region.x, region.y, region.width, region.height],
            ...(regionDims?.width && regionDims?.height
                ? {
                    bbox: [
                        region.x * regionDims.width,
                        region.y * regionDims.height,
                        (region.x + region.width) * regionDims.width,
                        (region.y + region.height) * regionDims.height,
                    ],
                }
                : {}),
        };
        const toNum = (v) => {
            const n = parseFloat(v);
            return Number.isFinite(n) ? n : undefined;
        };

        const payload = {
            capture_id: captureId,
            severity: severityValue,
            region: regionToSave,
            attributes: {
                ...existingAttributes,
                confidence: detection.confidence || 1.0,
                radius: metrics.radio,
                damage_type: finalDamageType, // <-- Ahora guarda "Categoría X" en la BD
                ...metrics,
                // Claves en mm que lee el visor de reportes: evitan que un valor anterior gane
                radius_mm: toNum(metrics.radio) > 0
                    ? Math.round(toNum(metrics.radio) * 1000)
                    : existingAttributes.radius_mm,
                length_mm: toNum(metrics.length) ?? existingAttributes.length_mm,
                width_mm: toNum(metrics.width) ?? existingAttributes.width_mm,
            },
        };
        // === FIN CORRECCIÓN ===
        


        if (detection.id && !detection.id.toString().startsWith("new-")) {
            payload.id = detection.id;
        } else if (stateData.damageInfo && stateData.damageInfo.damageId) {

        }
        
        console.log("[DamageEditor] Saving Payload:", payload);

        // 2. Save to Supabase (Upsert handles both insert and update)
        const { data, error } = await upsertFindingReturning(payload);

        if (error) {
            console.error("Supabase Save Error:", error);
            throw error;
        }

        const savedDetection = {
             ...detection,
             id: data.id, 
             // Update local detection with saved metrics
             ...metrics
        };

        // Reflejar el guardado en la lista y en los marcadores de esta pantalla
        const savedDamage = {
            id: data.id,
            capture_id: captureId,
            severity: severityValue,
            region: regionToSave,
            attributes: payload.attributes,
            damage_type: finalDamageType,
            radio: metrics.radio,
            length: metrics.length,
            width: metrics.width,
            area: metrics.area,
        };
        if (detection.id && !detection.id.toString().startsWith("new-")) {
            setDamageOverrides((prev) => ({ ...prev, [detection.id]: savedDamage }));
        } else {
            setAddedDamages((prev) => [...prev, { ...savedDamage, blade: bladeName, section }]);
        }
        setSelectedDamageId(data.id);

        // 2. Broadcast update to Report Viewer
        if (window.opener) {
            window.opener.postMessage({
                type: "vind:metadata-update",
                payload: {
                    damageId: detection.id,
                    // Include region to update thumbnail
                     region: {
                        x: detection.bbox[0],
                        y: detection.bbox[1],
                        width: detection.bbox[2],
                        height: detection.bbox[3]
                    },
                    bbox_xywh_norm: detection.bbox, // Also sending norm format if needed
                    width: metrics.width,
                    length: metrics.length,
                    area: metrics.area,
                        radius: metrics.radio,
                        severity: severityRaw, // BroadCast prefiere "Cat X"
                        damage_type: finalDamageType,
                        attributes: {
                        ...metrics,
                        damage_type: finalDamageType,
                        confidence: detection.confidence || 1.0
                    }
                }
            }, window.location.origin);
        }

        // 3. Broadcast update completion
        if (window.opener) {
            // Broadcast BBox
            window.opener.postMessage({
                type: "vind:bbox-update",
                payload: {
                    damageId: detection.id && !detection.id.toString().startsWith("new-") ? detection.id : data.id, 
                    bbox_xywh_norm: [
                         region.x, 
                         region.y, 
                         region.width, 
                         region.height
                    ]
                }
            }, window.location.origin);
            
            // Broadcast Severity
             window.opener.postMessage({
                type: "vind:severity-update",
                payload: {
                    damageId: detection.id && !detection.id.toString().startsWith("new-") ? detection.id : data.id,
                    severity: severityValue
                }
            }, window.location.origin);
            
            // Broadcast Metadata (Metrics)
            window.opener.postMessage({
                type: "vind:metadata-update",
                payload: {
                    damageId: detection.id && !detection.id.toString().startsWith("new-") ? detection.id : data.id,
                    ...metrics,
                    damage_type: finalDamageType,
                    severity: severityRaw
                }
            }, window.location.origin);

            // Pedir al visor de reportes que recargue el daño completo desde la base de datos
            window.opener.postMessage({
                type: "DAMAGE_UPDATED",
                damageId: detection.id && !detection.id.toString().startsWith("new-") ? detection.id : data.id
            }, window.location.origin);
        }
        
        // 4. Update local state
        setDetections(prev => prev.map(d => d.id === detection.id ? savedDetection : d));
        setEditingDetection(null);

        // 5. Update damage info panel immediately
        const newSeverity = severityRaw.startsWith("Cat ") ? severityRaw : `Cat ${severityRaw}`;
        const newDamageType = detection.damage_type || severityRaw || t("imageViewer.damage");
        let infoDamageTypeMain = "";
        let infoDamageTypeSub = "";
        if (newDamageType.includes(" - ")) {
          const parts = newDamageType.split(" - ");
          infoDamageTypeMain = parts[0];
          infoDamageTypeSub = parts[1];
        }

        setDamageInfo({
            damage_type: newDamageType,
            damage_type_main: infoDamageTypeMain,
            damage_type_sub: infoDamageTypeSub,
            severity: newSeverity,
            radio: metrics.radio || "-",
            length: metrics.length || "-",
            width: metrics.width || "-",
            area: metrics.area || "-",
            description: detection.description || "-"
        });
        
    } catch (e) {
        console.error("Error saving detection:", e);
        alert(t("messages.errorSavingDamage"));
    } finally {
        setDownloading(false);
    }
  };

  return { handleDeleteDetection, handleSaveDetection };
};
