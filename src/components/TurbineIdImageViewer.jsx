import React, { useState, useRef, useEffect } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Maximize2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const TurbineIdImageViewer = ({
  imageSrc,
  imageAlt,
  // Props para la regleta (opcional para imágenes de turbina)
  bladeLength = null,
  allImages = [],
  currentImage = null,
  damages = [],
  section = "",
  onImageClick = null,
}) => {
  const { t } = useTranslation("common");
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);
  const imageRef = useRef(null);

  // Valores de zoom predefinidos
  const zoomLevels = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
  const foundIndex = zoomLevels.findIndex((level) => level === zoom);
  const currentZoomIndex = foundIndex === -1 ? 3 : foundIndex;

  // Reset zoom y posición
  const resetView = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  // Zoom in
  const zoomIn = () => {
    const currentIndex = zoomLevels.findIndex((level) => level === zoom);
    if (currentIndex < zoomLevels.length - 1) {
      setZoom(zoomLevels[currentIndex + 1]);
    }
  };

  // Zoom out
  const zoomOut = () => {
    const currentIndex = zoomLevels.findIndex((level) => level === zoom);
    if (currentIndex > 0) {
      setZoom(zoomLevels[currentIndex - 1]);
    }
  };

  // Manejar zoom con rueda del mouse
  const handleWheel = (e) => {
    // Solo aplicar zoom si el mouse está sobre el contenedor de la imagen
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const delta = e.deltaY > 0 ? -1 : 1;
    const currentIndex = zoomLevels.findIndex((level) => level === zoom);
    const newIndex = Math.max(
      0,
      Math.min(zoomLevels.length - 1, currentIndex + delta)
    );

    if (newIndex !== currentIndex) {
      setZoom(zoomLevels[newIndex]);
    }
  };

  // Manejar inicio de arrastre
  const handleMouseDown = (e) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  // Manejar arrastre
  const handleMouseMove = (e) => {
    if (isDragging && zoom > 1) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;

      // Limitar el movimiento dentro del contenedor
      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const imageRect = imageRef.current?.getBoundingClientRect();

        if (imageRect) {
          const maxX = Math.max(
            0,
            (imageRect.width * zoom - containerRect.width) / 2
          );
          const maxY = Math.max(
            0,
            (imageRect.height * zoom - containerRect.height) / 2
          );

          setPosition({
            x: Math.max(-maxX, Math.min(maxX, newX)),
            y: Math.max(-maxY, Math.min(maxY, newY)),
          });
        }
      }
    }
  };

  // Manejar fin de arrastre
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Manejar gestos táctiles
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      // Un dedo - arrastre
      if (zoom > 1) {
        setIsDragging(true);
        setDragStart({
          x: e.touches[0].clientX - position.x,
          y: e.touches[0].clientY - position.y,
        });
      }
    } else if (e.touches.length === 2) {
      // Dos dedos - zoom
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      setDragStart({ distance, x: 0, y: 0 });
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 1 && isDragging && zoom > 1) {
      // Un dedo - arrastre
      const newX = e.touches[0].clientX - dragStart.x;
      const newY = e.touches[0].clientY - dragStart.y;

      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const imageRect = imageRef.current?.getBoundingClientRect();

        if (imageRect) {
          const maxX = Math.max(
            0,
            (imageRect.width * zoom - containerRect.width) / 2
          );
          const maxY = Math.max(
            0,
            (imageRect.height * zoom - containerRect.height) / 2
          );

          setPosition({
            x: Math.max(-maxX, Math.min(maxX, newX)),
            y: Math.max(-maxY, Math.min(maxY, newY)),
          });
        }
      }
    } else if (e.touches.length === 2) {
      // Dos dedos - zoom
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      const scale = distance / dragStart.distance;
      const newZoom = Math.max(0.5, Math.min(3, zoom * scale));
      setZoom(newZoom);

      setDragStart({ distance, x: 0, y: 0 });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Toggle pantalla completa
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Manejar cambios de pantalla completa
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Limpiar eventos al desmontar
  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    const handleGlobalTouchEnd = () => setIsDragging(false);

    document.addEventListener("mouseup", handleGlobalMouseUp);
    document.addEventListener("touchend", handleGlobalTouchEnd);

    return () => {
      document.removeEventListener("mouseup", handleGlobalMouseUp);
      document.removeEventListener("touchend", handleGlobalTouchEnd);
    };
  }, []);

  // Efecto para manejar el foco del contenedor
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      const handleWheelCapture = (e) => {
        // Solo procesar el evento si el mouse está sobre el contenedor
        if (container.contains(e.target)) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          // Aplicar zoom directamente aquí
          const delta = e.deltaY > 0 ? -1 : 1;
          const currentIndex = zoomLevels.findIndex((level) => level === zoom);
          const newIndex = Math.max(
            0,
            Math.min(zoomLevels.length - 1, currentIndex + delta)
          );

          if (newIndex !== currentIndex) {
            setZoom(zoomLevels[newIndex]);
          }
        }
      };

      // Usar capture para interceptar el evento antes de que se propague
      container.addEventListener("wheel", handleWheelCapture, {
        passive: false,
        capture: true,
      });

      return () => {
        container.removeEventListener("wheel", handleWheelCapture, {
          capture: true,
        });
      };
    }
  }, [zoom, zoomLevels]);

  return (
    <div className="relative space-y-2">
      {/* Regleta de pala */}
      {/* Controles de zoom - más compactos */}
      <div className="absolute top-1 right-1 z-10 flex gap-1">
        <button
          onClick={zoomOut}
          disabled={zoom <= 0.5}
          className="p-1.5 bg-slate-700/90 hover:bg-slate-600/90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-3 h-3" />
        </button>

        <button
          onClick={zoomIn}
          disabled={zoom >= 3}
          className="p-1.5 bg-slate-700/90 hover:bg-slate-600/90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-3 h-3" />
        </button>

        <button
          onClick={resetView}
          className="p-1.5 bg-slate-700/90 hover:bg-slate-600/90 text-white rounded transition-colors"
          title="Reset View"
        >
          <RotateCcw className="w-3 h-3" />
        </button>

        <button
          onClick={toggleFullscreen}
          className="p-1.5 bg-slate-700/90 hover:bg-slate-600/90 text-white rounded transition-colors"
          title="Fullscreen"
        >
          <Maximize2 className="w-3 h-3" />
        </button>
      </div>
      {/* Indicador de zoom - más compacto */}
      <div className="absolute top-1 left-1 z-10">
        <div className="px-2 py-1 bg-slate-700/90 text-white text-xs rounded">
          {Math.round(zoom * 100)}%
        </div>
      </div>
      {/* Contenedor de la imagen con zoom */}
      <div
        ref={containerRef}
        className={`relative overflow-hidden rounded-lg border border-slate-600 bg-slate-700/30 ${
          isFullscreen ? "fixed inset-0 z-50 bg-slate-900" : "h-[500px] w-full"
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseEnter={(e) => {
          // Asegurar que el contenedor capture el foco para el zoom
          e.currentTarget.focus();
        }}
        style={{
          cursor: isDragging ? "grabbing" : zoom > 1 ? "grab" : "default",
        }}
        tabIndex={0}
      >
        <img
          ref={imageRef}
          src={imageSrc}
          alt={imageAlt}
          className={`object-contain transition-transform duration-200 ${
            isFullscreen ? "w-full h-full" : "w-full h-full"
          }`}
          style={{
            transform: `scale(${zoom}) translate(${position.x / zoom}px, ${
              position.y / zoom
            }px)`,
            transformOrigin: "center center",
          }}
          onError={(e) => {
            console.error("Error loading turbine ID image:", e);
            e.target.style.display = "none";
          }}
          draggable={false}
        />
      </div>
    </div>
  );
};

export default TurbineIdImageViewer;
