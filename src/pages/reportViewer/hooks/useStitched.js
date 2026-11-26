import { useMemo } from "react";
import { getImageUrl } from "@/lib/storageUrls";
import { getDamageBboxData, getDamageExtraData, getLocalizedDamageString } from "../../shared/damage";
import { sevNumber } from "@/components/reportViewer/viewerKit";
import { getThumbnailUrl } from "../../shared/image";
import { getBladeDisplayName } from "../utils/labels";

// Stitched y reconstrucción 3D: mapa de rutas de las caras, calibraciones y daños ubicados por radio,
// y apertura del visor/editor. No contiene efectos; la llamada ocupa la posición original del bloque.
export const useStitched = ({ turbine, i18n, damages, openImageInNewWindow, isClient, project }) => {
  // === Stitched: mapa de rutas y apertura en el visor de imágenes ===
  const getStitchedMap = () => {
    if (!turbine?.stitched) return {};
    try {
      return typeof turbine.stitched === "string"
        ? JSON.parse(turbine.stitched)
        : turbine.stitched;
    } catch (e) {
      console.error("Error parsing stitched JSON", e);
      return {};
    }
  };

  // === Reconstrucción 3D: caras (stitched), calibraciones y daños ubicados por radio ===
  const reconBladeLength = Number(turbine?.blade_length) || Number(turbine?.blades?.[0]?.blade_length) || 50;

  const reconStitched = useMemo(() => {
    const map = getStitchedMap();
    const faces = { LE: "LeadingEdge", PS: "PressureSide", TE: "TrailingEdge", SS: "SuctionSide" };
    const urls = {};
    for (const blade of ["A", "B", "C"]) {
      for (const [section, key] of Object.entries(faces)) {
        const path = map?.[blade]?.[key];
        if (!path) continue;
        urls[blade] = urls[blade] || {};
        urls[blade][section] = getImageUrl(path);
      }
    }
    return { urls, calibrations: map?._calibration || {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turbine?.stitched]);

  const reconItems = useMemo(
    () =>
      damages
        .map((d) => {
          const blade = String(d.blade || "").replace(/^Blade\s*/i, "");
          if (!["A", "B", "C"].includes(blade)) return null;
          const attrs = d.attributes || {};
          // Radio en m desde la raíz; 0 o negativo = daño en la zona de raíz (guardapolvo/brida)
          const r = Number(attrs.radio ?? attrs.radius ?? d.radio);
          const radiusM = Number.isFinite(r) ? Math.min(Math.max(r, 0), reconBladeLength) : null;
          const bb = getDamageBboxData(d)?.bbox_xywh_norm;
          const u = bb ? Math.min(0.92, Math.max(0.08, Number(bb[0]) + Number(bb[2]) / 2)) : 0.5;
          const extra = getDamageExtraData(d);
          return {
            id: d.id,
            blade,
            section: d.section,
            s: radiusM != null ? radiusM / reconBladeLength : null,
            u: Number.isFinite(u) ? u : 0.5,
            sev: sevNumber(d.severity),
            radiusM,
            lengthMm: Number(extra.length_mm) || Number(attrs.length_mm) || 0,
            widthMm: Number(extra.width_mm) || Number(attrs.width_mm) || 0,
            typeLabel: getLocalizedDamageString(extra.damage_type, i18n),
            thumbUrl: getThumbnailUrl(d.capture_storage_path),
            imageUrl: d.capture_storage_path
              ? getImageUrl(d.capture_storage_path)
              : null,
            bbox: bb || null,
            raw: d,
          };
        })
        .filter(Boolean),
    [damages, reconBladeLength, i18n.language],
  );

  // Abre un daño en el Damage Editor (mismo flujo que la miniatura de la tarjeta de daño)
  const openDamageInEditor = (d) => {
    if (!d?.capture_storage_path) return;
    const bboxData = getDamageBboxData(d);
    const extra = getDamageExtraData(d);
    openImageInNewWindow(
      { name: d.capture_storage_path.split("/").pop(), path: d.capture_storage_path },
      d.section,
      d.blade,
      {
        damageId: d.id,
        bbox_xywh_norm: bboxData?.bbox_xywh_norm || null,
        category: d.severity || "Cat 3",
        radio: extra.radius_mm ? extra.radius_mm / 1000 : 0,
        length: extra.length_mm,
        width: extra.width_mm,
        area: extra.area,
        damage_type: extra.damage_type,
      },
    );
  };

  const STITCHED_SECTIONS = ["LeadingEdge", "PressureSide", "SuctionSide", "TrailingEdge"];

  const STITCHED_SHORT = {
    LeadingEdge: "LE",
    PressureSide: "PS",
    SuctionSide: "SS",
    TrailingEdge: "TE",
  };

  // Abre la stitched elegida en /image-viewer (nueva pestaña), con las demás secciones de la
  // misma pala en el panel lateral. Sin calibración: el visor oculta regla y mediciones.
  const openStitchedInViewer = (blade, section) => {
    const bladeData = getStitchedMap()[blade] || {};
    const list = STITCHED_SECTIONS.filter((sec) => bladeData[sec]).map((sec) => {
      const url = getImageUrl(bladeData[sec]);
      const label = `Blade ${blade} · ${STITCHED_SHORT[sec]}`;
      return {
        id: `stitched-${blade}-${sec}`, // único: el panel lateral compara por id
        src: url,
        alt: `Stitched Blade ${blade} - ${STITCHED_SHORT[sec]}`,
        file_path: bladeData[sec],
        path: bladeData[sec], // el panel lateral también compara por path
        file_name: label,
        section: `Stitched Blade ${blade}`,
        raw_metadata: {},
        stitchedKey: { blade, section: sec }, // clave de la calibración guardada
      };
    });
    const currentIndex = list.findIndex((img) => img.id === `stitched-${blade}-${section}`);
    if (currentIndex === -1) return;

    try {
      // Limpiar estados anteriores del visor, igual que al abrir fotos normales
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("imageViewerState_")) localStorage.removeItem(k);
      });
      const storageKey = `imageViewerState_${Date.now()}`;
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          allImages: list,
          currentImageIndex: currentIndex,
          section: `Stitched Blade ${blade}`,
          isStitched: true,
          turbineId: turbine?.id || null, // para leer/guardar la calibración
          navigationData: {
            projectName: project?.name || "",
            wtg: turbine?.turbine_name || "",
            blade: `Blade ${blade}`,
          },
          userRole: isClient ? "client" : "admin",
          // Largo de la pala en metros: sugerido para calibrar la regla (editable en el visor)
          bladeLength:
            Number(
              turbine?.blades?.find(
                (b) => getBladeDisplayName(b.blade_name) === `Blade ${blade}`,
              )?.blade_length || turbine?.blade_length,
            ) || null,
        }),
      );
      window.open(`/image-viewer?stateKey=${storageKey}`, "_blank");
    } catch (e) {
      console.error("[Stitched] No se pudo abrir el visor, abriendo la imagen directa", e);
      window.open(list[currentIndex].src, "_blank", "noopener,noreferrer");
    }
  };

  return { getStitchedMap, reconBladeLength, reconStitched, reconItems, openDamageInEditor, openStitchedInViewer };
};
