import { tx, dateLocale } from "@/i18n/tx";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { getImageUrl, primeImageUrls, primeLongLivedUrls, getLongLivedUrl } from "@/lib/storageUrls";
import { motion } from "framer-motion";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Download,
  FileText,
  RefreshCw,
  Wand2,
  Image as ImageIcon,
  Wind,
  Calendar,
  Settings,
  Loader,
  AlertCircle,
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Pencil,
  Trash2,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  deleteFinding,
  updateFinding,
  updateFindingReturning,
  insertFinding,
  insertFindingReturning,
} from "./shared/data";
import { updateTurbine, getProjectById, getTurbineByProjectAndName } from "./shared/data";
import {
  getCaptureByStoragePath,
  listSectionCapturesWithBlade,
  listCapturesForBlades,
  listCaptureFilesForBlades,
  listBladesByTurbine,
  listBladesWithLength,
  listFindingsWithCapture,
} from "./shared/data";
import OptimizedImage from "@/components/OptimizedImage";
import ReconstructionPanel from "@/components/reconstruction/ReconstructionPanel";
import EditableImageViewer from "@/components/EditableImageViewer";
import TurbineIdImageViewer from "@/components/TurbineIdImageViewer";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n/i18n";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import HeightNavigation from "../components/HeightNavigation";
import LanguagePdfDialog from "@/components/LanguagePdfDialog";
import ImageCarousel from "@/components/reportViewer/ImageCarousel";
import {
  BladeSummaryCard,
  Callout,
  OriginTag,
  SeverityBadge,
  Metric,
  SEV,
  sevNumber,
  FIELD,
  TAB_CLASS,
  ICON_BTN,
  PANEL,
  OVERLINE,
  FOCUS,
  INPUT,
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_DANGER,
  FADE,
  BladeSegment,
  DamageBBoxOverlay,
} from "@/components/reportViewer/viewerKit";
// Importaciones de traducción (ESM estáticas)
import TranslatedText from "@/components/TranslatedText";
import { warmUpTranslationService } from "@/services/libreTranslationService";
import {
  translateWithCache,
  cleanCorruptedText,
  cleanCorruptedCache,
  translateAdditionalNotes,
} from "../utils/translationUtils";
import {
  isTranslationEnabled,
  getTargetLanguage,
} from "../config/translationConfig";

import { DAMAGE_TYPES, getLocalizedDamageString } from "./shared/damage";
import {
  severityToColor,
  getSeverityColorForPDF,
  hexToRgb,
  sortDamagesBySeverity,
  getDamageBboxData,
  getDamageExtraData,
} from "./shared/damage";
import { getThumbnailUrl, loadImageElement, addBboxToImage, cropImageFromBbox } from "./shared/image";
import { drawBladeSvgWithDot } from "./reportViewer/pdf/bladeSvg";
import { createReportPdf } from "./reportViewer/pdf/createReportPdf";
import { useReportData } from "./reportViewer/hooks/useReportData";
import { useDamageActions } from "./reportViewer/hooks/useDamageActions";
import { useImageBridge } from "./reportViewer/hooks/useImageBridge";
import { useStitched } from "./reportViewer/hooks/useStitched";
import { ReportHeader } from "./reportViewer/components/header/ReportHeader";
import { ProjectInfoPanel } from "./reportViewer/components/header/ProjectInfoPanel";
import { TurbineIdPanel } from "./reportViewer/components/header/TurbineIdPanel";
import { ReportTabsBar } from "./reportViewer/components/header/ReportTabsBar";
import { ExportSection } from "./reportViewer/components/overview/ExportSection";
import { BladeStatusSection } from "./reportViewer/components/overview/BladeStatusSection";
import { BladeDetailSection } from "./reportViewer/components/overview/BladeDetailSection";
import { ImagesTab } from "./reportViewer/components/tabs/ImagesTab";
import { StitchedTab } from "./reportViewer/components/tabs/StitchedTab";
import { DeleteDamageDialog } from "./reportViewer/components/dialogs/DeleteDamageDialog";
import { DamageListSection } from "./reportViewer/components/overview/DamageListSection";
import { DamageThumbnail } from "./reportViewer/components/DamageThumbnail";
import { renderBoundingBox } from "./reportViewer/utils/renderBoundingBox";
import { getBladeDisplayName, getSuggestedAction } from "./reportViewer/utils/labels";
import { bladeSections, EMPTY_IMAGES, bladeTabs } from "./reportViewer/utils/constants";
import { getImageFullUrl, getImageThumbUrl } from "./reportViewer/utils/urls";

export { DAMAGE_TRANSLATIONS_EN, getLocalizedDamageString } from "./shared/damage";

// === UTILIDADES DE NAVEGACIÓN V2 ===
const getImageNavigationData = async (captureId) => {
  try {
    // V2: Navigation data might be in 'calculated_height_m' directly in captures
    // or still in a separate table if tracking complex nav stats.
    // For now, let's assume we read from captures if available, or just skip if not ready.
    // If 'image_navigation' table still exists and is linked to captures (was linked to inspection_files),
    // we need to check the schema. Assuming we rely on captures for now for basic data.
    return null;
  } catch (error) {
    return null;
  }
};

const getAdjacentSections = (currentSection) => {
  // Normalize checking? Or just check inclusions
  const s = (currentSection || "").toUpperCase();
  const adjacentMap = {
    TE: ["PS", "LE"],
    PS: ["TE", "SS"],
    LE: ["TE", "SS"],
    SS: ["PS", "LE"],
  };
  // If we have raw names like "LeadingEdge", we might need to map them first?
  // Let's stick to standard map if possible, or add raw keys.
  // For now, keeping logic simple.
  if (s.includes("LEADING")) return ["TE", "SS"];
  if (s.includes("TRAILING")) return ["PS", "LE"];
  if (s.includes("PRESSURE")) return ["TE", "SS"];
  if (s.includes("SUCTION")) return ["PS", "LE"];

  return adjacentMap[s] || [];
};

const getCaptureIdByPath = async (storagePath) => {
  try {
    const { data, error } = await getCaptureByStoragePath(storagePath);

    if (error) return null;
    return data?.id || null;
  } catch (error) {
    return null;
  }
};

const findClosestImageByHeight = async (
  projectId,
  turbineId,
  currentHeight,
  targetSection,
) => {
  // V2 implementation using 'captures'
  try {
    console.log(
      `[Navigation] Buscando imagen en sección ${targetSection} con altura ${currentHeight}m`,
    );

    // We need to join blades to filter by turbine_id
    const { data, error } = await listSectionCapturesWithBlade(turbineId, targetSection); // using new column

    if (error) {
      console.error("[Navigation] Error en consulta:", error);
      return null;
    }

    if (!data || data.length === 0) return null;

    let closest = data[0];
    let minDiff = Math.abs((data[0].calculated_height_m || 0) - currentHeight);

    for (const img of data) {
      const imgHeight = img.calculated_height_m || 0;
      const diff = Math.abs(imgHeight - currentHeight);
      if (diff < minDiff) {
        minDiff = diff;
        closest = img;
      }
    }
    return closest;
  } catch (error) {
    return null;
  }
};

// Función auxiliar para cargar imágenes de daños de una sección específica
const loadSectionDamageImages = async (
  processedBasePath,
  pala,
  section,
  projectName,
  windFarm,
  wtg,
) => {
  const sectionPath = `${processedBasePath}/${pala}/${section}`;
  const sectionImageMap = {};

  try {
    console.log(`[ReportViewer] Buscando archivos en: ${sectionPath}`);
    const { data: sectionFiles, error } = await supabase.storage
      .from("images")
      .list(sectionPath, { limit: 1000 });

    if (error) {
      console.log(
        `[ReportViewer] Error listando archivos en ${sectionPath}:`,
        error,
      );
      return sectionImageMap;
    }

    if (!sectionFiles || sectionFiles.length === 0) {
      console.log(
        `[ReportViewer] No se encontraron archivos en ${sectionPath}`,
      );
      return sectionImageMap;
    }

    console.log(
      `[ReportViewer] Encontrados ${sectionFiles.length} archivos en ${sectionPath}`,
    );
    const jsonFiles = sectionFiles.filter(
      (f) => f.name && f.name.endsWith(".json"),
    );
    console.log(
      `[ReportViewer] Archivos JSON encontrados: ${jsonFiles.length}`,
    );

    if (jsonFiles.length > 0) {
      const jsonPromises = jsonFiles.slice(0, 10).map(async (jsonFile) => {
        try {
          const jsonPath = `${sectionPath}/${jsonFile.name}`;
          const { data: fileData } = await supabase.storage
            .from("images")
            .download(jsonPath);

          if (fileData) {
            const text = await fileData.text();
            const damageInfo = JSON.parse(text);

            const originalImageName = jsonFile.name.replace(".json", "");
            const damageKey = `${originalImageName}_${section}_${pala}`;

            return {
              [damageKey]: {
                ...damageInfo,
                originalPath:
                  damageInfo.file_info?.original_path ||
                  `${projectName}/${windFarm}/${wtg}/${pala}/${section}/${originalImageName}`,
                processedPath: jsonPath,
                section: section,
                blade: pala,
                imageName: originalImageName,
                detections: damageInfo.detections || [], // Asegurar que las detecciones estén disponibles
              },
            };
          }
        } catch (parseError) {
          console.warn(
            `[ReportViewer] Error procesando ${jsonFile.name}:`,
            parseError,
          );
          return null;
        }
      });

      const jsonResults = await Promise.allSettled(jsonPromises);
      jsonResults.forEach((result) => {
        if (result.status === "fulfilled" && result.value) {
          Object.assign(sectionImageMap, result.value);
        }
      });
    }
  } catch (sectionError) {
    if (!sectionError.message.includes("not found")) {
      console.warn(
        `[ReportViewer] Error en sección ${pala}/${section}:`,
        sectionError,
      );
    }
  }

  return sectionImageMap;
};

const compressImage = (file, maxWidth = 1200, quality = 0.8) => {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      let { width, height } = img;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(resolve, "image/jpeg", quality);
    };

    img.src = URL.createObjectURL(file);
  });
};

const createImageThumbnail = (src, maxSize = 300) => {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      const size = Math.min(img.width, img.height);
      const scale = maxSize / size;

      canvas.width = maxSize;
      canvas.height = maxSize;

      const offsetX = (img.width - size) / 2;
      const offsetY = (img.height - size) / 2;

      ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, maxSize, maxSize);

      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };

    img.crossOrigin = "anonymous";
    img.src = src;
  });
};

// Función para obtener clases CSS según severidad
const getSeverityClasses = (severity) => {
  if (!severity) return "bg-sev-3 text-surface-base border-sev-3";
  const cat = parseInt(String(severity).replace(/[^0-9]/g, "")) || 3;
  switch (cat) {
    case 1:
      return "bg-sev-1 text-surface-base border-sev-1";
    case 2:
      return "bg-sev-2 text-surface-base border-sev-2";
    case 3:
      return "bg-sev-3 text-surface-base border-sev-3";
    case 4:
      return "bg-sev-4 text-surface-base border-sev-4";
    case 5:
      return "bg-sev-5 text-surface-base border-sev-5";
    default:
      return "bg-sev-3 text-surface-base border-sev-3";
  }
};

const sortByNumericName = (a, b) => {
  const na = (a.name.match(/(\d+)/g) || ["0"]).map(Number)[0];
  const nb = (b.name.match(/(\d+)/g) || ["0"]).map(Number)[0];
  if (na !== nb) return na - nb;
  return a.name.localeCompare(b.name);
};

const sortImagesBySection = (images, section) => {
  const sorted = images.sort(sortByNumericName);

  if (section === "PS" || section === "SS") {
    return sorted.reverse();
  }

  return sorted;
};

export default function ReportViewerPage({ role }) {
  const navigate = useNavigate();
  const { projectId, turbineName } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, i18n } = useTranslation(["common", "reports"]);

  // Despierta el Space de traducción al abrir el visor (no espera respuesta)
  useEffect(() => {
    warmUpTranslationService();
  }, []);
  const {
    isClient: isClientFn,
    isAdmin: isAdminFn,
    hasPermission,
    role: userRole,
  } = useRolePermissions();
  const isClient = isClientFn();
  const isAdmin = isAdminFn();

  // Debug log para verificar roles
  useEffect(() => {
  }, [userRole, isClient, isAdmin]);

  const [activeTab, setActiveTab] = useState("overview");
  const [selectedBlade, setSelectedBlade] = useState("Blade A");
  const [imageSection, setImageSection] = useState("TE"); // sección mostrada en el carrusel

  const {
    loading,
    project,
    turbine,
    sectionAliases,
    imagesBySection,
    allTurbineImages,
    imagesLoaded,
    damages,
    damageImages,
    isRefreshing,
    turbineIdImage,
    setProject,
    setTurbine,
    setSectionAliases,
    setImagesBySection,
    setAllTurbineImages,
    setDamages,
    setDamageImages,
    loadData,
    loadDamageImages,
    handleManualRefresh,
    loadAllBladesImages,
  } = useReportData({ projectId, turbineName, isClient, selectedBlade, t });

  const [savingAlias, setSavingAlias] = useState(false);
  // key: original section (TE/PS/LE/SS) → value: displayed section
  // e.g. { "TE": "SS" } means captures stored as TE will show as SS in the UI

  // Helper: get display label for a stored section key
  const getSectionLabel = (sectionKey) => {
    if (!sectionKey) return sectionKey;
    return sectionAliases[sectionKey] || sectionKey;
  };

  // Save an alias to Supabase (turbines.coordinates._section_aliases)
  const updateSectionAlias = async (originalSection, newDisplay) => {
    if (!turbine?.id) return;
    setSavingAlias(true);
    try {
      const updated = { ...sectionAliases };
      if (newDisplay === originalSection) {
        delete updated[originalSection]; // remove alias when same as original
      } else {
        updated[originalSection] = newDisplay;
      }

      // Merge into existing coordinates JSONB, preserving other coordinate data
      let existingCoords = {};
      if (turbine.coordinates && typeof turbine.coordinates === "object") {
        existingCoords = { ...turbine.coordinates };
      } else if (
        turbine.coordinates &&
        typeof turbine.coordinates === "string"
      ) {
        const rawStr = turbine.coordinates.trim();
        if (rawStr.startsWith("{")) {
          try {
            existingCoords = JSON.parse(rawStr);
          } catch (e) {
            existingCoords = {};
          }
        } else {
          // Plain coordinate string (e.g. "40.123456, -3.456789") — preserve under _raw
          existingCoords = { _raw: rawStr };
        }
      }
      const newCoords = { ...existingCoords, _section_aliases: updated };

      const { error } = await updateTurbine(turbine.id, { coordinates: newCoords });

      if (error) throw error;

      // Update local state immediately so UI reflects change
      setSectionAliases(updated);
      setTurbine((prev) => ({ ...prev, coordinates: newCoords }));

      toast({
        title:
          newDisplay === originalSection
            ? tx("Sección {{originalSection}} restaurada", { originalSection })
            : tx("Sección {{originalSection}} → {{newDisplay}} guardada", { originalSection, newDisplay }),
        description: tx("Visible para todos los usuarios."),
      });
    } catch (err) {
      console.error("[SectionAlias] Error saving alias:", err);
      toast({
        title: tx("Error al guardar"),
        description: tx("No se pudo actualizar la sección."),
        variant: "destructive",
      });
    } finally {
      setSavingAlias(false);
    }
  };

  // Helper: format coordinates for display (strips internal _section_aliases key)
  const getCoordinatesDisplay = (coords) => {
    if (coords === null || coords === undefined || coords === "") return null;

    const fmt = (lat, lon) => `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    // Primer valor numérico válido entre varias llaves posibles (admite 0 y números en texto)
    const pick = (o, keys) => {
      for (const k of keys) {
        const v = o?.[k];
        if (v !== undefined && v !== null && String(v).trim() !== "" && Number.isFinite(Number(v))) {
          return Number(v);
        }
      }
      return null;
    };

    let value = coords;
    if (typeof value === "string") {
      const s = value.trim();
      if (!s.startsWith("{") && !s.startsWith("[")) return s || null; // "40.123, -3.456"
      try {
        value = JSON.parse(s);
      } catch (e) {
        return s;
      }
    }

    // Arreglo [lat, lon]
    if (Array.isArray(value)) {
      return value.length ? value.join(", ") : null;
    }

    if (typeof value === "object") {
      const { _section_aliases, _raw, ...rest } = value;
      // GeoJSON Point: { type: "Point", coordinates: [lon, lat] }
      if (Array.isArray(rest.coordinates) && rest.coordinates.length >= 2) {
        const lon = Number(rest.coordinates[0]);
        const lat = Number(rest.coordinates[1]);
        if (Number.isFinite(lat) && Number.isFinite(lon)) return fmt(lat, lon);
      }
      const lat = pick(rest, ["latitude", "lat", "Latitude", "LAT", "gps_latitude"]);
      const lon = pick(rest, ["longitude", "lng", "lon", "long", "Longitude", "LON", "gps_longitude"]);
      if (lat !== null && lon !== null) return fmt(lat, lon);
      if (typeof _raw === "string" && _raw.trim()) return _raw;
      const keys = Object.keys(rest);
      return keys.length === 0 ? null : JSON.stringify(rest);
    }
    return String(value);
  };

  const [loadingImages, setLoadingImages] = useState(false);
  const [loadedImageBatches, setLoadedImageBatches] = useState(new Set());
  const [visibleImages, setVisibleImages] = useState(20);

  const loadMoreImages = () => {
    setVisibleImages((prev) => prev + 20);
  };

  const [loadingDamages, setLoadingDamages] = useState(false);
  const [severityFilter, setSeverityFilter] = useState("desc"); // 'all', 'desc', 'asc'
  const [selectedSeverity, setSelectedSeverity] = useState(null); // Filtro de severidad específica

  // === Selección manual de daños para el PDF ===
  const [selectedDamages, setSelectedDamages] = useState(new Set());

  const toggleDamageSelection = (damageId) => {
    setSelectedDamages((prev) => {
      const next = new Set(prev);
      if (next.has(damageId)) {
        next.delete(damageId);
      } else {
        next.add(damageId);
      }
      return next;
    });
  };

  const selectAllBladeDamages = (bladeName) => {
    setSelectedDamages((prev) => {
      const next = new Set(prev);
      damages
        .filter((d) => d.blade === bladeName)
        .forEach((d) => next.add(d.id));
      return next;
    });
  };

  const clearBladeDamageSelection = (bladeName) => {
    setSelectedDamages((prev) => {
      const next = new Set(prev);
      damages
        .filter((d) => d.blade === bladeName)
        .forEach((d) => next.delete(d.id));
      return next;
    });
  };

  const clearAllDamageSelection = () => setSelectedDamages(new Set());

  const { openImageInNewWindow } = useImageBridge({
    t, project, turbine, damages, setDamages, loadData, allTurbineImages, isClient,
  });

  // Estado para última actualización
  const [lastUpdateDate, setLastUpdateDate] = useState(null);

  // Estados para modal de imagen con navegación
  const [imageModal, setImageModal] = useState({
    isOpen: false,
    src: "",
    alt: "",
    currentIndex: 0,
    images: [],
    section: "",
    blade: "",
  });

  const {
    editingDamage,
    editingFields,
    deletingDamages,
    deleteConfirmOpen,
    damageToDelete,
    setEditingDamage,
    setDeleteConfirmOpen,
    updateDamageField,
    saveDamageChanges,
    getImageDetections,
    handleSaveDetection,
    handleUpdateDetection,
    handleDeleteDetection,
    handleDeleteDamage,
    confirmDeleteDamage,
    cancelDeleteDamage,
  } = useDamageActions({ damages, t, loadData, imageModal, setDamages });

  const [loadingIdImage, setLoadingIdImage] = useState(false);

  // Reconstrucción
  const canvasRef = useRef(null);
  const [compositeUrl, setCompositeUrl] = useState("");

  // Hook para precargar imágenes

  // ------------------ DATA LOADERS ------------------

  // Estados para debug panel
  const [imageStats, setImageStats] = useState({
    loaded: 0,
    failed: 0,
    total: 0,
  });

  // State for PDF Language Dialog
  const [showPdfDialog, setShowPdfDialog] = useState(false);
  const handleExportClick = () => {
    setShowPdfDialog(true);
  };

  // === Efectos de carga inicial ===
  useEffect(() => {
    setProject(null);
    setTurbine(null);
    setDamages([]);
    setDamageImages({});
    setAllTurbineImages({
      "Blade A": { TE: [], PS: [], LE: [], SS: [] },
      "Blade B": { TE: [], PS: [], LE: [], SS: [] },
      "Blade C": { TE: [], PS: [], LE: [], SS: [] },
    });
    setImagesBySection({ TE: [], PS: [], LE: [], SS: [] });
    setEditingDamage(null);

    loadData();
  }, [projectId, turbineName]);

  useEffect(() => {
    loadDamageImages();
  }, [damages]);

  // === Data Loading Effects ===
  // Only use loadData which handles V2 schema
  useEffect(() => {
    // Clean up translations or other side effects if needed
    const cleanupCache = () => {
      try {
        cleanCorruptedCache();
      } catch (e) {
        console.warn(e);
      }
    };
    const timeoutId = setTimeout(cleanupCache, 2000);
    return () => clearTimeout(timeoutId);
  }, []);

  // === Detección y Edición de Daños (V2) ===

  // === Funciones de navegación del modal ===
  const navigateImage = (direction) => {
    const { images, currentIndex } = imageModal;
    let newIndex;

    if (direction === "next") {
      newIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
    } else {
      newIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
    }

    const newImage = images[newIndex];
    if (newImage) {
      const data = { publicUrl: getImageUrl(newImage.path) };
      setImageModal((prev) => ({
        ...prev,
        currentIndex: newIndex,
        src: data.publicUrl,
        alt: `${prev.blade} - ${prev.section} - ${newImage.name}`,
      }));

      setTimeout(() => {
        const img = document.querySelector("#modal-image");
        if (img) {
          img.style.transform = "scale(1)";
        }
      }, 100);
    }
  };

  const closeImageModal = () => {
    setImageModal({
      isOpen: false,
      src: "",
      alt: "",
      currentIndex: 0,
      images: [],
      section: "",
      blade: "",
    });
  };

  // Limpiar filtro de severidad cuando cambie la pala seleccionada
  useEffect(() => {
    setSelectedSeverity(null);
  }, [selectedBlade]);

  // === Exponer funciones y datos para el visor de imágenes ===

  // === Nueva función: Abrir imagen en modal React ===
  const openImageInModal = async (file, section, blade, options = {}) => {
    let allImages = [];
    let currentIndex = 0;

    try {
      console.log("[Modal] Abriendo imagen en modal React:", file);
      console.log("[Modal] File data:", {
        name: file.name,
        path: file.path,
        inspection_file_id: file.inspection_file_id,
        id: file.id,
      });

      // Cargar todas las imágenes de la sección para navegación
      if (
        allTurbineImages &&
        allTurbineImages[blade] &&
        allTurbineImages[blade][section]
      ) {
        allImages = allTurbineImages[blade][section].map((img) => ({
          name: img.name || img.file_name,
          path: img.path || img.file_path,
          file_path: img.file_path || img.path,
          section: section,
          blade: blade,
          inspection_file_id: img.inspection_file_id || img.id,
          raw_metadata: img.raw_metadata,
          position_meters: img.position_meters,
          position_percentage: img.position_percentage,
          position_ratio: img.position_ratio,
          mrk_processed: img.mrk_processed,
          ellh_value: img.ellh_value,
          mrk_source_file: img.mrk_source_file,
          blade_length: img.blade_length,
        }));

        currentIndex = allImages.findIndex(
          (img) => img.path === file.path || img.file_path === file.path,
        );
        if (currentIndex === -1) currentIndex = 0;
      } else {
        // Solo imagen actual
        allImages = [
          {
            name: file.name || file.file_name,
            path: file.path || file.file_path,
            file_path: file.file_path || file.path,
            section: section,
            blade: blade,
            inspection_file_id: file.inspection_file_id || file.id,
            position_meters: file.position_meters,
            position_percentage: file.position_percentage,
            position_ratio: file.position_ratio,
            mrk_processed: file.mrk_processed,
            ellh_value: file.ellh_value,
            mrk_source_file: file.mrk_source_file,
            blade_length: file.blade_length,
          },
        ];
        currentIndex = 0;
      }

      console.log("[Modal] All images loaded:", allImages.length);
      console.log("[Modal] Current image index:", currentIndex);
      console.log("[Modal] Current image:", allImages[currentIndex]);

      // Obtener URL pública de la imagen actual
      const urlData = { publicUrl: getImageUrl(allImages[currentIndex].path) };

      // Abrir modal con los datos
      setImageModal({
        isOpen: true,
        src: urlData.publicUrl,
        alt: `${blade} - ${section} - ${allImages[currentIndex].name}`,
        currentIndex: currentIndex,
        images: allImages,
        section: section,
        blade: blade,
      });
    } catch (error) {
      console.error("[Modal] Error abriendo imagen:", error);
      toast({
        title: t("messages.error"),
        description: tx("Error al abrir la imagen"),
        variant: "destructive",
      });
    }
  };

  const {
    getStitchedMap,
    reconBladeLength,
    reconStitched,
    reconItems,
    openDamageInEditor,
    openStitchedInViewer,
  } = useStitched({ turbine, i18n, damages, openImageInNewWindow, isClient, project });

  // === Funciones de utilidad ===
  const totalImages = useMemo(() => {
    let total = 0;
    Object.values(allTurbineImages).forEach((bladeData) => {
      Object.values(bladeData).forEach((sectionImages) => {
        total += sectionImages?.length || 0;
      });
    });
    return total;
  }, [allTurbineImages]);

  const totalImagesByBlade = useMemo(() => {
    const result = {};
    Object.entries(allTurbineImages).forEach(([blade, bladeData]) => {
      result[blade] = Object.values(bladeData).reduce(
        (acc, sectionImages) => acc + (sectionImages?.length || 0),
        0,
      );
    });
    return result;
  }, [allTurbineImages]);

  const selectedBladeImages = useMemo(() => {
    return totalImagesByBlade[selectedBlade] || 0;
  }, [totalImagesByBlade, selectedBlade]);


  // === Generar composición ===
  const buildComposite = async () => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const toLoad = [];
      for (const section of bladeSections) {
        for (const f of imagesBySection[section] || []) {
          const data = { publicUrl: getImageUrl(f.path) };
          toLoad.push({ url: data.publicUrl, section });
        }
      }

      if (!toLoad.length) {
        toast({
          title: t("reportViewer.noImages"),
          description: t("reportViewer.noImagesToReconstruct"),
        });
        return;
      }

      const imgs = await Promise.all(
        toLoad.map(
          ({ url, section }) =>
            new Promise((res, rej) => {
              const i = new Image();
              i.crossOrigin = "anonymous";
              i.onload = () => res({ img: i, section });
              i.onerror = rej;
              i.src = url;
            }),
        ),
      );

      const colWidth = 600;
      const gap = 8;
      const cols = bladeSections.length;

      const heightsByCol = bladeSections.map((section) => {
        const arr = imgs.filter((x) => x.section === section);
        return arr.reduce(
          (h, { img }) =>
            h + Math.round((img.height / img.width) * colWidth) + gap,
          0,
        );
      });

      const maxHeight = Math.max(1, ...heightsByCol) + 16;
      const totalWidth = cols * colWidth + (cols - 1) * gap + 16;

      canvas.width = totalWidth;
      canvas.height = maxHeight;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      let x = 8;
      for (let c = 0; c < cols; c++) {
        const section = bladeSections[c];
        let y = 8;
        for (const { img } of imgs.filter((x) => x.section === section)) {
          const targetH = Math.round((img.height / img.width) * colWidth);
          ctx.drawImage(img, x, y, colWidth, targetH);
          y += targetH + gap;
        }
        ctx.fillStyle = "#eab308";
        ctx.font = "bold 22px sans-serif";
        ctx.fillText(section, x + 8, 28);
        x += colWidth + gap;
      }

      const url = canvas.toDataURL("image/png", 0.92);
      setCompositeUrl(url);
      toast({
        title: t("reportViewer.reconstructionList"),
        description: t("reportViewer.compositeImageGenerated"),
      });
    } catch (err) {
      console.error(err);
      toast({
        title: t("reportViewer.error"),
        description: t("reportViewer.reconstructionError"),
        variant: "destructive",
      });
    }
  };

  // Estado para el botón de descarga
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const { generatePDF } = createReportPdf({
    project, turbine, getCoordinatesDisplay, totalImages, totalImagesByBlade, damageImages, i18n, isGeneratingPDF, setIsGeneratingPDF, setShowPdfDialog, t, isAdmin, selectedDamages, damages, loadDamageImages,
  });

  const handleApprove = async () => {
    try {
      const newStatus =
        turbine.status === "Aprobado" ? "Pendiente" : "Aprobado";
      const { error } = await updateTurbine(turbine.id, { status: newStatus });

      if (error) throw error;

      setTurbine((prev) => ({ ...prev, status: newStatus }));
      toast({
        title: t("reportViewer.approveSuccessTitle"),
        description:
          newStatus === "Aprobado"
            ? t("reportViewer.approveSuccess")
            : t("reportViewer.approvalRevoked"),
      });
    } catch (err) {
      toast({
        title: t("reportViewer.errorTitle"),
        description: err.message || t("reportViewer.approveError"),
        variant: "destructive",
      });
    }
  };

  // === Auto Download PDF effect ===
  useEffect(() => {
    const autoDownload = searchParams.get("autoDownload");
    const lang = searchParams.get("lang");

    if (
      autoDownload === "true" &&
      lang &&
      !loading &&
      !loadingDamages &&
      project &&
      turbine
    ) {
      console.log(`[AutoDownload] Triggering PDF generation in lang: ${lang}`);
      // Only trigger if we aren't already generating
      if (!isGeneratingPDF) {
        // We clean up params immediately to prevent infinite loops
        setSearchParams(new URLSearchParams());
        // Small delay to ensure render is settled before intense PDF generation
        setTimeout(() => {
          generatePDF(lang);
        }, 500);
      }
    }
  }, [
    loading,
    loadingDamages,
    project,
    turbine,
    searchParams,
    isGeneratingPDF,
    setSearchParams,
  ]);

  // === Renderizado ===
  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-ink mx-auto mb-4" />
          <p className="text-ink-muted">{t("reportViewer.loading")}</p>
        </div>
      </div>
    );
  }

  if (!project || !turbine) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-error-text mx-auto mb-4" />
          <h2 className="text-xl font-bold text-ink mb-2">
            {t("reportViewer.dataNotFound")}
          </h2>
          <p className="text-ink-muted">
            {t("reportViewer.dataNotFoundDescription")}
          </p>
        </div>
      </div>
    );
  }

  // --- Datos derivados para la vista (misma lógica que antes, solo extraída del JSX) ---
  // Estatus del reporte: "Pendiente" hasta que el admin lo aprueba; al aprobarlo pasa a "Completado"
  const isApproved = turbine?.status === "Aprobado";
  const turbineStatusLabel = isApproved ? t("status.completed") : t("status.pending");

  // Misma comparación de severidad que usaba el filtro del Resumen
  const damageHasSeverity = (d, severity) => {
    const damageSev = d.severity || "";
    const damageSevNorm = damageSev.replace(/Cat\s*/i, "").trim();
    const severityNum = severity.replace("Cat ", "");
    return damageSevNorm === severityNum || damageSev === severity;
  };
  const severityCountFor = (blade, severity) =>
    damages.filter((d) => d.blade === blade && damageHasSeverity(d, severity))
      .length;
  const bladeStats = bladeTabs.map((blade) => ({
    blade,
    total: damages.filter((d) => d.blade === blade).length,
    images: totalImagesByBlade[blade] || 0,
    counts: [1, 2, 3, 4, 5].map((n) => severityCountFor(blade, `Cat ${n}`)),
  }));
  const selectedBladeDamageCount = damages.filter(
    (d) => d.blade === selectedBlade,
  ).length;

  const infoItems = [
    { label: t("reportViewer.project"), value: project.name },
    { label: t("reportViewer.windFarm"), value: project.wind_farm },
    { label: t("reportViewer.client"), value: project.client || t("reportViewer.notSpecified") },
    { label: t("reportViewer.turbine"), value: turbine.turbine_name },
    {
      label: t("reportViewer.model"),
      value:
        typeof turbine.model === "object"
          ? JSON.stringify(turbine.model)
          : turbine.model || t("reportViewer.notSpecified"),
    },
    {
      label: t("reportViewer.coordinates"),
      value: getCoordinatesDisplay(turbine.coordinates) || t("reportViewer.notSpecifiedPl"),
    },
    {
      label: t("reportViewer.inspectionDate"),
      value: turbine.inspection_date
        ? new Date(turbine.inspection_date).toLocaleDateString(i18n.language?.startsWith("en") ? "en-US" : "es-MX", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" })
        : t("reportViewer.notSpecifiedF"),
    },
    { label: t("reportViewer.status"), value: turbineStatusLabel },
  ];

  return (
    <>
      <Helmet>
        <title>
          {t("reportViewer.title")} - {project.name} - VINDGROUP
        </title>
      </Helmet>

      <div className="min-h-[calc(100vh-4rem)] w-full bg-background p-4 text-ink sm:p-8">
        <div className="w-full space-y-6">
        {/* Header */}
        <ReportHeader
          t={t}
          isClient={isClient}
          project={project}
          turbine={turbine}
          isRefreshing={isRefreshing}
          handleManualRefresh={handleManualRefresh}
          isApproved={isApproved}
        />

        {/* Información del proyecto */}
        <ProjectInfoPanel
          t={t}
          infoItems={infoItems}
        />

        {/* Identificación del Aerogenerador */}
        {turbineIdImage && (
          <TurbineIdPanel
            t={t}
            turbineIdImage={turbineIdImage}
          />
        )}

        {/* Tabs principales */}
        <Card className="overflow-hidden rounded-md border-line-subtle bg-surface-panel shadow-none">
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <ReportTabsBar
                role={role}
                t={t}
                isClient={isClient}
                turbine={turbine}
                totalImages={totalImages}
                handleApprove={handleApprove}
              />

              <div className="p-4 sm:p-6">
                <TabsContent value="overview" className="mt-0">
                  <div id="report-content" className="space-y-6">
                    {/* Exportar informe */}
                    <ExportSection
                      t={t}
                      isAdmin={isAdmin}
                      selectedDamages={selectedDamages}
                      clearAllDamageSelection={clearAllDamageSelection}
                      handleExportClick={handleExportClick}
                      isGeneratingPDF={isGeneratingPDF}
                    />

                    {/* Estado por pala */}
                    <BladeStatusSection
                      t={t}
                      selectedBlade={selectedBlade}
                      setSelectedBlade={setSelectedBlade}
                      bladeStats={bladeStats}
                    />

                    {/* Detalle de la pala seleccionada */}
                    <BladeDetailSection
                      t={t}
                      selectedBlade={selectedBlade}
                      turbine={turbine}
                      isRefreshing={isRefreshing}
                      handleManualRefresh={handleManualRefresh}
                      selectedSeverity={selectedSeverity}
                      setSelectedSeverity={setSelectedSeverity}
                      totalImages={totalImages}
                      selectedBladeImages={selectedBladeImages}
                      severityCountFor={severityCountFor}
                      selectedBladeDamageCount={selectedBladeDamageCount}
                    />

                    {/* Lista de daños */}
                    <DamageListSection
                      t={t}
                      i18n={i18n}
                      isClient={isClient}
                      isAdmin={isAdmin}
                      selectedBlade={selectedBlade}
                      sectionAliases={sectionAliases}
                      damages={damages}
                      damageImages={damageImages}
                      savingAlias={savingAlias}
                      getSectionLabel={getSectionLabel}
                      updateSectionAlias={updateSectionAlias}
                      loadingDamages={loadingDamages}
                      severityFilter={severityFilter}
                      setSeverityFilter={setSeverityFilter}
                      selectedSeverity={selectedSeverity}
                      selectedDamages={selectedDamages}
                      toggleDamageSelection={toggleDamageSelection}
                      selectAllBladeDamages={selectAllBladeDamages}
                      clearBladeDamageSelection={clearBladeDamageSelection}
                      openImageInNewWindow={openImageInNewWindow}
                      editingDamage={editingDamage}
                      editingFields={editingFields}
                      deletingDamages={deletingDamages}
                      setEditingDamage={setEditingDamage}
                      updateDamageField={updateDamageField}
                      saveDamageChanges={saveDamageChanges}
                      handleDeleteDamage={handleDeleteDamage}
                      selectedBladeDamageCount={selectedBladeDamageCount}
                    />
                  </div>
                </TabsContent>

                <ImagesTab
                  t={t}
                  isAdmin={isAdmin}
                  selectedBlade={selectedBlade}
                  setSelectedBlade={setSelectedBlade}
                  imageSection={imageSection}
                  setImageSection={setImageSection}
                  sectionAliases={sectionAliases}
                  allTurbineImages={allTurbineImages}
                  imagesLoaded={imagesLoaded}
                  loadAllBladesImages={loadAllBladesImages}
                  savingAlias={savingAlias}
                  getSectionLabel={getSectionLabel}
                  updateSectionAlias={updateSectionAlias}
                  loadingImages={loadingImages}
                  openImageInNewWindow={openImageInNewWindow}
                  totalImages={totalImages}
                  totalImagesByBlade={totalImagesByBlade}
                />

                {/* STITCHED VIEW */}
                <StitchedTab
                  t={t}
                  getStitchedMap={getStitchedMap}
                  openStitchedInViewer={openStitchedInViewer}
                />

                {!isClient && (
                  <TabsContent value="reconstruction" className="mt-0">
                    <ReconstructionPanel
                      items={reconItems}
                      bladeLength={reconBladeLength}
                      stitchedUrls={reconStitched.urls}
                      calibrations={reconStitched.calibrations}
                      onOpenDamage={openDamageInEditor}
                    />
                  </TabsContent>
                )}
              </div>
            </Tabs>
          </CardContent>
        </Card>

        {/* Visor de imagen con capas editables */}
        <EditableImageViewer
          isOpen={imageModal.isOpen}
          onClose={closeImageModal}
          imageSrc={imageModal.src}
          imageAlt={imageModal.alt}
          detections={getImageDetections(imageModal.src)}
          onSaveDetection={handleSaveDetection}
          onDeleteDetection={handleDeleteDetection}
          onUpdateDetection={handleUpdateDetection}
          userRole={userRole}
          // Props para la regleta
          bladeLength={(() => {
            // Intentar obtener blade_length desde las imágenes del modal
            const firstImage = imageModal.images?.[0];
            if (firstImage?.blade_length) return firstImage.blade_length;

            // Intentar calcular desde position_meters y position_ratio
            const imageWithPosition = imageModal.images?.find(
              (img) =>
                img.position_meters &&
                img.position_ratio &&
                img.position_ratio > 0,
            );
            if (imageWithPosition) {
              const estimated =
                imageWithPosition.position_meters /
                imageWithPosition.position_ratio;
              if (Number.isFinite(estimated) && estimated > 0) return estimated;
            }

            // Valor por defecto
            return 50;
          })()}
          allImages={imageModal.images || []}
          currentImage={imageModal.images?.[imageModal.currentIndex]}
          damages={damages.filter(
            (d) =>
              d.blade === imageModal.blade && d.section === imageModal.section,
          )}
          section={imageModal.section}
          onImageClick={(image) => {
            const imageIndex = imageModal.images.findIndex(
              (img) => img.path === image.path,
            );
            if (imageIndex !== -1) {
              const data = { publicUrl: getImageUrl(image.path) };
              setImageModal((prev) => ({
                ...prev,
                currentIndex: imageIndex,
                src: data.publicUrl,
                alt: `${prev.blade} - ${prev.section} - ${
                  image.name || image.file_name
                }`,
              }));
            }
          }}
          translations={{
            title: t("imageViewer.title"),
            hideLayers: t("imageViewer.hideLayers"),
            showLayers: t("imageViewer.showLayers"),
            editDetection: t("imageViewer.editDetection"),
            deleteDetection: t("imageViewer.deleteDetection"),
            createDetection: t("imageViewer.createDetection"),
            cancelCreation: t("imageViewer.cancelCreation"),
            severity: t("imageViewer.severity"),
            damageType: t("imageViewer.damageType"),
            confidence: t("imageViewer.confidence"),
            save: t("common.save"),
            cancel: t("common.cancel"),
          }}
        />

        {/* Confirmación de eliminación de daño */}
        <DeleteDamageDialog
          t={t}
          deletingDamages={deletingDamages}
          deleteConfirmOpen={deleteConfirmOpen}
          damageToDelete={damageToDelete}
          setDeleteConfirmOpen={setDeleteConfirmOpen}
          confirmDeleteDamage={confirmDeleteDamage}
          cancelDeleteDamage={cancelDeleteDamage}
        />

        {/* Language Selection Dialog for PDF */}
        <LanguagePdfDialog
          isOpen={showPdfDialog}
          onClose={() => setShowPdfDialog(false)}
          onConfirm={(lang) => generatePDF(lang)}
          isGenerating={isGeneratingPDF}
        />
        </div>
      </div>
    </>
  );
}
