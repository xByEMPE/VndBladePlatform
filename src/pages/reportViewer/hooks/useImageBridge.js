import { useEffect } from "react";
import { updateFindingReturning, insertFinding, deleteFinding, updateFinding, listBladesWithLength, listCaptureFilesForBlades } from "../../shared/data";
import { renderBoundingBox } from "../utils/renderBoundingBox";
import { toast } from "@/components/ui/use-toast";
import { getDamageBboxData } from "../../shared/damage";
import { tx } from "@/i18n/tx";
import { getImageUrl, primeImageUrls } from "@/lib/storageUrls";
import { getBladeDisplayName } from "../utils/labels";
import { getThumbnailUrl } from "../../shared/image";

// Puente con el editor de daños / visor de imágenes (otras ventanas): escucha los mensajes
// (postMessage) y abre el editor. La llamada a este hook debe ocupar la posición que tenía el
// efecto del listener dentro de ReportViewerPage (3.º efecto), para conservar el orden de efectos.
export const useImageBridge = ({ t, project, turbine, damages, setDamages, loadData, allTurbineImages, isClient }) => {
  // CORRECCIÓN: Escuchar mensajes simplificado, sin funcionalidades de debug
  useEffect(() => {
    const handleMessage = async (event) => {
      if (event.origin !== window.location.origin) return;
      try {
        const data = event?.data || {};
        if (!data || !data.type) return;

        if (data.type === "vind:bbox-update") {
          const { damageId, bbox_xywh_norm } = data.payload || {};
          if (!damageId || !bbox_xywh_norm) return;
          const damage = damages.find((d) => d.id === damageId);
          if (!damage) return;

          const [nx, ny, nw, nh] = bbox_xywh_norm;
          const region = { x: nx, y: ny, width: nw, height: nh };

          const { data: upd, error } = await updateFindingReturning(damageId, {
              region: region,
              updated_at: new Date().toISOString(),
            });

          if (error) throw error;

          setDamages((prev) =>
            prev.map((d) =>
              d.id === damageId
                ? {
                    ...d,
                    region: region,
                    updated_at: upd.updated_at,
                  }
                : d,
            ),
          );

          // Update list visual
          setTimeout(() => {
            const damageElement = document.querySelector(
              `[data-damage-id="${damageId}"]`,
            );
            if (damageElement) {
              const img = damageElement.querySelector("img");
              if (img && img.complete) {
                const newBboxData = {
                  bbox_xywh_norm: bbox_xywh_norm,
                  severity: damage.severity || "Cat 3",
                };
                renderBoundingBox(img, newBboxData);
              }
            }
          }, 100);

          toast({
            title: t("messages.success"),
            description: t("reportViewer.updated"),
          });
        }

        if (data.type === "vind:severity-update") {
          const { damageId, severity } = data.payload || {};
          if (!damageId || !severity) return;
          const damage = damages.find((d) => d.id === damageId);
          if (!damage) return;

          const { data: upd, error } = await updateFindingReturning(damageId, {
              severity: severity,
              updated_at: new Date().toISOString(),
            });
          if (error) throw error;
          setDamages((prev) =>
            prev.map((d) =>
              d.id === damageId
                ? { ...d, severity: severity, updated_at: upd.updated_at }
                : d,
            ),
          );

          // Actualizar vista previa de bounding box en la lista de daños (color por severidad)
          setTimeout(() => {
            const damageElement = document.querySelector(
              `[data-damage-id="${damageId}"]`,
            );
            if (damageElement) {
              const img = damageElement.querySelector("img");
              if (img && img.complete) {
                const updatedDamage = damages.find((d) => d.id === damageId);
                if (updatedDamage) {
                  const bboxData = getDamageBboxData({
                    ...updatedDamage,
                    severity: severity,
                  });
                  if (bboxData) {
                    renderBoundingBox(img, bboxData);
                  }
                }
              }
            }
          }, 100);
        }

        if (data.type === "vind:metadata-update") {
          const { damageId, width, length, radio, area, damage_type, severity } = data.payload || {};
          if (!damageId) return;

          // NEW: Refrescamos los datos completos desde BD para asegurar que
          // getDamageExtraData lea el nuevo JSONB/Description y no haya desfase.
          loadData().catch(err => console.error("Error reloading data on metadata update:", err));

          setDamages((prev) =>
            prev.map((d) => {
              if (String(d.id) === String(damageId)) {
                // Actualizamos los campos de primer nivel
                const newD = {
                  ...d,
                  width,
                  length,
                  radio,
                  area,
                  severity: severity || d.severity,
                  ...(data.payload.attributes || {}),
                };
                
                // Actualizamos el objeto attributes explícitamente para que 
                // getDamageExtraData lo intercepte
                if (!newD.attributes) newD.attributes = {};
                if (damage_type) newD.attributes.damage_type = damage_type;
                if (radio) newD.attributes.radius_mm = radio;
                if (length) newD.attributes.length_mm = length;
                if (width) newD.attributes.width_mm = width;

                return newD;
              }
              return d;
            })
          );
        }

        if (data.type === "vind:bbox-update") {
          const { damageId, bbox_xywh_norm } = data.payload || {};
          if (!damageId || !bbox_xywh_norm) return;

          // DO NOT UPSERT HERE - relying on Editor's upsert.
          // Just update local state to reflect change instantly.
          const [nx, ny, nw, nh] = bbox_xywh_norm;
          const region = { x: nx, y: ny, width: nw, height: nh };

          setDamages((prev) =>
            prev.map((d) =>
              String(d.id) === String(damageId)
                ? { ...d, region, ...data.payload }
                : d,
            ),
          );

          // Optionally we can loadData() if we trust it won't duplicate.
          // But state update is faster and safer against duplication (if loadData appends).
          // If we suspect loadData duplications, avoid calling it on update.
        }

        if (data.type === "DAMAGE_DELETED") {
          const { damageId } = data;
          if (!damageId) return;

          setDamages((prev) => prev.filter((d) => d.id !== damageId));
          toast({
            title: t("messages.success"),
            description: t("messages.damageDeleted"),
          });
        }

        if (data.type === "vind:bbox-create") {
          const {
            bbox_xywh_norm,
            severity,
            inspection_file_id, // This will be the capture_id in V2
            capture_id,
          } = data.payload || {};

          if (!bbox_xywh_norm) return;

          const finalCaptureId = capture_id || inspection_file_id;
          if (!finalCaptureId) {
            console.error("[ReportViewer] Missing capture_id for bbox-create");
            return;
          }

          const [nx, ny, nw, nh] = bbox_xywh_norm;
          const region = { x: nx, y: ny, width: nw, height: nh };

          const { data: ins, error: insErr } = await insertFinding({
              capture_id: finalCaptureId,
              severity: severity || "Cat 3",
              region: region,
              status: "Open",
              attributes: {
                auto_detected: false,
                created_from: "viewer_interaction",
              },
            });
          // Prevent Duplicate: Check if ID already exists in local list before inserting
          // But 'ins' is the NEW/UPSERTED row.
          // If we already have it, we shouldn't act?
          // Wait, 'select().single()' returns the row.
          // If it was an update, we get the updated row. If insert, new row.

          if (insErr) throw insErr;

          // Check if we already have this damage in state to avoid "new card" effect if it was just an update
          // actually loadData() refreshes everything.
          // The issue is if 'data' payload implies creation when it was an update?
          // If we used .upsert(), it handles both.

          // To fix the "Double Card" issue:
          // Just reload data. deduplication happens at DB level (PK).
          // BUT if prompt creates a NEW LOCAL object before reload...

          await loadData();

          // Enviar de vuelta el nuevo id al visor de imagen para actualizar el contexto
          if (event?.source && ins?.id) {
            event.source.postMessage(
              {
                type: "vind:bbox-created",
                payload: {
                  damageId: ins.id,
                  success: true,
                },
              },
              window.location.origin,
            );
          }

          toast({
            title: t("messages.success"),
            description: t("reportViewer.updated"),
          });
        }

        if (data.type === "vind:bbox-delete") {
          const { damageId } = data.payload || {};
          if (!damageId) return;

          const { error } = await deleteFinding(damageId);

          if (error) throw error;

          await loadData();
          toast({
            title: t("messages.success"),
            description: tx("Caja eliminada correctamente"),
          });
        }

        // Handlers for New Damage Editor (DamageEditorPage.jsx)
        if (data.type === "DELETE_DAMAGE") {
          const { damageId } = data;
          if (!damageId) return;

          const { error } = await deleteFinding(damageId);

          if (error) throw error;

          await loadData();
          toast({
            title: t("messages.success"),
            description: tx("Daño eliminado correctamente"),
          });
        }

        if (data.type === "UPDATE_DAMAGE") {
          const { damage } = data;
          if (!damage) return;

          // Legacy/Direct update logic
          const region = {
            x: damage.bbox[0],
            y: damage.bbox[1],
            width: damage.bbox[2],
            height: damage.bbox[3],
          };

          const updatePayload = {
            region: region,
            severity: damage.severity,
            updated_at: new Date().toISOString(),
          };

          const { error } = await updateFinding(damage.id, updatePayload);

          if (error) throw error;

          await loadData();
          toast({
            title: t("messages.success"),
            description: t("messages.damageUpdated"),
          });
        }

        if (data.type === "vind:metadata-update") {
          const { payload } = data;
          // damageId is inside payload, not at top level of message data
          const damageId = data.damageId || (payload && payload.damageId);

          if (!damageId) return;

          // NEW: Reload data to ensure full consistency with DB (especially severity column vs attributes)
          loadData().catch((err) =>
            console.error("Error reloading data on metadata update:", err),
          );

          setDamages((prev) =>
            prev.map((d) => {
              if (d.id === damageId) {
                // Update internal description for thumbnail reactivity
                let newDesc = d.description;
                // Shim description if region provided
                if (payload && (payload.region || payload.bbox_xywh_norm)) {
                  try {
                    const baseDesc =
                      d.description && d.description.startsWith("{")
                        ? JSON.parse(d.description)
                        : {};

                    newDesc = JSON.stringify({
                      ...baseDesc,
                      bbox_xywh_norm: payload.bbox_xywh_norm || [
                        payload.region.x,
                        payload.region.y,
                        payload.region.width,
                        payload.region.height,
                      ],
                      // Update other metrics in JSON if needed
                      width_mm: payload.width,
                      length_mm: payload.length,
                      radius_mm: payload.radius,
                      area: payload.area,
                    });
                  } catch (e) {
                    console.warn("Error updating description Json", e);
                  }
                }

                return {
                  ...d,
                  ...payload,
                  description: newDesc,
                  // Ensure priority fields are updated
                  severity: payload.severity || d.severity,
                  radius: payload.radius || d.radius,
                };
              }
              return d;
            }),
          );
        }

        // NEW: Listen for completion events from DamageEditorPage
        if (data.type === "DAMAGE_UPDATED" || data.type === "DAMAGE_DELETED") {
          console.log("[ReportViewer] Received sync event:", data.type);
          // We can reload data to be safe, but local update above might be enough for visuals.
          loadData().catch((err) =>
            console.error("Error reloading data on sync event:", err),
          );
        }
      } catch (err) {
        console.error("[ReportViewer] bbox message handling error:", err);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [damages, project, turbine, t]);

  // === Función para abrir imagen usando las nuevas páginas ===
  const openImageInNewWindow = async (file, section, blade, options = {}) => {
    let allImages = [];
    let currentIndex = 0;
    let fullImage = file;

    // Intentar encontrar la imagen completa con metadatos en allTurbineImages
    if (
      allTurbineImages &&
      allTurbineImages[blade] &&
      allTurbineImages[blade][section]
    ) {
      const found = allTurbineImages[blade][section].find(
        (img) => img.path === file.path,
      );
      if (found) {
        console.log(
          "[Viewer] Imagen encontrada en cache con metadatos:",
          found,
        );
        fullImage = found;
      }
    }

    // Si es un daño específico, usar DamageEditorPage
    if (options.damageId) {
      console.log(
        "[Viewer] ========== INICIANDO NAVEGACIÓN A DAMAGE EDITOR ==========",
      );
      console.log("[Viewer] Daño ID:", options.damageId);
      console.log("[Viewer] File:", file);
      console.log("[Viewer] FullImage (con metadata):", fullImage);

      const data = { publicUrl: getImageUrl(file.path) };

      // Preparar datos del daño
      const damageInfo = {
        damageId: options.damageId,
        section: section,
        blade: blade,
        severity: options.category || "Cat 3",
        // Map passed options to safe defaults
        damage_type:
          options.damage_type || options.category || t("imageViewer.damage"),
        radio: options.radio || null,
        length: options.length || null,
        width: options.width || null,
        area: options.area || null,
        bbox_xywh_norm: options.bbox_xywh_norm || null,
      };

      // Preparar detecciones para el canvas
      const detections = [];
      if (options.bbox_xywh_norm) {
        const [x, y, w, h] = options.bbox_xywh_norm;
        detections.push({
          id: options.damageId, // FIXED: Pass ID to allow updates
          bbox: [x, y, w, h],
          severity: options.category || "Cat 3",
          confidence: 0.9,
          category: options.category || t("imageViewer.damage"),
          // Pass saved metrics so DamageEditor doesn't need to recalculate
          radio: options.radio || null,
          width: options.width || null,
          length: options.length || null,
          area: options.area || null,
          damage_type: options.damage_type || null,
          attributes: {
            radio: options.radio || null,
            width: options.width || null,
            length: options.length || null,
            area: options.area || null,
            damage_type: options.damage_type || null,
          },
        });
      }

      const stateData = {
        imageSrc: data.publicUrl,
        imageAlt: file.name,
        detections,
        damageInfo,
        navigationData: {
          projectName: project?.name || "",
          wtg: turbine?.turbine_name || "",
          blade: blade,
        },
        userRole: isClient ? "client" : "admin",
        bladeLength:
          turbine?.blades?.find(
            (b) => getBladeDisplayName(b.blade_name) === blade,
          )?.blade_length || 50,
        section,
        currentImage: fullImage, // Pasar imagen completa con metadatos
        // NEW: Pass full context for sidebars
        allImages:
          allTurbineImages &&
          allTurbineImages[blade] &&
          allTurbineImages[blade][section]
            ? allTurbineImages[blade][section]
            : [],
        damages: damages || [], // Pass all damages for filtering
      };

      // Abrir DamageEditorPage en nueva pestaña.
      // El estado se guarda ANTES de abrir: si el navegador abre el editor en la misma pestaña
      // (o devuelve null), el editor lo recupera igual desde localStorage y no se queda vacío.
      const damageEditorUrl = `/damage-editor`;
      const storageKey = `damageEditorState_${Date.now()}`;
      try {
        localStorage.setItem(storageKey, JSON.stringify(stateData));
      } catch (error) {
        console.error("[Viewer] Error guardando en localStorage:", error);
        toast({
          title: t("common.error"),
          description: tx("No se pudo preparar el daño para abrirlo en el editor."),
          variant: "destructive",
        });
        return;
      }

      const newWindow = window.open(damageEditorUrl, "_blank");
      if (!newWindow) {
        // Ventana bloqueada: abrir en esta misma pestaña
        window.location.assign(damageEditorUrl);
        return;
      }

      const sendKey = () => {
        try {
          newWindow.postMessage(
            {
              type: "NAVIGATION_STATE_KEY",
              storageKey: storageKey,
            },
            window.location.origin,
          );
        } catch (error) {
          console.error("[Viewer] Error enviando clave:", error);
        }
      };
      newWindow.addEventListener?.("load", sendKey);
      setTimeout(sendKey, 500);
      setTimeout(sendKey, 1000);
      setTimeout(sendKey, 2000);

      setTimeout(() => {
        localStorage.removeItem(storageKey);
      }, 30000);
      return;
    }

    // Si NO es un daño específico, preparar allImages para navegación normal (galería de imágenes)
    console.log("[Viewer] Abriendo galería de imágenes para sección:", section);
    const sections = ["TE", "PS", "LE", "SS"];

    // Verificar si allTurbineImages está disponible y tiene imágenes
    const hasImages =
      allTurbineImages &&
      allTurbineImages[blade] &&
      Object.values(allTurbineImages[blade]).some(
        (sectionImages) => sectionImages.length > 0,
      );

    if (!hasImages) {
      console.warn(
        "[Viewer] allTurbineImages no disponible, cargando imágenes directamente desde BD",
      );

      // Cargar imágenes directamente desde la base de datos para clientes
      try {
        const { data: blades, error: bladesError } = await listBladesWithLength(turbine.id);

        if (bladesError) throw bladesError;

        const bladeIds = blades.map((b) => b.id);

        // V2: Query captures instead of inspection_files
        const { data: captures, error: filesError } = await listCaptureFilesForBlades(bladeIds);

        if (filesError) throw filesError;

        await primeImageUrls(
          (captures || []).map((c) => c.storage_path),
          { withThumbs: true },
        );

        // Cargar todas las imágenes de la turbina
        // Note: captures table implies it's an image capture
        (captures || []).forEach((cap) => {
          const bladeData = blades.find((b) => b.id === cap.blade_id);
          if (bladeData && cap.section && cap.storage_path) {
            const bladeName = getBladeDisplayName(bladeData.blade_name);
            if (bladeName === blade) {
              // Solo cargar imágenes de la pala actual
              const data = { publicUrl: getImageUrl(cap.storage_path) };

              const fileName = cap.storage_path.split("/").pop();

              allImages.push({
                src: data.publicUrl,
                thumbnailSrc: getThumbnailUrl(cap.storage_path), // NEW
                url: data.publicUrl,
                name: fileName,
                file_path: cap.storage_path,
                path: cap.storage_path,
                section: cap.section,
                id: cap.id, // using capture id
                raw_metadata: cap.raw_metadata,
                position_meters: cap.calculated_height_m,
                position_percentage: null,
                position_ratio: null,
                mrk_processed: false,
                ellh_value: null,
                mrk_source_file: null,
                blade_length: bladeData.blade_length,
              });
            }
          }
        });

        currentIndex = allImages.findIndex((img) => img.path === file.path);
        if (currentIndex === -1) currentIndex = 0;
      } catch (error) {
        console.error("[Viewer] Error cargando imágenes desde BD:", error);
        // Fallback: solo imagen actual
        const data = { publicUrl: getImageUrl(file.path) };
        allImages = [
          {
            src: data.publicUrl,
            thumbnailSrc: getThumbnailUrl(file.path), // NEW
            url: data.publicUrl,
            name: file.name,
            file_path: file.path,
            path: file.path,
            section: section,
            inspection_file_id: file.inspection_file_id || file.id || 0,
            position_meters: file.position_meters,
            position_percentage: file.position_percentage,
            position_ratio: file.position_ratio,
            mrk_processed: file.mrk_processed,
            ellh_value: file.ellh_value,
            mrk_source_file: file.mrk_source_file,
          },
        ];
        currentIndex = 0;
      }
    } else {
      // Usar allTurbineImages cuando está disponible
      allImages = []; // Reset array
      sections.forEach((sec) => {
        if (allTurbineImages[blade] && allTurbineImages[blade][sec]) {
          // Clone array to avoid mutating state
          let secImages = [...allTurbineImages[blade][sec]];

          const secUpper = sec.toUpperCase();
          // Invert order for LE and TE to show Tip -> Root (User Request)
          if (["LE", "TE"].includes(secUpper)) {
            console.log(
              `[ReportViewer] Reversing images for section ${sec} (Tip->Root)`,
            );
            secImages.reverse();
          } else {
            console.log(
              `[ReportViewer] Keeping default order for section ${sec}`,
            );
          }

          secImages.forEach((img) => {
            const data = { publicUrl: getImageUrl(img.path) };
            allImages.push({
              src: data.publicUrl, // Changed from url
              thumbnailSrc: getThumbnailUrl(img.path), // NEW
              url: data.publicUrl, // Keep for back-compat
              name: img.name,
              file_path: img.path, // Changed from path to file_path
              path: img.path, // Keep for back-compat
              section: sec,
              id: img.inspection_file_id || img.id, // Changed/Unified
              raw_metadata: img.raw_metadata,
              position_meters: img.position_meters,
              position_percentage: img.position_percentage,
              position_ratio: img.position_ratio,
              mrk_processed: img.mrk_processed,
              ellh_value: img.ellh_value,
              mrk_source_file: img.mrk_source_file,
            });
          });
        }
      });

      currentIndex = allImages.findIndex((img) => img.path === file.path);
    }

    if (currentIndex === -1) {
      console.error(
        "[Viewer] No se encontró la imagen actual en la lista de todas las imágenes",
      );
      console.log("[Viewer] Buscar Path:", file.path);
      console.log(
        "[Viewer] Imágenes disponibles (Primeras 5):",
        allImages
          .slice(0, 5)
          .map((img) => ({ path: img.path, section: img.section })),
      );
      return;
    }

    console.log("[Viewer] Imagen actual:", file);
    console.log("[Viewer] Total imágenes cargadas:", allImages.length);
    console.log("[Viewer] Índice actual encontrado:", currentIndex);
    console.log("[Viewer] Imagen en índice 0:", allImages[0]?.path);
    console.log(
      "[Viewer] Imagen en índice encontrado:",
      allImages[currentIndex]?.path,
    );

    console.log("[Viewer] Imagen actual:", file);
    console.log("[Viewer] Total imágenes cargadas:", allImages.length);
    console.log("[Viewer] Índice actual encontrado:", currentIndex);

    // Preparar datos para ImageViewerPage
    const imageListForViewer = allImages.map((img) => ({
      src: img.url,
      thumbnailSrc: img.thumbnailSrc, // Pass thumbnail for sidebar performance

      alt: img.name,
      file_path: img.path,
      file_name: img.name,
      section: img.section,
      blade_height_meters: img.position_meters,
      inspection_file_id: img.inspection_file_id || img.id,
      id: img.id, // Explicitly pass ID
      // Pass full metadata for global calculations (GSD, dims)
      raw_metadata: img.raw_metadata || {},
    }));

    // Abrir ImageViewerPage en nueva pestaña
    console.log("[Viewer] Abriendo /image-viewer en nueva pestaña...");

    // CLEANUP: Remove old keys to avoid storage bloat and confusion
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((k) => {
        if (k.startsWith("imageViewerState_")) {
          localStorage.removeItem(k);
        }
      });
    } catch (e) {
      console.warn("Error cleaning up old viewer states", e);
    }

    // Generar clave única
    const storageKey = `imageViewerState_${Date.now()}`;
    const imageViewerUrl = `/image-viewer?stateKey=${storageKey}`;

    // Preparar datos COMPLETO antes de abrir ventana
    const imageViewerState = {
      allImages: imageListForViewer,
      currentImageIndex: currentIndex,
      section: section,
      navigationData: {
        projectName: project?.name || "",
        wtg: turbine?.turbine_name || "",
        blade: blade,
      },
      userRole: isClient ? "client" : "admin",
      bladeLength:
        turbine?.blades?.find(
          (b) => getBladeDisplayName(b.blade_name) === blade,
        )?.blade_length || 50,
      damages: damages || [],
    };

    // 1. Guardar en localStorage PRIMERO
    try {
      localStorage.setItem(storageKey, JSON.stringify(imageViewerState));
      console.log(
        `[Viewer] Saved state to localStorage with key: ${storageKey}`,
      );
    } catch (e) {
      console.error("[Viewer] Failed to save state to localStorage", e);
      // Podemos decidir no abrir la ventana si falla el storage, o intentarlo igual
    }

    // 2. Abrir ventana (ahora el hijo encontrará los datos seguro)
    console.log("[Viewer] Abriendo /image-viewer en nueva pestaña...");
    window.open(imageViewerUrl, "_blank");
  };

  return { openImageInNewWindow };
};
