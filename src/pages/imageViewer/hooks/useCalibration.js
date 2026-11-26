import { useEffect } from "react";
import { tx } from "@/i18n/tx";
import { supabase } from "@/lib/supabase";
import { getTurbineStitched, getTurbineStitchedStrict, updateTurbineReturningId } from "../../shared/data";
import { parseStitched } from "../utils/stitched";
import { canEditByRole } from "../../shared/roles";

// Calibración manual de la imagen "stitched": permisos, calibración guardada, lectura/escritura en la turbina,
// escala de la regla, acciones del usuario y marcadores. Los efectos conservan su orden relativo.
export const useCalibration = ({
  isStitched, userRole, currentImage, calibLength,
  calibrations, stitchedTurbineId, retryAuth, bladeLength,
  calibStep, calibTipTemp, showRuler, toast,
  setCalibrations, setCalibLength, setCalibStep, setCalibTipTemp,
  setCalibSaving, setShowRuler,
}) => {
  // ----- CALIBRACIÓN MANUAL (STITCHED) -----
  const canCalibrate =
    isStitched && canEditByRole(userRole);
  const stitchedKey = currentImage?.stitchedKey || null; // { blade: "A", section: "LeadingEdge" }
  const calibLengthNum = Number(calibLength);

  // Calibración guardada de la imagen actual (la ven todos los usuarios)
  const savedCalib =
    isStitched && stitchedKey
      ? calibrations?.[stitchedKey.blade]?.[stitchedKey.section] || null
      : null;

  // Leer las calibraciones guardadas de la turbina
  useEffect(() => {
    if (!isStitched || !stitchedTurbineId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await getTurbineStitched(stitchedTurbineId);
      if (cancelled) return;
      if (error) {
        console.warn("[ImageViewer] No se pudo leer la calibración stitched", error);
        return;
      }
      setCalibrations(parseStitched(data?.stitched)._calibration || {});
    })();
    return () => {
      cancelled = true;
    };
  }, [isStitched, stitchedTurbineId, retryAuth]);

  // Largo de pala: el guardado con la calibración; si no hay, el sugerido por el reporte
  useEffect(() => {
    if (!isStitched) return;
    if (savedCalib?.bladeLength) setCalibLength(String(savedCalib.bladeLength));
    else if (bladeLength) setCalibLength((prev) => prev || String(bladeLength));
  }, [isStitched, savedCalib?.bladeLength, bladeLength]);

  // Cambiar de imagen cancela una calibración en curso
  useEffect(() => {
    setCalibStep(null);
    setCalibTipTemp(null);
  }, [currentImage?.file_path]);

  // Guardar (o borrar, con entry = null) la calibración de la imagen actual.
  // Lee la fila justo antes de escribir para no pisar cambios de otros usuarios.
  const persistCalibration = async (entry) => {
    if (!stitchedTurbineId || !stitchedKey) return false;
    setCalibSaving(true);
    try {
      const { data: row, error: readErr } = await getTurbineStitchedStrict(stitchedTurbineId);
      if (readErr) throw readErr;

      const wasText = typeof row?.stitched === "string";
      const stitched = { ...parseStitched(row?.stitched) };
      const all = { ...(stitched._calibration || {}) };
      const bladeCal = { ...(all[stitchedKey.blade] || {}) };

      if (entry) {
        const { data: userData } = await supabase.auth.getUser();
        bladeCal[stitchedKey.section] = {
          tipY: entry.tipY,
          rootY: entry.rootY,
          bladeLength: entry.bladeLength,
          updatedAt: new Date().toISOString(),
          updatedBy: userData?.user?.email || null,
        };
      } else {
        delete bladeCal[stitchedKey.section];
      }
      if (Object.keys(bladeCal).length) all[stitchedKey.blade] = bladeCal;
      else delete all[stitchedKey.blade];
      if (Object.keys(all).length) stitched._calibration = all;
      else delete stitched._calibration;

      // .select() permite detectar escrituras bloqueadas por permisos (0 filas, sin error)
      const { data: updated, error: writeErr } = await updateTurbineReturningId(stitchedTurbineId, { stitched: wasText ? JSON.stringify(stitched) : stitched });
      if (writeErr) throw writeErr;
      if (!updated || updated.length === 0) {
        throw new Error(tx("No tienes permiso para guardar la calibración."));
      }

      setCalibrations(all);
      toast({
        title: entry ? tx("Calibración guardada") : tx("Calibración borrada"),
        description: tx("Visible para todos los usuarios."),
      });
      return true;
    } catch (e) {
      console.error("[ImageViewer] Error guardando la calibración", e);
      toast({
        title: tx("No se pudo guardar la calibración"),
        description: e?.message || tx("Inténtalo de nuevo."),
        variant: "destructive",
      });
      return false;
    } finally {
      setCalibSaving(false);
    }
  };

  // Escala resultante: tip/root (px) + largo de pala (m) -> mm/px y radio en el borde superior
  const stitchedRuler = (() => {
    if (!savedCalib || !(Number(savedCalib.bladeLength) > 0)) return null;
    const dist = Math.abs(savedCalib.rootY - savedCalib.tipY);
    if (dist < 10) return null;
    const L = Number(savedCalib.bladeLength);
    const mPerPx = L / dist;
    const tipAtTop = savedCalib.tipY < savedCalib.rootY;
    return {
      mmPerPx: mPerPx * 1000,
      isRootToTip: !tipAtTop,
      // radio (m) en la fila 0 de la imagen: la punta vale el largo y la raíz 0
      startMeters: tipAtTop ? L + savedCalib.tipY * mPerPx : -savedCalib.rootY * mPerPx,
    };
  })();

  const handleCalibrationClick = async (coords) => {
    if (!canCalibrate) return;
    if (calibStep === "tip") {
      setCalibTipTemp(coords.y);
      setCalibStep("root");
    } else if (calibStep === "root") {
      if (Math.abs(coords.y - calibTipTemp) < 10) {
        toast({
          title: "Puntos muy cercanos",
          description: tx("Marca la raíz lejos de la punta."),
          variant: "destructive",
        });
        return;
      }
      const tipY = calibTipTemp;
      setCalibStep(null);
      setCalibTipTemp(null);
      setShowRuler(true);
      await persistCalibration({ tipY, rootY: coords.y, bladeLength: calibLengthNum });
    }
  };

  const startCalibration = () => {
    if (!canCalibrate) return;
    if (!(calibLengthNum > 0)) {
      toast({
        title: tx("Falta el largo de la pala"),
        description: tx("Indica el largo de la pala en metros antes de calibrar."),
        variant: "destructive",
      });
      return;
    }
    setCalibTipTemp(null);
    setCalibStep("tip");
  };

  // Corregir el largo de pala de una calibración ya guardada
  const commitCalibLength = () => {
    if (
      canCalibrate &&
      savedCalib &&
      calibLengthNum > 0 &&
      calibLengthNum !== Number(savedCalib.bladeLength)
    ) {
      persistCalibration({
        tipY: savedCalib.tipY,
        rootY: savedCalib.rootY,
        bladeLength: calibLengthNum,
      });
    }
  };

  const clearCalibration = () => {
    if (canCalibrate) persistCalibration(null);
  };

  const calibMarkers = [
    ...(savedCalib && (canCalibrate || showRuler)
      ? [
          { y: savedCalib.tipY, label: "PUNTA", color: "#34d399" },
          { y: savedCalib.rootY, label: tx("RAÍZ"), color: "#f472b6" },
        ]
      : []),
    ...(calibStep === "root" && calibTipTemp !== null
      ? [{ y: calibTipTemp, label: "PUNTA", color: "#34d399" }]
      : []),
  ];

  return { canCalibrate, savedCalib, stitchedRuler, handleCalibrationClick, startCalibration, commitCalibLength, clearCalibration, calibMarkers };
};
