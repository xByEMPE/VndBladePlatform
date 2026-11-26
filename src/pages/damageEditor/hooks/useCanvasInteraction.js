import { useEffect } from "react";

// Motor de interacción del lienzo del editor: zoom, vista, coordenadas, arrastre/redimensión del recuadro,
// dibujo de polígonos, eventos táctiles, carga de imagen, filtros y tecla Escape. Los efectos conservan su orden relativo.
export const useCanvasInteraction = ({
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
}) => {
  // Simple Zoom (Buttons) - centers on screen
  const handleZoom = (delta) => {
    const newZoom = Math.max(0.1, Math.min(10, zoom + delta));
    setZoom(newZoom);
  };

  // Reset View
  const resetView = () => {
    if (imageRef.current && containerRef.current) {
      const container = containerRef.current;
      const img = imageRef.current;
      const wRatio = container.clientWidth / img.naturalWidth;
      const hRatio = container.clientHeight / img.naturalHeight;
      const fit = Math.min(wRatio, hRatio) * 0.95;
      setZoom(fit);
      setPan({ x: 0, y: 0 });
    } else {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  };

  // Función para resetear imagen
  const resetImage = () => {
    setBrightness(100);
    setContrast(100);
    resetView();
  };

  // Helper: Get Polygon Area (Shoelace)
  const getPolygonArea = (points) => {
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return Math.abs(area) / 2;
  };

  // Wheel Zoom (from BladeInspectionViewer)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const onWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((prev) => Math.max(0.1, Math.min(10, prev + delta)));
    };
    
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [setZoom]);

  // Coordinate Transformation (from BladeInspectionViewer)
  const getLocalCoords = (e) => {
    if (!containerRef.current || !imageRef.current) return { x: 0, y: 0 };

    // 1. Mouse relative to Container
    const cRect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - cRect.left;
    const my = e.clientY - cRect.top;

    // 2. Center of Container (Transform Origin)
    const cx = containerRef.current.clientWidth / 2;
    const cy = containerRef.current.clientHeight / 2;

    // 3. Vector from Center to Mouse
    let dx = mx - cx;
    let dy = my - cy;

    // 4. Untranslate (Subtract Pan)
    dx -= pan.x;
    dy -= pan.y;

    // 5. Unscale
    dx /= zoom;
    dy /= zoom;

    // 6. Unrotate (Inverse Rotation)
    const rotation = currentImage?.metadata?.rotation || 0;
    const rad = -(rotation * Math.PI) / 180;
    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);

    // 7. Map to Image Coordinates (Origin at TopLeft)
    const imgW = imageRef.current.naturalWidth;
    const imgH = imageRef.current.naturalHeight;

    return {
      x: rx + imgW / 2,
      y: ry + imgH / 2,
    };
  };

  // Función para detectar clic en punto de control
  const getControlPointAt = (mouseImgX, mouseImgY, detection) => {
    if (!editingDetection || editingDetection.id !== detection.id || !imageRef.current) return null;
    const [nx, ny, nw, nh] = detection.bbox;
    const imgW = imageRef.current.naturalWidth;
    const imgH = imageRef.current.naturalHeight;
    const x = nx * imgW;
    const y = ny * imgH;
    const w = nw * imgW;
    const h = nh * imgH;
    const controlSize = 12 / zoom;

    const controlPoints = [
      { x, y, type: "nw" },
      { x: x + w, y, type: "ne" },
      { x, y: y + h, type: "sw" },
      { x: x + w, y: y + h, type: "se" },
      { x: x + w / 2, y, type: "n" },
      { x: x + w / 2, y: y + h, type: "s" },
      { x, y: y + h / 2, type: "w" },
      { x: x + w, y: y + h / 2, type: "e" },
    ];

    for (const point of controlPoints) {
      if (Math.abs(mouseImgX - point.x) < controlSize && Math.abs(mouseImgY - point.y) < controlSize) {
        return point.type;
      }
    }

    // Check if inside box (for move)
    if (mouseImgX >= x && mouseImgX <= x + w && mouseImgY >= y && mouseImgY <= y + h) {
      return "move";
    }

    return null;
  };

  // Mouse Down Handler
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;

    // Tool Mode: Area (Polygon Drawing)
    if (toolMode === "area") {
      if (draggedPointInfo !== null) return;
      const coords = getLocalCoords(e);
      if (currentPolygon.length < 4) {
        const newPoly = [...currentPolygon, coords];
        if (newPoly.length === 4) {
          setPolygons([...polygons, newPoly]);
          setCurrentPolygon([]);
        } else {
          setCurrentPolygon(newPoly);
        }
      }
      return;
    }

    const coords = getLocalCoords(e);
    const img = imageRef.current;
    if (!img) return;

    // Creation Mode
    if (isCreating) {
      const newId = `new-${Date.now()}`;
      const newDetection = {
        id: newId,
        bbox: [
          coords.x / img.naturalWidth,
          coords.y / img.naturalHeight,
          0,
          0,
        ],
        severity: "Cat 3",
        category: "Damage",
        confidence: 1.0,
      };
      setDetections((prev) => [...prev, newDetection]);
      setEditingDetection(newDetection);
      setResizingBox({ detectionId: newId, handle: "se" });
      setInitialBoxState({ bbox: [...newDetection.bbox], mouseStart: coords });
      setIsDragging(true);
      setIsCreating(false);
      return;
    }

    // Check if clicking on editing detection's control points
    if (editingDetection) {
      const controlType = getControlPointAt(coords.x, coords.y, editingDetection);
      if (controlType) {
        setResizingBox({ detectionId: editingDetection.id, handle: controlType });
        setInitialBoxState({ bbox: [...editingDetection.bbox], mouseStart: coords });
        setIsDragging(true);
        return;
      }
    }

    // Check if clicking on any detection (only allow edit mode for admin/technician)
    const hitDetection = detections.find((d) => {
      const [nx, ny, nw, nh] = d.bbox;
      const x = nx * img.naturalWidth;
      const y = ny * img.naturalHeight;
      const w = nw * img.naturalWidth;
      const h = nh * img.naturalHeight;
      return coords.x >= x && coords.x <= x + w && coords.y >= y && coords.y <= y + h;
    });

    if (hitDetection) {
      setSelectedDamageId(hitDetection.id);
      if (canEdit) {
        setEditingDetection(hitDetection);
      } else {
        showDamageInfo(hitDetection);
      }
      return;
    }

    // Default: Pan
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };


  // Mouse Move Handler
  const handleMouseMove = (e) => {
    e.preventDefault();
    const coords = getLocalCoords(e);

    // Update cursor position for tools
    if (toolMode === "crosshair" || toolMode === "none") {
      setCursorPos(coords);
    }

    // Tool Mode: Area - Polygon Point Dragging
    if (toolMode === "area") {
      setCursorPos(coords);
      if (draggedPointInfo !== null) {
        const { polyIndex, pointIndex } = draggedPointInfo;
        const newPolys = [...polygons];
        const newPts = [...newPolys[polyIndex]];
        newPts[pointIndex] = coords;
        newPolys[polyIndex] = newPts;
        setPolygons(newPolys);
      }
      return;
    }

    if (!isDragging) return;

    // Resizing/Moving Box
    if (resizingBox && initialBoxState && imageRef.current) {
      const img = imageRef.current;
      const { bbox: initialBbox, mouseStart } = initialBoxState;
      const { handle } = resizingBox;

      const deltaX = coords.x - mouseStart.x;
      const deltaY = coords.y - mouseStart.y;

      const [ix, iy, iw, ih] = initialBbox;
      let x = ix * img.naturalWidth;
      let y = iy * img.naturalHeight;
      let w = iw * img.naturalWidth;
      let h = ih * img.naturalHeight;

      if (handle === "move") {
        x += deltaX;
        y += deltaY;
      } else {
        if (handle.includes("e")) w = Math.max(1, iw * img.naturalWidth + deltaX);
        if (handle.includes("s")) h = Math.max(1, ih * img.naturalHeight + deltaY);
        if (handle.includes("w")) {
          const newW = Math.max(1, iw * img.naturalWidth - deltaX);
          x = ix * img.naturalWidth + (iw * img.naturalWidth - newW);
          w = newW;
        }
        if (handle.includes("n")) {
          const newH = Math.max(1, ih * img.naturalHeight - deltaY);
          y = iy * img.naturalHeight + (ih * img.naturalHeight - newH);
          h = newH;
        }
      }

      const newBbox = [
        x / img.naturalWidth,
        y / img.naturalHeight,
        w / img.naturalWidth,
        h / img.naturalHeight,
      ];

      const metrics = calculateMetrics(newBbox);
      const updatedDetection = { 
        ...editingDetection, 
        bbox: newBbox,
        ...(metrics || {}) // Inject calculated metrics (radio, etc)
      };
      
      setEditingDetection(updatedDetection);
      setDetections((prev) =>
        prev.map((d) => (d.id === editingDetection.id ? updatedDetection : d))
      );
      updateDamageMetrics(newBbox);
      return;
    }

    // Pan
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setResizingBox(null);
    setInitialBoxState(null);
    setDraggedPointInfo(null);
  };

  // Handlers para eventos táctiles
  const handleTouchStart = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("mousedown", {
      clientX: touch.clientX,
      clientY: touch.clientY,
      button: 0,
    });
    handleMouseDown(mouseEvent);
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("mousemove", {
      clientX: touch.clientX,
      clientY: touch.clientY,
      button: 0,
    });
    handleMouseMove(mouseEvent);
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    const mouseEvent = new MouseEvent("mouseup", {
      clientX: 0,
      clientY: 0,
      button: 0,
    });
    handleMouseUp(mouseEvent);
  };

  // Image Load Handler
  const handleImageLoad = () => {
    if (!containerRef.current || !imageRef.current) return;
    const container = containerRef.current;
    const img = imageRef.current;
    const wRatio = container.clientWidth / img.naturalWidth;
    const hRatio = container.clientHeight / img.naturalHeight;
    const fit = Math.min(wRatio, hRatio) * 0.95;
    setZoom(fit);
    setPan({ x: 0, y: 0 });
    
    // Normalize pixel-coordinate bboxes to 0-1 range
    // DB stores region in pixel coords, but all internal code expects normalized
    setDetections(prev => prev.map(d => {
      if (!d.bbox || d.bbox.length !== 4) return d;
      const [bx, by, bw, bh] = d.bbox;
      // If any value > 1, it's pixel coords — normalize
      if (bx > 1 || by > 1 || bw > 1 || bh > 1) {
        console.log("[DamageEditor] Normalizing pixel bbox:", d.bbox, "→", 
          [bx / img.naturalWidth, by / img.naturalHeight, bw / img.naturalWidth, bh / img.naturalHeight]);
        return {
          ...d,
          bbox: [
            bx / img.naturalWidth,
            by / img.naturalHeight,
            bw / img.naturalWidth,
            bh / img.naturalHeight,
          ]
        };
      }
      return d;
    }));
  };

  // Efecto para aplicar filtros de imagen
  useEffect(() => {
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
  }, [brightness, contrast, negativeMode]);



  // Listener para tecla ESC (Cancelar dibujo)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
         if (toolMode === "area" && currentPolygon.length > 0) {
             setCurrentPolygon([]); // Reset current drawing
             console.log("[DamageEditor] Polygon drawing cancelled");
         } else if (toolMode !== "none") {
             // Optional: Exit tool mode?
             // setToolMode("none");
             // setShowArea(false); 
             // setShowCrosshair(false);
         }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toolMode, currentPolygon]);

  return { handleZoom, resetImage, getPolygonArea, getLocalCoords, handleMouseDown, handleMouseMove, handleMouseUp, handleTouchStart, handleTouchMove, handleTouchEnd, handleImageLoad };
};
