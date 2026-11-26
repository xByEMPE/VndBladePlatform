import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { useToast } from "@/components/ui/use-toast"; // Assuming use-toast exists, or use generic toast
import LoadingSpinner from "@/components/LoadingSpinner";
import { useExifData } from "@/hooks/useExifData";
import { useViewerMetrics } from "./imageViewer/hooks/useViewerMetrics";
import { useViewerData } from "./imageViewer/hooks/useViewerData";
import { useExifHydration } from "./imageViewer/hooks/useExifHydration";
import { ViewerCanvas } from "./imageViewer/components/ViewerCanvas";
import { ViewerTopBar } from "./imageViewer/components/ViewerTopBar";
import { ThumbnailsPanel } from "./imageViewer/components/ThumbnailsPanel";
import { ViewerDetectionModal } from "./imageViewer/components/ViewerDetectionModal";
import { useCalibration } from "./imageViewer/hooks/useCalibration";
import { useViewerView } from "./imageViewer/hooks/useViewerView";

const ImageViewerPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { role: userRole } = useRolePermissions();

  // ----- STATE -----
  const [editingDetection, setEditingDetection] = useState(null);
  const [newDetection, setNewDetection] = useState(null);
  const [isCreatingDetection, setIsCreatingDetection] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [defaultZoom, setDefaultZoom] = useState(1); // For Reset functionality

  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [negativeMode, setNegativeMode] = useState(false);

  const [showRuler, setShowRuler] = useState(true);
  // Imágenes stitched: no tienen metadatos de calibración (GSD / radio), así que se
  // ocultan la regla y las herramientas de medición y no se consulta la base de datos.
  const [isStitched, setIsStitched] = useState(false);

  // Calibración manual de la regla en stitched. Se guarda en la base de datos
  // (turbines.stitched._calibration[pala][sección]) para que todos la vean; solo
  // administrador y técnico pueden crearla, cambiarla o borrarla.
  const [stitchedTurbineId, setStitchedTurbineId] = useState(null);
  const [calibrations, setCalibrations] = useState({}); // { A: { LeadingEdge: { tipY, rootY, bladeLength } } }
  const [calibSaving, setCalibSaving] = useState(false);
  const [calibStep, setCalibStep] = useState(null); // null | "tip" | "root"
  const [calibTipTemp, setCalibTipTemp] = useState(null);
  const [calibLength, setCalibLength] = useState(""); // largo de pala en metros
  const [downloading, setDownloading] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Sidebar state
  const [sidebarHover, setSidebarHover] = useState(false); // Sidebar hover state
  const [toolMode, setToolMode] = useState("none"); // "none", "crosshair", "area"

  // Data State
  const [allImages, setAllImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useExifHydration({ allImages, setAllImages });

  // Tool State (External)
  const [polygons, setPolygons] = useState([]);

  // Turbine & Measurement Metadata
  const [turbineCoords, setTurbineCoords] = useState(null);
  const [bladeLength, setBladeLength] = useState(null);

  // --- VIRTUAL RULER MANIFEST STATE ---
  const [manifestData, setManifestData] = useState(null);
  const [manifestLoading, setManifestLoading] = useState(false);

  // ----- DERIVED STATE -----
  const currentImage = allImages[currentImageIndex] || null;

  const { masterGSD_mm_px, globalStartMeters, calibration } = useViewerMetrics({ currentImage });
  
  const { retryAuth } = useViewerData({
    allImages, currentImage, isStitched, currentImageIndex,
    location, navigate, setIsStitched, setStitchedTurbineId,
    setAllImages, setCurrentImageIndex, setLoading, setBladeLength,
    setManifestData, setManifestLoading, setPolygons, setTurbineCoords,
  });

  // Exif Hook
  const { exifData } = useExifData(
    isStitched ? null : currentImage?.src || currentImage?.file_path,
    isStitched ? null : currentImage?.id
  );

  const {
    canCalibrate, savedCalib, stitchedRuler, handleCalibrationClick, startCalibration, commitCalibLength, clearCalibration, calibMarkers,
  } = useCalibration({
    isStitched, userRole, currentImage, calibLength,
    calibrations, stitchedTurbineId, retryAuth, bladeLength,
    calibStep, calibTipTemp, showRuler, toast,
    setCalibrations, setCalibLength, setCalibStep, setCalibTipTemp,
    setCalibSaving, setShowRuler,
  });

  // ----- HANDLERS -----

  const { handleZoom, resetView, handleImageLoaded, filterStyle } = useViewerView({
    defaultZoom, brightness, contrast, negativeMode,
    setZoom, setPan, setBrightness, setContrast, setNegativeMode, setDefaultZoom,
  });

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-surface-base text-ink">
        <LoadingSpinner size="lg" text={t("imageViewer.loadingViewer")} />
      </div>
    );
  }

  if (!currentImage) {
    return (
      <div className="text-ink text-center p-10">
        {t("imageViewer.noImageSelected")}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-surface-base text-ink overflow-hidden">
      {/* --- TOP BAR --- */}
      <ViewerTopBar
        t={t}
        toast={toast}
        userRole={userRole}
        setEditingDetection={setEditingDetection}
        setNewDetection={setNewDetection}
        isCreatingDetection={isCreatingDetection}
        setIsCreatingDetection={setIsCreatingDetection}
        zoom={zoom}
        brightness={brightness}
        setBrightness={setBrightness}
        contrast={contrast}
        setContrast={setContrast}
        negativeMode={negativeMode}
        setNegativeMode={setNegativeMode}
        showRuler={showRuler}
        setShowRuler={setShowRuler}
        isStitched={isStitched}
        calibSaving={calibSaving}
        calibStep={calibStep}
        setCalibStep={setCalibStep}
        setCalibTipTemp={setCalibTipTemp}
        calibLength={calibLength}
        setCalibLength={setCalibLength}
        downloading={downloading}
        setDownloading={setDownloading}
        toolMode={toolMode}
        setToolMode={setToolMode}
        polygons={polygons}
        setPolygons={setPolygons}
        currentImage={currentImage}
        canCalibrate={canCalibrate}
        savedCalib={savedCalib}
        stitchedRuler={stitchedRuler}
        startCalibration={startCalibration}
        commitCalibLength={commitCalibLength}
        clearCalibration={clearCalibration}
        handleZoom={handleZoom}
        resetView={resetView}
      />

      {/* --- CONTENT CONTAINER (Flex Row) --- */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* --- MAIN VIEWER AREA --- */}
        <ViewerCanvas
          t={t}
          setEditingDetection={setEditingDetection}
          newDetection={newDetection}
          setNewDetection={setNewDetection}
          isCreatingDetection={isCreatingDetection}
          imageDimensions={imageDimensions}
          setImageDimensions={setImageDimensions}
          zoom={zoom}
          setZoom={setZoom}
          pan={pan}
          setPan={setPan}
          showRuler={showRuler}
          isStitched={isStitched}
          calibStep={calibStep}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          setSidebarHover={setSidebarHover}
          toolMode={toolMode}
          setToolMode={setToolMode}
          polygons={polygons}
          setPolygons={setPolygons}
          currentImage={currentImage}
          masterGSD_mm_px={masterGSD_mm_px}
          globalStartMeters={globalStartMeters}
          calibration={calibration}
          stitchedRuler={stitchedRuler}
          handleCalibrationClick={handleCalibrationClick}
          calibMarkers={calibMarkers}
          handleImageLoaded={handleImageLoaded}
          filterStyle={filterStyle}
        />

        {/* --- RIGHT SIDEBAR (Collapsible) --- */}
        <ThumbnailsPanel
          t={t}
          isStitched={isStitched}
          isSidebarOpen={isSidebarOpen}
          allImages={allImages}
          setCurrentImageIndex={setCurrentImageIndex}
          currentImage={currentImage}
        />
      </div>

      {/* Modals */}
      {editingDetection && (
          <ViewerDetectionModal
            t={t}
            toast={toast}
            editingDetection={editingDetection}
            setEditingDetection={setEditingDetection}
            setNewDetection={setNewDetection}
            setIsCreatingDetection={setIsCreatingDetection}
            currentImage={currentImage}
          />
      )}
    </div>
  );
};

export default ImageViewerPage;
