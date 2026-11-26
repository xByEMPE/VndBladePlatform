import { tx, dateLocale } from "@/i18n/tx";
import { supabase } from "@/lib/supabase";
import { getProjectById, getProjectByName, listTurbinesByProject } from "./shared/data";
import { listCapturesByBlade } from "./shared/data";
import { getImageUrl, primeImageUrls } from "@/lib/storageUrls";
import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Edit3,
  Save,
  XCircle,
  Eye,
  EyeOff,
  Download,
  Sun,
  Contrast as ContrastIcon,
  Loader2,
  ChevronDown,
  Crosshair,
  Maximize,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Wrench,
  Menu,
} from "lucide-react";
import VirtualBladeRuler from "@/components/VirtualBladeRuler";
import BladeModelViewer from "@/components/BladeModelViewer";
import OptimizedImage from "@/components/OptimizedImage";
import { useExifData } from "@/hooks/useExifData";
import { SectionTiles, DetectionList, PanelTitle, ToolBtn, ToolGroup, ToolSlider } from "@/components/damageEditor/panels";
import { SEV, sevNumber, OVERLINE, FOCUS } from "@/components/reportViewer/viewerKit";

import { DAMAGE_TYPES, getLocalizedDamageString } from "./shared/damage";
export { DAMAGE_TRANSLATIONS_EN, getLocalizedDamageString } from "./shared/damage";
import {
  normSev,
  getDamageBbox,
  getDamageMetrics,
  damageTypeRaw,
  damageTypeLabel,
} from "./shared/damage";
import { getThumbPublicUrl } from "./shared/image";
import { canEditByRole } from "./shared/roles";
import { downloadNegativePng, downloadWithWatermark } from "./damageEditor/utils/downloads";
import { takePendingEditorState, readSessionEditorState } from "./damageEditor/utils/editorState";
import { useEditorData } from "./damageEditor/hooks/useEditorData";
import { useDamageMetrics } from "./damageEditor/hooks/useDamageMetrics";
import { useEditorBridge } from "./damageEditor/hooks/useEditorBridge";
import { useDetectionActions } from "./damageEditor/hooks/useDetectionActions";
import { useCanvasInteraction } from "./damageEditor/hooks/useCanvasInteraction";
import { ImageStage } from "./damageEditor/components/ImageStage";
import { ComparePanel } from "./damageEditor/components/ComparePanel";
import { EditorHeader } from "./damageEditor/components/EditorHeader";
import { EditorToolbar } from "./damageEditor/components/EditorToolbar";
import { BladeViewerPanel } from "./damageEditor/components/BladeViewerPanel";
import { SectionsPanel } from "./damageEditor/components/SectionsPanel";
import { DamageInfoPanel } from "./damageEditor/components/DamageInfoPanel";
import { DetectionsPanel } from "./damageEditor/components/DetectionsPanel";

const SECTION_ORDER = ["TE", "PS", "LE", "SS"];

const DamageEditorPage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showLayers, setShowLayers] = useState(true);
  const [editingDetection, setEditingDetection] = useState(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [damageInfo, setDamageInfo] = useState({});
  const [receivedState, setReceivedState] = useState(() => takePendingEditorState() || readSessionEditorState());
  const [detections, setDetections] = useState([]);
  const [negativeMode, setNegativeMode] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showMeasurementRulers, setShowMeasurementRulers] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth >= 1024
  ); // New sidebar state
  const [sidebarHover, setSidebarHover] = useState(false); // For hover effect on toggle
  
  // Tools State (Parity with BladeInspectionViewer)
  const [toolMode, setToolMode] = useState("none"); // "none", "crosshair", "area"
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 }); // Image coordinates
  const [polygons, setPolygons] = useState([]); // Saved polygons
  const [currentPolygon, setCurrentPolygon] = useState([]); // Currently drawing
  const [draggedPointInfo, setDraggedPointInfo] = useState(null);
  const [fitScale, setFitScale] = useState(1);
  
  // Bounding Box Interaction State
  const [resizingBox, setResizingBox] = useState(null); // { detectionId, handle: 'nw'|'ne'|'sw'|'se'|'n'|'s'|'e'|'w'|'move' }
  const [initialBoxState, setInitialBoxState] = useState(null); // Snapshot for resize/move
  
  
  // Split View State
  const [compareImage, setCompareImage] = useState(null); // Ensure null initially
  const [compareZoom, setCompareZoom] = useState(1);
  const [comparePan, setComparePan] = useState({ x: 0, y: 0 });
  const [isDraggingCompare, setIsDraggingCompare] = useState(false);
  const [dragStartCompare, setDragStartCompare] = useState({ x: 0, y: 0 });

  // Mover definición de stateData al inicio para evitar ReferenceError
  const stateData = receivedState || location.state || {};
  
  const {
    imageSrc,
    imageAlt,
    detections: initialDetections = [],
    damageInfo: initialDamageInfo = {},
    navigationData = {},
    userRole = "client",
    bladeLength,
    allImages: navAllImages = [], // Rename to avoid conflict
    currentImage = null,
    damages = [],
    section = "",
  } = stateData;

  // DIAGNOSTIC: Log initial detections to trace bbox issues
  if (initialDetections.length > 0) {
    console.log("[DamageEditor] BBOX DEBUG: initialDetections received:", initialDetections.length, 
      "first bbox:", initialDetections[0]?.bbox, 
      "first id:", initialDetections[0]?.id);
  } else {
    console.log("[DamageEditor] BBOX DEBUG: NO initialDetections received. stateData keys:", Object.keys(stateData));
  }

  // Local state for allImages, initialized with navigation data
  const [allImages, setAllImages] = useState(navAllImages);

  // Update local state if navigation data changes drastically? 
  // Probably better to just init.
  useEffect(() => {
     if (navAllImages && navAllImages.length > 0) {
         setAllImages(prev => {
             // Only update if empty to avoid overwriting fetched data? 
             // Or always sync? Let's generic sync but avoid loop
             if (prev.length === 0) return navAllImages;
             return prev;
         });
     }
  }, [navAllImages]);

  // Check if user can edit (admin or technician)
  const canEdit = canEditByRole(userRole);

  // Cargar datos EXIF de la imagen actual (Moved UP)
  const currentImageId = stateData?.currentImage?.id || stateData?.imageId || null;
  const { exifData, loading: exifLoading } = useExifData(
    imageSrc,
    currentImageId
  );

  // Merge metadata sources
  const effectiveMetadata = {
      ...currentImage?.raw_metadata,
      ...currentImage?.metadata,
      ...exifData
  };

  const { project, turbine, getSectionLabel } = useEditorData({
    currentImage, navigationData, allImages, setAllImages,
  });

  // =========================================================================
  // 1. EXTRACCIÓN DINÁMICA DE METADATOS (NUEVO DRONE GPS + LEGACY)
  // =========================================================================

  const imageRef = useRef(null);
  const containerRef = useRef(null);

  const { centerRadiusMeters, calculateMetrics, getGlobalY, updateDamageMetrics } = useDamageMetrics({
    currentImage, effectiveMetadata, imageRef, setDamageInfo,
  });

  // Actualizar damageInfo con los datos iniciales
  useEffect(() => {
    if (initialDamageInfo && Object.keys(initialDamageInfo).length > 0) {
      // Preserve database values if they exist
      const displayInfo = {
        ...initialDamageInfo,
        // Ensure proper format for display
        severity: initialDamageInfo.severity?.startsWith("Cat ") 
          ? initialDamageInfo.severity 
          : initialDamageInfo.severity 
            ? `Cat ${initialDamageInfo.severity}` 
            : "-"
      };
      setDamageInfo(displayInfo);
    }
  }, [initialDamageInfo]);

  // Actualizar detecciones con los datos iniciales
  useEffect(() => {
    if (initialDetections && initialDetections.length > 0) {
      console.log("[DamageEditor] ========== DETECCIONES RECIBIDAS ==========");
      console.log("[DamageEditor] initialDetections:", initialDetections);
      
      const img = imageRef.current;
      
      // Enrich detections: normalize pixel bboxes + add metrics
      const enrichedDetections = initialDetections.map(d => {
          let bbox = d.bbox;
          
          // NORMALIZE: If bbox values > 1, convert pixel coords to normalized 0-1
          // This handles DB region stored as pixel coords
          if (bbox && img && (bbox[0] > 1 || bbox[1] > 1 || bbox[2] > 1 || bbox[3] > 1)) {
            console.log("[DamageEditor] Normalizing pixel bbox in useEffect:", bbox);
            bbox = [
              bbox[0] / img.naturalWidth,
              bbox[1] / img.naturalHeight,
              bbox[2] / img.naturalWidth,
              bbox[3] / img.naturalHeight,
            ];
          }
          
          const result = { ...d, bbox };
          
          // Add metrics: saved radio > initialDamageInfo radio > calculateMetrics
          if (result.radio || result.attributes?.radio) return result;
          
          if (initialDamageInfo?.radio) {
            return { 
              ...result, 
              radio: initialDamageInfo.radio,
              width: result.width || initialDamageInfo.width,
              length: result.length || initialDamageInfo.length,
              area: result.area || initialDamageInfo.area
            };
          }
          
          // Last resort: calculate from bbox (may be inaccurate if EXIF not loaded)
          const metrics = calculateMetrics(bbox);
          if (metrics) {
              return { ...result, ...metrics };
          }
          return result;
      });

      setDetections(enrichedDetections);
      
      // If we have a single detection (edit mode), set its metrics immediately
      if (initialDetections.length === 1 && !editingDetection) {
        const detection = enrichedDetections[0];
        // Prefer initialDamageInfo values (from DB via getDamageExtraData) over enriched/calculated
        const metrics = {
            radio: initialDamageInfo?.radio || detection.radio,
            width: initialDamageInfo?.width || detection.width,
            length: initialDamageInfo?.length || detection.length,
            area: initialDamageInfo?.area || detection.area,
        };
        
        if (metrics.radio) {
          const severityDisplay = detection.severity?.startsWith("Cat ") 
            ? detection.severity 
            : `Cat ${detection.severity || "3"}`;
            
          let initialDamageTypeMain = "";
          let initialDamageTypeSub = "";
          const detectionDamageType = detection.damage_type || detection.category || t("imageViewer.damage");
          if (detectionDamageType && detectionDamageType.includes(" - ")) {
            const parts = detectionDamageType.split(" - ");
            initialDamageTypeMain = parts[0];
            initialDamageTypeSub = parts[1];
          }

          setDamageInfo(prev => ({
            ...prev,
            damage_type: detectionDamageType,
            damage_type_main: initialDamageTypeMain,
            damage_type_sub: initialDamageTypeSub,
            severity: severityDisplay,
            ...metrics
          }));
        }
      }
    }
  }, [initialDetections, currentImage]); // Added currentImage dependency for calculateMetrics

  // Update damageInfo when editingDetection changes
  useEffect(() => {
    if (editingDetection) {
      // Prefer SAVED metrics from the detection/damage object (attributes or top-level)
      // Only fallback to recalculation for NEW detections without saved data
      const savedRadio = editingDetection.radio || editingDetection.attributes?.radio || editingDetection.attributes?.radius || null;
      const savedWidth = editingDetection.width || editingDetection.attributes?.width || null;
      const savedLength = editingDetection.length || editingDetection.attributes?.length || null;
      const savedArea = editingDetection.area || editingDetection.attributes?.area || null;

      let metrics;
      if (savedRadio) {
        // Use saved values — they were correct when the damage was created
        metrics = {
          radio: savedRadio,
          width: savedWidth || "-",
          length: savedLength || "-",
          area: savedArea || "-"
        };
      } else {
        // No saved radio = new detection, calculate from bbox
        metrics = calculateMetrics(editingDetection.bbox);
      }

      if (metrics) {
        const severityDisplay = editingDetection.severity?.startsWith("Cat ") 
          ? editingDetection.severity 
          : `Cat ${editingDetection.severity || "3"}`;
          
        let editingDamageTypeMain = "";
        let editingDamageTypeSub = "";
        const currentDamageType = editingDetection.damage_type || editingDetection.category || t("imageViewer.damage");
        if (currentDamageType && currentDamageType.includes(" - ")) {
          const parts = currentDamageType.split(" - ");
          editingDamageTypeMain = parts[0];
          editingDamageTypeSub = parts[1];
        }

        setDamageInfo(prev => ({
          ...prev,
          damage_type: currentDamageType,
          damage_type_main: editingDamageTypeMain,
          damage_type_sub: editingDamageTypeSub,
          severity: severityDisplay,
          ...metrics
        }));
      }
    }
  }, [editingDetection]);

  console.log("[DamageEditor] imageSrc:", imageSrc);
  console.log("[DamageEditor] initialDamageInfo:", initialDamageInfo);
  console.log("[DamageEditor] userRole:", userRole);
  console.log("[DamageEditor] currentImage:", currentImage);
  console.log("[DamageEditor] Calculated_GSD_mm_px:", currentImage?.raw_metadata?.Calculated_GSD_mm_px);
  console.log("[DamageEditor] Calculated_Blade_Radius_mm:", currentImage?.raw_metadata?.Calculated_Blade_Radius_mm);
  console.log("[DamageEditor] Calculated_Blade_Radius_m (converted):", (currentImage?.raw_metadata?.Calculated_Blade_Radius_mm || 0) / 1000);
  console.log("[DamageEditor] rotation:", currentImage?.metadata?.rotation);

  // Si tras esperar no llegó ningún dato, volver al inicio (nunca cuando ya hay estado guardado)
  useEffect(() => {
    if (imageSrc) return undefined;
    const timer = setTimeout(() => {
      let hasSaved = false;
      try {
        const saved = JSON.parse(sessionStorage.getItem("damageEditorState") || "null");
        hasSaved = Boolean(saved && saved.imageSrc);
        if (hasSaved) setReceivedState(saved);
      } catch {
        hasSaved = false;
      }
      if (!hasSaved) navigate("/", { replace: true });
    }, 8000);

    return () => clearTimeout(timer);
  }, [imageSrc, navigate]);

  useEditorBridge({ setReceivedState });

  // Regresar a la página anterior
  const handleBack = () => {
    navigate(-1);
  };

  // =========================================================================
  // DAÑOS DE LA PALA, SELECCIÓN Y NAVEGACIÓN ENTRE DAÑOS
  // (no interviene en la matemática de la regla ni en el cálculo de métricas)
  // =========================================================================
  const [selectedDamageId, setSelectedDamageId] = useState(null);
  const [damageOverrides, setDamageOverrides] = useState({}); // cambios guardados en esta sesión
  const [removedDamageIds, setRemovedDamageIds] = useState(() => new Set());
  const [addedDamages, setAddedDamages] = useState([]); // daños creados en esta sesión
  const [listFilter, setListFilter] = useState("all");

  const bladeName = navigationData?.blade || initialDamageInfo?.blade || "";

  // Lista de daños vigente: la recibida + lo editado, creado o eliminado aquí
  const allDamages = useMemo(() => {
    const base = (damages || [])
      .filter((d) => !removedDamageIds.has(String(d.id)))
      .map((d) => (damageOverrides[d.id] ? { ...d, ...damageOverrides[d.id] } : d));
    const extra = addedDamages.filter((d) => !removedDamageIds.has(String(d.id)));
    return [...base, ...extra];
  }, [damages, damageOverrides, removedDamageIds, addedDamages]);

  const bladeDamages = useMemo(
    () => allDamages.filter((d) => !bladeName || d.blade === bladeName),
    [allDamages, bladeName]
  );

  // Daño -> detección dibujable en el lienzo (null si no tiene región utilizable)
  const damageToDetection = (d) => {
    let bbox = getDamageBbox(d);
    if (!bbox || bbox.some((v) => !Number.isFinite(v))) return null;
    if (bbox.some((v) => v > 1)) {
      const dims = d.region?.image_dims;
      if (!dims?.width || !dims?.height) return null;
      bbox = [bbox[0] / dims.width, bbox[1] / dims.height, bbox[2] / dims.width, bbox[3] / dims.height];
    }
    const m = getDamageMetrics(d);
    const a = d.attributes || {};
    return {
      id: d.id,
      bbox,
      severity: normSev(d.severity),
      confidence: a.confidence ?? 0.9,
      category: normSev(d.severity),
      radio: m.radio,
      width: m.width,
      length: m.length,
      area: m.area,
      damage_type: m.damage_type,
      attributes: a,
      capture_id: d.capture_id,
    };
  };

  // Mostrar en el panel la información de una detección sin entrar en edición
  const showDamageInfo = (det) => {
    const m = getDamageMetrics(det);
    const dt = det.damage_type || damageTypeRaw(det);
    const parts = dt.includes(" - ") ? dt.split(" - ") : [];
    setDamageInfo({
      damage_type: dt,
      damage_type_main: parts[0] || "",
      damage_type_sub: parts[1] || "",
      severity: normSev(det.severity),
      radio: det.radio ?? m.radio ?? "-",
      length: det.length ?? m.length ?? "-",
      width: det.width ?? m.width ?? "-",
      area: det.area ?? m.area ?? "-",
      description: det.description || "-",
    });
  };

  // Seleccionar un daño que ya está en la imagen abierta
  const selectDamageOnImage = (id) => {
    const det = detections.find((d) => String(d.id) === String(id));
    if (!det) return false;
    setSelectedDamageId(det.id);
    if (canEdit) setEditingDetection(det); // el efecto de edición carga su información
    else showDamageInfo(det);
    return true;
  };

  // Ir a un daño: misma imagen -> se selecciona; otra imagen -> se carga con todos sus daños
  const goToDamage = (damageId) => {
    const target = allDamages.find((d) => String(d.id) === String(damageId));
    if (!target) return;

    if (target.capture_id && target.capture_id === currentImage?.id) {
      selectDamageOnImage(target.id);
      return;
    }

    const image = (allImages || []).find((i) => i.id === target.capture_id);
    const url =
      image?.publicUrl ||
      (image?.storage_path
        ? getImageUrl(image.storage_path)
        : null);
    if (!image || !url) {
      alert(t("messages.imageNotFound"));
      return;
    }

    const m = getDamageMetrics(target);
    const bb = getDamageBbox(target);
    const onImage = allDamages
      .filter((d) => d.capture_id === target.capture_id)
      .map(damageToDetection)
      .filter(Boolean);
    const fileName = image.name || (image.storage_path || "").split("/").pop();

    const newState = {
      ...stateData,
      imageSrc: url,
      imageAlt: fileName,
      currentImage: { ...image, name: fileName, path: image.storage_path || image.path },
      section: target.section || section,
      detections: onImage,
      damageInfo: {
        damageId: target.id,
        section: target.section || section,
        blade: bladeName,
        severity: normSev(target.severity),
        damage_type: damageTypeRaw(target),
        radio: m.radio,
        length: m.length,
        width: m.width,
        area: m.area,
        bbox_xywh_norm: bb,
      },
    };
    try {
      sessionStorage.setItem("damageEditorState", JSON.stringify(newState));
    } catch (e) {
      console.warn("[DamageEditor] No se pudo guardar el estado en sessionStorage", e);
    }
    setReceivedState(newState);
    setEditingDetection(null);
    setIsCreating(false);
    setCompareImage(null);
    setPolygons([]);
    setCurrentPolygon([]);
    setDamageInfo({});
    setSelectedDamageId(target.id);
  };

  // Daño con el que se abrió el editor
  useEffect(() => {
    if (initialDamageInfo?.damageId) setSelectedDamageId(initialDamageInfo.damageId);
  }, [initialDamageInfo?.damageId]);

  // Dibujar también los demás daños de la imagen abierta (el visor solo manda uno)
  useEffect(() => {
    if (!currentImage?.id) return;
    const extra = allDamages
      .filter((d) => d.capture_id === currentImage.id)
      .map(damageToDetection)
      .filter(Boolean);
    if (extra.length === 0) return;
    setDetections((prev) => {
      const ids = new Set(prev.map((p) => String(p.id)));
      const missing = extra.filter((e) => !ids.has(String(e.id)));
      return missing.length ? [...prev, ...missing] : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentImage?.id, allDamages]);



  const {
    handleZoom, resetImage, getPolygonArea, getLocalCoords, handleMouseDown, handleMouseMove, handleMouseUp, handleTouchStart, handleTouchMove, handleTouchEnd, handleImageLoad,
  } = useCanvasInteraction({
    zoom, pan, editingDetection, detections,
    isCreating, toolMode, polygons, currentPolygon,
    draggedPointInfo, isDragging, dragStart, resizingBox,
    initialBoxState, brightness, contrast, negativeMode,
    currentImage, canEdit, imageRef, containerRef,
    calculateMetrics, updateDamageMetrics, showDamageInfo, setZoom,
    setPan, setBrightness, setContrast, setEditingDetection,
    setDetections, setIsCreating, setPolygons, setCurrentPolygon,
    setResizingBox, setInitialBoxState, setIsDragging, setSelectedDamageId,
    setDragStart, setCursorPos, setDraggedPointInfo,
  });

  // Función para aplicar filtros de imagen
  const applyImageFilters = () => {
    if (imageRef.current) {
      const filters = [
        `brightness(${brightness}%)`,
        `contrast(${contrast}%)`,
        negativeMode ? "invert(1)" : "",
      ]
        .filter(Boolean)
        .join(" ");
      imageRef.current.style.filter = filters;
    }
  };

  const { handleDeleteDetection, handleSaveDetection } = useDetectionActions({
    t, damageInfo, stateData, currentImage,
    section, bladeName, allDamages, calculateMetrics,
    setDownloading, setDetections, setRemovedDamageIds, setSelectedDamageId,
    setEditingDetection, setDamageInfo, setDamageOverrides, setAddedDamages,
  });

  // Función para actualizar damageInfo dinámicamente
  const updateDamageInfo = (selectedDamageId) => {
    const selectedDamage = damages.find(
      (damage) => damage.id === selectedDamageId
    );
    if (selectedDamage) {
      let calculatedArea = "-";
      const l = parseFloat(selectedDamage.length);
      const w = parseFloat(selectedDamage.width);
      // Calcular area si es posible (aproximación rectangular por defecto)
      if (!isNaN(l) && !isNaN(w)) {
          calculatedArea = (l * w).toFixed(2);
      }
      
      const selDamageType = selectedDamage.damage_type || "-";
      let selDamageTypeMain = "";
      let selDamageTypeSub = "";
      if (selDamageType && selDamageType.includes(" - ")) {
        const parts = selDamageType.split(" - ");
        selDamageTypeMain = parts[0];
        selDamageTypeSub = parts[1];
      }

      setDamageInfo({
        damage_type: selDamageType,
        damage_type_main: selDamageTypeMain,
        damage_type_sub: selDamageTypeSub,
        severity: selectedDamage.severity || "-",
        radio: selectedDamage.radio || selectedDamage.attributes?.radio || selectedDamage.attributes?.radius || "-",
        length: selectedDamage.length || selectedDamage.attributes?.length || "-",
        width: selectedDamage.width || selectedDamage.attributes?.width || "-",
        area: calculatedArea,
        description: selectedDamage.description || "-",
      });
    }
  };


  // REMOVED: This useEffect was conflicting with the editingDetection metrics calculation
  // Ejemplo de uso: Llamar a updateDamageInfo cuando se seleccione un daño
  // useEffect(() => {
  //   if (damages.length > 0) {
  //     updateDamageInfo(damages[0].id);
  //   }
  // }, [damages]);


  // Comparison View Handlers
  const handleCompareWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setCompareZoom((prev) => Math.max(0.1, Math.min(10, prev + delta)));
  };

  const handleCompareMouseDown = (e) => {
    e.preventDefault();
    setIsDraggingCompare(true);
    setDragStartCompare({ x: e.clientX - comparePan.x, y: e.clientY - comparePan.y });
  };

  const handleCompareMouseMove = (e) => {
    if (!isDraggingCompare) return;
    e.preventDefault();
    setComparePan({ 
        x: e.clientX - dragStartCompare.x, 
        y: e.clientY - dragStartCompare.y 
    });
  };

  const handleCompareMouseUp = () => {
    setIsDraggingCompare(false);
  };

  const resetCompareView = () => {
      setCompareZoom(1);
      setComparePan({ x: 0, y: 0 });
  };

  return (
    <div className="flex h-[calc(100dvh-4.1rem)] flex-col bg-background text-ink">
      {/* Meta tag para dispositivos táctiles */}
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
      />
      {/* Cabecera */}
      <div className="shrink-0 border-b border-line-subtle bg-surface-panel">
        <EditorHeader
          t={t}
          editingDetection={editingDetection}
          damageInfo={damageInfo}
          detections={detections}
          downloading={downloading}
          setDownloading={setDownloading}
          showDownloadMenu={showDownloadMenu}
          setShowDownloadMenu={setShowDownloadMenu}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          imageSrc={imageSrc}
          imageAlt={imageAlt}
          navigationData={navigationData}
          currentImage={currentImage}
          section={section}
          project={project}
          getSectionLabel={getSectionLabel}
        />

        {/* Barra de herramientas (se desplaza en horizontal en pantallas angostas) */}
        <EditorToolbar
          t={t}
          zoom={zoom}
          editingDetection={editingDetection}
          setEditingDetection={setEditingDetection}
          brightness={brightness}
          setBrightness={setBrightness}
          contrast={contrast}
          setContrast={setContrast}
          detections={detections}
          negativeMode={negativeMode}
          setNegativeMode={setNegativeMode}
          isCreating={isCreating}
          setIsCreating={setIsCreating}
          showMeasurementRulers={showMeasurementRulers}
          setShowMeasurementRulers={setShowMeasurementRulers}
          toolMode={toolMode}
          setToolMode={setToolMode}
          setPolygons={setPolygons}
          fitScale={fitScale}
          canEdit={canEdit}
          selectedDamageId={selectedDamageId}
          handleZoom={handleZoom}
          resetImage={resetImage}
          handleDeleteDetection={handleDeleteDetection}
          handleSaveDetection={handleSaveDetection}
        />
      </div>

      {/* Contenido principal - 3 columnas. min-h-[20rem]: el lienzo nunca baja de ~320px de alto
          (si la pantalla es aún más baja, la página hace scroll en vez de aplastar el lienzo) */}
      <div className="flex min-h-[20rem] flex-1 overflow-hidden">
        {/* Columna 1: Visor de imagen (Split View Enabled) */}
        <div className="flex-1 relative overflow-hidden bg-surface-base flex">
          
          {/* Main Viewer */}
          <ImageStage
            t={t}
            zoom={zoom}
            pan={pan}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
            showLayers={showLayers}
            editingDetection={editingDetection}
            detections={detections}
            showMeasurementRulers={showMeasurementRulers}
            toolMode={toolMode}
            cursorPos={cursorPos}
            polygons={polygons}
            currentPolygon={currentPolygon}
            draggedPointInfo={draggedPointInfo}
            setDraggedPointInfo={setDraggedPointInfo}
            resizingBox={resizingBox}
            setResizingBox={setResizingBox}
            setInitialBoxState={setInitialBoxState}
            compareImage={compareImage}
            imageSrc={imageSrc}
            imageAlt={imageAlt}
            currentImage={currentImage}
            section={section}
            getSectionLabel={getSectionLabel}
            imageRef={imageRef}
            containerRef={containerRef}
            centerRadiusMeters={centerRadiusMeters}
            getGlobalY={getGlobalY}
            selectedDamageId={selectedDamageId}
            getPolygonArea={getPolygonArea}
            getLocalCoords={getLocalCoords}
            handleMouseDown={handleMouseDown}
            handleMouseMove={handleMouseMove}
            handleMouseUp={handleMouseUp}
            handleTouchStart={handleTouchStart}
            handleTouchMove={handleTouchMove}
            handleTouchEnd={handleTouchEnd}
            handleImageLoad={handleImageLoad}
          />

          {/* Secondary Viewer (Split View) */}
          {compareImage && (
              <ComparePanel
                t={t}
                compareImage={compareImage}
                setCompareImage={setCompareImage}
                compareZoom={compareZoom}
                setCompareZoom={setCompareZoom}
                comparePan={comparePan}
                isDraggingCompare={isDraggingCompare}
                getSectionLabel={getSectionLabel}
                handleCompareWheel={handleCompareWheel}
                handleCompareMouseDown={handleCompareMouseDown}
                handleCompareMouseMove={handleCompareMouseMove}
                handleCompareMouseUp={handleCompareMouseUp}
                resetCompareView={resetCompareView}
              />
          )}

        </div>

        {/* Sidebar Toggle Button (Floating on the right edge of the viewer or left edge of sidebar) */}
        <div 
          className={`absolute top-1/2 z-30 h-full w-8 -translate-y-1/2 transform items-center justify-end pointer-events-none ${
            isSidebarOpen ? "hidden lg:flex lg:right-[624px]" : "flex right-0"
          }`} // 240px (col2) + 384px (col3) = 624px
          // Note: positioning might need adjustment based on strict width. 
          // Better: Put it inside Col 1 but absolute right.
        >
           {/* Allow interactions only on the button */}
           <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              onMouseEnter={() => setSidebarHover(true)}
              onMouseLeave={() => setSidebarHover(false)}
              className={`
                 pointer-events-auto
                 h-16 w-6 bg-surface-panel border-y border-l border-line-medium rounded-l-lg 
                 flex items-center justify-center text-ink-muted hover:text-ink hover:bg-line-medium
                 shadow-lg transition-all duration-300
                 ${isSidebarOpen ? "" : "opacity-50 hover:opacity-100"}
              `}
              title={isSidebarOpen ? t("common.hideSidebar") : t("common.showSidebar")}
           >
              {isSidebarOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
           </button>
        </div>

        {/* Columna 2: Imagen del modelo de pala (Conditionally rendered) */}
        <BladeViewerPanel
          editingDetection={editingDetection}
          detections={detections}
          isSidebarOpen={isSidebarOpen}
          initialDamageInfo={initialDamageInfo}
          bladeLength={bladeLength}
          project={project}
          turbine={turbine}
          selectedDamageId={selectedDamageId}
          bladeDamages={bladeDamages}
          goToDamage={goToDamage}
        />

        {/* Columna 3: Otras secciones e Información del daño (Conditionally rendered) */}
        <div 
            className={`flex flex-col overflow-x-hidden overflow-y-auto overscroll-contain border-l border-line-subtle bg-surface-panel transition-all duration-300 ease-in-out ${isSidebarOpen ? "fixed inset-y-0 right-0 z-50 h-dvh w-[min(100vw,24rem)] lg:static lg:z-auto lg:h-auto lg:w-96" : "w-0 border-none"}`}
             style={{ opacity: isSidebarOpen ? 1 : 0 }}
        >
          {isSidebarOpen && (
           <>
            <div className="flex flex-shrink-0 items-center justify-between border-b border-line-subtle px-3 py-2.5 lg:hidden">
              <span className={OVERLINE}>{navigationData.blade || "Pala"} · {getSectionLabel(section)}</span>
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                aria-label={t("common.hideSidebar")}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-line-subtle text-ink hover:text-ink ${FOCUS}`}
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
            {/* Secciones de la pala: las cuatro */}
            <SectionsPanel
              t={t}
              setIsSidebarOpen={setIsSidebarOpen}
              compareImage={compareImage}
              setCompareImage={setCompareImage}
              stateData={stateData}
              section={section}
              allImages={allImages}
              getSectionLabel={getSectionLabel}
              centerRadiusMeters={centerRadiusMeters}
              bladeDamages={bladeDamages}
              SECTION_ORDER={SECTION_ORDER}
            />

            {/* Información del daño (editable) */}
            <DamageInfoPanel
              t={t}
              i18n={i18n}
              editingDetection={editingDetection}
              setEditingDetection={setEditingDetection}
              damageInfo={damageInfo}
              setDetections={setDetections}
            />

            {/* Detecciones: todos los daños de la pala */}
            <DetectionsPanel
              t={t}
              i18n={i18n}
              detections={detections}
              setIsSidebarOpen={setIsSidebarOpen}
              currentImage={currentImage}
              getSectionLabel={getSectionLabel}
              selectedDamageId={selectedDamageId}
              listFilter={listFilter}
              setListFilter={setListFilter}
              bladeName={bladeName}
              bladeDamages={bladeDamages}
              goToDamage={goToDamage}
              SECTION_ORDER={SECTION_ORDER}
            />
           </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DamageEditorPage;
