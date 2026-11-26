// Controles de vista del visor: zoom, restablecer vista, zoom de ajuste al cargar la imagen y estilo de filtros.
// Es derivación pura: no contiene hooks de React.
export const useViewerView = ({
  defaultZoom, brightness, contrast, negativeMode,
  setZoom, setPan, setBrightness, setContrast, setNegativeMode, setDefaultZoom,
}) => {
  const handleZoom = (delta) => {
    setZoom((prev) => Math.max(0.1, Math.min(10, prev + delta)));
  };

  const resetView = () => {
    setZoom(defaultZoom);
    setPan({ x: 0, y: 0 });
    setBrightness(100);
    setContrast(100);
    setNegativeMode(false);
  };

  const handleImageLoaded = ({ fitScale }) => {
    setDefaultZoom(fitScale);
    // On very first load, we might want to respect this if stored state is empty?
    // Actually BladeInspectionViewer already applies initial zoom.
    // We just store it for Reset button.
  };

  // Filter Styles
  const filterStyle = {
    filter: `brightness(${brightness}%) contrast(${contrast}%) ${
      negativeMode ? "invert(1)" : ""
    }`,
    transition: "filter 0.1s ease",
  };

  return { handleZoom, resetView, handleImageLoaded, filterStyle };
};
