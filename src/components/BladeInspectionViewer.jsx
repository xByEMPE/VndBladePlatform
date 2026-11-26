import React, { useRef, useState, useEffect } from "react";
import VirtualBladeRuler from "./VirtualBladeRuler";

/**
 * BladeInspectionViewer
 *
 * Componente principal para visualización de inspección de palas.
 * Maneja el comportamiento del Zoom/Pan y la superposición de la regla.
 */
const BladeInspectionViewer = ({
  imageUrl,
  zoom,
  setZoom,
  pan,
  setPan,
  pixelScale, // Global GSD (for Ruler/Position)
  localPixelScale = null, // Local GSD (for Area/Dimensions) - specific to this image
  bladeRadius,
  bladeLength = null, // Total length in meters (for forced scaling)
  calibrationOffset = 5.5, // Calibration offset (default +5.5m)
  toolMode = "none", // "none", "crosshair", "area"
  globalStartMeters = null,
  showRuler,
  filterStyle = {},
  onImageLoad = null, // Callback to return natural dimensions and fitScale
  // External Polygon State (Lifted for Toolbar Reset)
  // External Polygon State (Lifted for Toolbar Reset)
  polygons = [],
  onPolygonsChange = () => {},
  isRootToTip = false, // Default to TipToRoot (false)
  rotation = 0, // Added rotation prop
  detections = [], // Added detections prop
  onCalibrationClick = null, // (coords) => void, usado con toolMode="calibrate"
  markers = [], // [{ y, label, color }] líneas horizontales en coordenadas de imagen
}) => {
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const calibDownRef = useRef(null); // clic de calibración en curso (para distinguirlo de un arrastre)

  // ... (maintain existing state)
  // Internal state for "Forced GSD" if bladeLength is provided
  // If localPixelScale is provided, use it for measurements. Else fallback to global.
  const [activePixelScale, setActivePixelScale] = useState(pixelScale); // Used for RULER/POSITION
  const [measurementPixelScale, setMeasurementPixelScale] = useState(
    localPixelScale || pixelScale
  ); // Used for AREA/DIMS

  // Update active scale when props change
  useEffect(() => {
    setActivePixelScale(pixelScale);
  }, [pixelScale]);

  // Update measurement scale
  useEffect(() => {
    setMeasurementPixelScale(localPixelScale || pixelScale);
  }, [localPixelScale, pixelScale]);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Tool State
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 }); // Image coordinates
  const [currentPolygon, setCurrentPolygon] = useState([]); // Points for the polygon currently being drawn
  const [draggedPointInfo, setDraggedPointInfo] = useState(null); // { polyIndex, pointIndex }

  // --- Handlers ---
  const getLocalCoords = (e) => {
    if (!containerRef.current || !imageRef.current) return { x: 0, y: 0 };

    // Robust math for Transformed Image (Translate -> Scale -> Rotate)

    // 1. Mouse relative to Container
    const cRect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - cRect.left;
    const my = e.clientY - cRect.top;

    // 2. Center of Container (which is Transform Origin)
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
    const rad = -(rotation * Math.PI) / 180;
    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);

    // 7. Map to Image Coordinates (Origin at TopLeft)
    // The image was centered, so its coordinate system has (0,0) at center.
    // TopLeft is at (-w/2, -h/2).
    // ImageX = RotatedX - (-w/2) = RotatedX + w/2
    const imgW = imageRef.current.naturalWidth;
    const imgH = imageRef.current.naturalHeight;

    return {
      x: rx + imgW / 2,
      y: ry + imgH / 2,
    };
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;

    if (toolMode === "none") {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    } else if (toolMode === "calibrate") {
      calibDownRef.current = { x: e.clientX, y: e.clientY, coords: getLocalCoords(e) };
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    } else if (toolMode === "area") {
      if (draggedPointInfo !== null) return;
      const coords = getLocalCoords(e);
      if (currentPolygon.length < 4) {
        const newPoly = [...currentPolygon, coords];
        if (newPoly.length === 4) {
          onPolygonsChange([...polygons, newPoly]);
          setCurrentPolygon([]);
        } else {
          setCurrentPolygon(newPoly);
        }
      }
    }
  };

  const handleMouseMove = (e) => {
    e.preventDefault();
    if (toolMode === "crosshair" || toolMode === "none") {
      setCursorPos(getLocalCoords(e));
    }
    if (isDragging && (toolMode === "none" || toolMode === "calibrate")) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
    if (toolMode === "area") {
      const coords = getLocalCoords(e);
      setCursorPos(coords);
      if (draggedPointInfo !== null) {
        const { polyIndex, pointIndex } = draggedPointInfo;
        if (polyIndex === -1) {
          setCurrentPolygon((prev) => {
            const newPts = [...prev];
            newPts[pointIndex] = coords;
            return newPts;
          });
        } else {
          const newPolys = [...polygons];
          const newPts = [...newPolys[polyIndex]];
          newPts[pointIndex] = coords;
          newPolys[polyIndex] = newPts;
          onPolygonsChange(newPolys);
        }
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggedPointInfo(null);
  };

  // Soltar el botón: en modo calibrar, un clic sin arrastre registra el punto
  const handleContainerMouseUp = (e) => {
    if (toolMode === "calibrate" && calibDownRef.current) {
      const down = calibDownRef.current;
      calibDownRef.current = null;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < 4) {
        onCalibrationClick?.(down.coords);
      }
    }
    handleMouseUp();
  };

  // Global MouseUp to prevent stuck drag
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setDraggedPointInfo(null);
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, []);

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

  // Helper: Get Global Y in Meters
  const getGlobalY = (localY) => {
    if (!activePixelScale) return 0;

    // We need to account for Rotation in the "Global Y" calculation?
    // User requirement: "Calibration... Reference Points...".
    // We already aligned the image vertically via rotation.
    // So 'localY' (Image Y) roughly corresponds to the Axis?
    // If we rotated 90 degrees, Image X might be the Axis.
    // BUT we assume the rotation aligns the Blade Axis to VERTICAL.
    // So Y in the image space is the text-book definition of "Distance along blade".
    // UNLESS the blade was horizontal (Tip.x >> Root.x) and we rotated it to be vertical.
    // In that case, after rotation, the Y-axis *of the screen* aligns with the blade.
    // Does 'getLocalCoords' return coordinates in *Original Image Space*? YES.
    // If the original image had blade horizontal, and we rotated it, then traversing Screen Y
    // corresponds to traversing Image X (roughly).
    // So 'localY' returned by getLocalCoords is NOT necessarily the metric axis if the image was sideways.

    // If we rely on the parent logic `globalStartMeters`, it assumed Vertical Stacking.
    // If we have full 2D calibration, we should probably project the point onto the Axis?
    // "Precision: Coordenada TIP debe coincidir con N mm".
    //
    // Let's assume standard "Vertical" drone shots for now, where rotation is small correction.
    // In that case, localY is fine.

    const gsdMeters = activePixelScale / 1000;
    const startVal =
      globalStartMeters !== null && globalStartMeters !== undefined
        ? globalStartMeters
        : bladeLength || 50;

    // Standard: Distance down from start (Root or Top)
    // If decreasing meters: Start - dist
    // If increasing meters (RootToTip): Start + dist

    const distDownMeters = localY * gsdMeters;

    if (isRootToTip) {
      return startVal + distDownMeters;
    } else {
      return startVal - distDownMeters;
    }
  };

  // Wheel Zoom
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

  const handleImageLoad = () => {
    if (!containerRef.current || !imageRef.current) return;
    const containerW = containerRef.current.clientWidth;
    const containerH = containerRef.current.clientHeight;
    const imgW = imageRef.current.naturalWidth;
    const imgH = imageRef.current.naturalHeight;
    if (imgW && imgH) {
      const scaleW = containerW / imgW;
      const scaleH = containerH / imgH;
      const fitScale = Math.min(scaleW, scaleH, 1) * 0.9;
      if (onImageLoad) onImageLoad({ width: imgW, height: imgH, fitScale });
      if (bladeLength) {
        const forcedGSD = (bladeLength * 1000) / imgH; // Rough fallback
        setActivePixelScale(forcedGSD);
      }
      if (zoom === 1) {
        setZoom(fitScale);
        setPan({ x: 0, y: 0 });
      }
    }
  };

  useEffect(() => {
    onPolygonsChange([]);
    setCurrentPolygon([]);
    if (imageRef.current && imageRef.current.complete) handleImageLoad();
  }, [imageUrl]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-black select-none flex items-center justify-center ${
        toolMode === "none" ? "cursor-move" : "cursor-crosshair"
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleContainerMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Fixed Ruler Overlay - Scales with Pan/Zoom logic internally */}
      <VirtualBladeRuler
        containerRef={containerRef}
        pan={pan}
        zoom={zoom}
        pixelScale={activePixelScale} // mm/px
        showRuler={showRuler}
        // ALWAYS use calculated global Y (calibrated) for consistency with crosshair
        currentRadius={getGlobalY(imageRef.current ? imageRef.current.naturalHeight / 2 : 0)} 
        isTipAtTop={!isRootToTip}
      />

      <div
        className="relative inline-block origin-center will-change-transform"
        style={{
          // Apply Translation (Pan), then Scale, then Rotation
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
          transformOrigin: "center center",
          transition: isDragging ? "none" : "transform 0.1s ease-out",
        }}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Blade Inspection"
          className="pointer-events-none block max-w-none"
          draggable={false}
          style={filterStyle}
          onLoad={handleImageLoad}
        />

        {/* Marcas de calibración (punta / raíz) */}
        {markers.map((m, idx) => (
          <div
            key={idx}
            className="absolute left-0 w-full pointer-events-none"
            style={{
              top: m.y,
              height: 0,
              borderTop: `${Math.max(1, 2 / zoom)}px dashed ${m.color}`,
            }}
          >
            <span
              className="absolute whitespace-nowrap rounded bg-black/70 px-1.5 font-bold"
              style={{
                left: 8 / zoom,
                top: -24 / zoom,
                fontSize: `${14 / zoom}px`,
                lineHeight: 1.4,
                color: m.color,
              }}
            >
              {m.label}
            </span>
          </div>
        ))}

        {/* Detections Layer */}
        {detections.map((det, idx) => {
             const [x1, y1, x2, y2] = det.bbox;
             const colorMap = {
                 "Cat 1": "#10B981", "1": "#10B981",
                 "Cat 2": "#84CC16", "2": "#84CC16",
                 "Cat 3": "#F59E0B", "3": "#F59E0B",
                 "Cat 4": "#F97316", "4": "#F97316",
                 "Cat 5": "#EF4444", "5": "#EF4444"
             };
             const color = colorMap[det.severity] || "#EF4444";
             
             return (
                 <div
                    key={idx}
                    className="absolute pointer-events-none border-2"
                    style={{
                        left: x1,
                        top: y1,
                        width: x2 - x1,
                        height: y2 - y1,
                        borderColor: color,
                        borderWidth: `${2 / zoom}px`,
                    }}
                 >
                     {/* Label with Metrics */}
                     <div 
                         className="absolute -top-6 left-0 bg-black/70 text-white text-[10px] px-1 rounded whitespace-nowrap"
                         style={{ transform: `scale(${1/zoom})`, transformOrigin: "bottom left" }}
                     >
                         <span className="font-bold">{det.severity}</span>
                         {det.width_mm && (
                             <span className="ml-1 text-gray-300">
                                 W:{Math.round(det.width_mm)}mm L:{Math.round(det.length_mm)}mm
                             </span>
                         )}
                     </div>
                 </div>
             );
        })}

        {toolMode === "crosshair" && (
          <>
            <div
              className="absolute w-full border-t border-cyan-400 pointer-events-none"
              style={{
                top: cursorPos.y,
                left: 0,
                borderWidth: `${1 / zoom}px`,
                opacity: 0.8,
                transform: "translateY(-50%)",
              }}
            />
            <div
              className="absolute h-full border-l border-cyan-400 pointer-events-none"
              style={{
                left: cursorPos.x,
                top: 0,
                borderWidth: `${1 / zoom}px`,
                opacity: 0.8,
                transform: "translateX(-50%)",
              }}
            />
            <div
              className="absolute bg-black/80 text-white rounded pointer-events-none whitespace-nowrap z-50 shadow-sm"
              style={{
                left: cursorPos.x + 15 / zoom,
                top: cursorPos.y + 15 / zoom,
                fontSize: `${Math.max(10, 12 / zoom)}px`,
                padding: `${2 / zoom}px ${4 / zoom}px`,
              }}
            >
              <span className="font-mono text-cyan-400 font-bold">R:</span>{" "}
              {/* Show ONLY mm as requested */}
              {(getGlobalY(cursorPos.y) * 1000).toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}{" "}
              mm
            </div>
          </>
        )}

        {toolMode === "area" && (
          <>
            {polygons.map((poly, polyIdx) => (
              <React.Fragment key={polyIdx}>
                {poly.map((pt, ptIdx) => (
                  <div
                    key={ptIdx}
                    className={`absolute rounded-full border border-black shadow-sm ${
                      draggedPointInfo?.polyIndex === polyIdx &&
                      draggedPointInfo?.pointIndex === ptIdx
                        ? "bg-yellow-400 scale-125"
                        : "bg-cyan-400"
                    } cursor-pointer hover:bg-yellow-200`}
                    style={{
                      left: pt.x,
                      top: pt.y,
                      width: `${8 / zoom}px`,
                      height: `${8 / zoom}px`,
                      transform: "translate(-50%, -50%)",
                      pointerEvents: "auto",
                      zIndex: 60,
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      if (e.button === 0)
                        setDraggedPointInfo({
                          polyIndex: polyIdx,
                          pointIndex: ptIdx,
                        });
                    }}
                  />
                ))}

                {(() => {
                  const pathStr =
                    poly
                      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
                      .join(" ") + " Z";
                  return (
                    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible">
                      <path
                        d={pathStr}
                        fill="rgba(34, 211, 238, 0.2)"
                        stroke="#22d3ee"
                        strokeWidth={2 / zoom}
                      />
                    </svg>
                  );
                })()}

                {(() => {
                  const hull = poly;
                  const areaPx = getPolygonArea(hull);
                  const gsd = measurementPixelScale || 0;
                  const areaMm = areaPx * (gsd * gsd);

                  let minX = Infinity,
                    maxX = -Infinity,
                    minY = Infinity,
                    maxY = -Infinity;
                  hull.forEach((p) => {
                    if (p.x < minX) minX = p.x;
                    if (p.x > maxX) maxX = p.x;
                    if (p.y < minY) minY = p.y;
                    if (p.y > maxY) maxY = p.y;
                  });
                  const widthMm = (maxX - minX) * gsd;
                  const heightMm = (maxY - minY) * gsd;

                  return (
                    <div
                      className="absolute bg-black/90 text-white rounded pointer-events-none whitespace-nowrap z-50 shadow-xl flex flex-col items-start border border-cyan-500/50"
                      style={{
                        left: maxX + 20 / zoom,
                        top: minY,
                        fontSize: `${Math.max(12, 16 / zoom)}px`,
                        padding: `${8 / zoom}px ${12 / zoom}px`,
                      }}
                    >
                      <div className="font-mono text-cyan-400 font-bold mb-1 border-b border-gray-700 w-full pb-1">
                        A:{" "}
                        {areaMm.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}{" "}
                        mm²
                      </div>
                      <div className="text-gray-300 font-mono text-[0.9em]">
                        H:{" "}
                        {heightMm.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}{" "}
                        mm
                      </div>
                      <div className="text-gray-300 font-mono text-[0.9em]">
                        W:{" "}
                        {widthMm.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}{" "}
                        mm
                      </div>
                    </div>
                  );
                })()}
              </React.Fragment>
            ))}

            {/* Current Polygon (Drawing) */}
            {currentPolygon.map((pt, ptIdx) => (
              <div
                key={`curr-${ptIdx}`}
                className="absolute bg-white/50 rounded-full border border-white"
                style={{
                  left: pt.x,
                  top: pt.y,
                  width: `${6 / zoom}px`,
                  height: `${6 / zoom}px`,
                  transform: "translate(-50%, -50%)",
                }}
              />
            ))}
            {currentPolygon.length > 0 && (
              <svg className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible">
                <path
                  d={
                    currentPolygon
                      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
                      .join(" ") +
                    (currentPolygon.length > 0
                      ? ` L ${cursorPos.x} ${cursorPos.y}`
                      : "")
                  }
                  fill="none"
                  stroke="white"
                  strokeWidth={1 / zoom}
                  strokeDasharray="4 4"
                />
              </svg>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BladeInspectionViewer;
