import React from "react";
import { tx } from "@/i18n/tx";
import VirtualBladeRuler from "@/components/VirtualBladeRuler";

export const ImageStage = ({ t, zoom, pan, isDragging, setIsDragging, showLayers, editingDetection, detections, showMeasurementRulers, toolMode, cursorPos, polygons, currentPolygon, draggedPointInfo, setDraggedPointInfo, resizingBox, setResizingBox, setInitialBoxState, compareImage, imageSrc, imageAlt, currentImage, section, getSectionLabel, imageRef, containerRef, centerRadiusMeters, getGlobalY, selectedDamageId, getPolygonArea, getLocalCoords, handleMouseDown, handleMouseMove, handleMouseUp, handleTouchStart, handleTouchMove, handleTouchEnd, handleImageLoad }) => (
  <div className={`relative overflow-hidden bg-surface-base border-r border-line-subtle ${compareImage ? "w-1/2" : "w-full"}`}>
    {compareImage && (
      <div className="absolute top-2 right-2 z-10 bg-status-progress/90 text-surface-base text-xs px-2 py-1 rounded shadow-lg">
          {t("common.principal")} ({getSectionLabel(section)})
      </div>
    )}
    <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
        cursor: toolMode === 'area' ? 'crosshair' : 
                toolMode === 'crosshair' ? 'none' :
                resizingBox ? 'move' : 
                (isDragging ? 'grabbing' : 'grab'),
        touchAction: "none",
        userSelect: "none",
        position: "relative",
        }}
    >
        {/* VirtualBladeRuler */}
        {showMeasurementRulers && imageRef.current && (
        <VirtualBladeRuler
            containerRef={containerRef}
            pan={pan}
            zoom={zoom}
            pixelScale={currentImage?.raw_metadata?.Calculated_GSD_mm_px || 1}
            currentRadius={centerRadiusMeters}
            showRuler={showMeasurementRulers}
            isTipAtTop={true}  // <-- SIEMPRE TRUE PARA FORZAR EL DESCENSO VISUAL
        />
        )}

        {/* Transformed Container */}
        <div
        className="relative inline-block origin-center will-change-transform"
        style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${currentImage?.metadata?.rotation || 0}deg)`,
            transformOrigin: "center center",
            transition: isDragging ? "none" : "transform 0.1s ease-out",
        }}
        >
            {/* Image */}
            <img
            ref={imageRef}
            src={imageSrc}
            alt={imageAlt}
            className="pointer-events-none block max-w-none"
            draggable={false}
            onLoad={handleImageLoad}
            />

            {/* Bounding Boxes */}
            {showLayers && imageRef.current && detections.map((detection) => {
            const [nx, ny, nw, nh] = detection.bbox;
            const img = imageRef.current;
            const x = nx * img.naturalWidth;
            const y = ny * img.naturalHeight;
            const w = nw * img.naturalWidth;
            const h = nh * img.naturalHeight;
            const isEditing = editingDetection?.id === detection.id;
            const isSelected = selectedDamageId !== null && String(selectedDamageId) === String(detection.id);

            // Colores de severidad del Design System (--sev-N en index.css)
            const colors = {
                "Cat 1": "hsl(var(--sev-1))",
                "Cat 2": "hsl(var(--sev-2))",
                "Cat 3": "hsl(var(--sev-3))",
                "Cat 4": "hsl(var(--sev-4))",
                "Cat 5": "hsl(var(--sev-5))",
            };
            const color = colors[detection.severity] || "hsl(var(--ink-muted))";

            return (
                <div
                key={detection.id}
                className="absolute pointer-events-none"
                style={{
                    left: x,
                    top: y,
                    width: w,
                    height: h,
                }}
                >
                {/* Box Border */}
                <div
                    className="absolute inset-0"
                    style={{
                    border: `${(isEditing || isSelected ? 4 : 3) / zoom}px solid white`,
                    boxShadow: `inset 0 0 0 ${(isEditing || isSelected ? 3 : 2) / zoom}px ${color}`,
                    opacity: selectedDamageId !== null && !isSelected && !isEditing ? 0.65 : 1,
                    }}
                />

                {/* Center Dot (when not editing) */}
                {!isEditing && (
                    <div
                    className="absolute"
                    style={{
                        left: '50%',
                        top: '50%',
                        width: `${6 / zoom}px`,
                        height: `${6 / zoom}px`,
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: 'white',
                        border: `${2 / zoom}px solid ${color}`,
                        borderRadius: '50%',
                    }}
                    />
                )}

                {/* Resize Handles (when editing) */}
                {isEditing && (
                    <>
                    {['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'].map((handle) => {
                        const positions = {
                        nw: { left: 0, top: 0 },
                        ne: { right: 0, top: 0 },
                        sw: { left: 0, bottom: 0 },
                        se: { right: 0, bottom: 0 },
                        n: { left: '50%', top: 0, transform: 'translateX(-50%)' },
                        s: { left: '50%', bottom: 0, transform: 'translateX(-50%)' },
                        w: { left: 0, top: '50%', transform: 'translateY(-50%)' },
                        e: { right: 0, top: '50%', transform: 'translateY(-50%)' },
                        };

                        return (
                        <div
                            key={handle}
                            className="absolute pointer-events-auto cursor-move"
                            style={{
                            ...positions[handle],
                            width: `${10 / zoom}px`,
                            height: `${10 / zoom}px`,
                            backgroundColor: 'white',
                            border: `${3 / zoom}px solid ${color}`,
                            borderRadius: '50%',
                            }}
                            onMouseDown={(e) => {
                            e.stopPropagation();
                            setResizingBox({ detectionId: detection.id, handle });
                            setInitialBoxState({ bbox: [...detection.bbox], mouseStart: getLocalCoords(e) });
                            setIsDragging(true);
                            }}
                        />
                        );
                    })}
                    </>
                )}

                {/* Label */}
                <div
                    className="absolute pointer-events-none"
                    style={{
                    left: 0,
                    bottom: '100%',
                    marginBottom: `${4 / zoom}px`,
                    backgroundColor: color,
                    color: 'white',
                    padding: `${4 / zoom}px ${8 / zoom}px`,
                    fontSize: `${(isEditing ? 14 : 12) / zoom}px`,
                    fontWeight: 'bold',
                    borderRadius: `${2 / zoom}px`,
                    whiteSpace: 'nowrap',
                    }}
                >
                    {detection.severity} ({(detection.confidence * 100).toFixed(1)}%)
                </div>
                </div>
            );
            })}

            {/* Crosshair Tool */}
            {toolMode === "crosshair" && (
            <>
                <div
                className="absolute w-full border-t border-info pointer-events-none"
                style={{
                    top: cursorPos.y,
                    left: 0,
                    borderWidth: `${1 / zoom}px`,
                    opacity: 0.8,
                    transform: "translateY(-50%)",
                }}
                />
                <div
                className="absolute h-full border-l border-info pointer-events-none"
                style={{
                    left: cursorPos.x,
                    top: 0,
                    borderWidth: `${1 / zoom}px`,
                    opacity: 0.8,
                    transform: "translateX(-50%)",
                }}
                />
                <div
                className="absolute bg-surface-base/80 text-ink rounded pointer-events-none whitespace-nowrap z-50 shadow-sm"
                style={{
                    left: cursorPos.x + 15 / zoom,
                    top: cursorPos.y + 15 / zoom,
                    fontSize: `${Math.max(10, 12 / zoom)}px`,
                    padding: `${2 / zoom}px ${4 / zoom}px`,
                }}
                >
                <span className="font-mono text-info font-bold">R:</span>{" "}
                {(getGlobalY(cursorPos.y) * 1000).toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                })}{" "}
                mm
                </div>
            </>
            )}

            {/* Area Tool (Polygon) */}
            {toolMode === "area" && (
            <>
                {polygons.map((poly, polyIdx) => (
                <React.Fragment key={polyIdx}>
                    {poly.map((pt, ptIdx) => (
                    <div
                        key={ptIdx}
                        className={`absolute rounded-full border border-surface-base shadow-sm ${
                                    draggedPointInfo?.polyIndex === polyIdx && draggedPointInfo?.pointIndex === ptIdx
                                    ? "bg-brand scale-125" : "bg-info"
                                } cursor-pointer hover:bg-brand`}
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
                            if (e.button === 0) {
                                setDraggedPointInfo({ polyIndex: polyIdx, pointIndex: ptIdx });
                            }
                        }}
                    />
                    ))}
                    {/* Polygon Path */}
                    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible">
                        <path
                            d={poly.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z"}
                            style={{ fill: "hsl(var(--info) / 0.2)", stroke: "hsl(var(--info))" }}
                            strokeWidth={2 / zoom}
                        />
                    </svg>
                    {/* Label */}
                    {(() => {
                    const areaPx = getPolygonArea(poly);
                    const gsdVal = currentImage?.raw_metadata?.Calculated_GSD_mm_px || 1;
                    const areaMm = areaPx * (gsdVal * gsdVal);

                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    poly.forEach(p => {
                        if(p.x < minX) minX = p.x; if(p.y < minY) minY = p.y;
                        if(p.x > maxX) maxX = p.x; if(p.y > maxY) maxY = p.y;
                    });
                    // Longitudinal (a lo largo de la pala, vertical) y transversal (horizontal) del recuadro, con la misma escala del área
                    const lengthMm = (maxY - minY) * gsdVal;
                    const widthMm = (maxX - minX) * gsdVal;

                    // La etiqueta va fuera del recuadro, a un costado: a la derecha y, si no cabe en el visor,
                    // a la izquierda; y alineada por abajo si arriba se saldría de la pantalla.
                    let labelSide = "right";
                    let labelAlign = "top";
                    const labelImg = imageRef.current;
                    const labelBox = containerRef.current;
                    if (labelImg && labelBox) {
                        const cx = labelBox.clientWidth / 2 + pan.x;
                        const cy = labelBox.clientHeight / 2 + pan.y;
                        const screenX = (x) => cx + (x - labelImg.naturalWidth / 2) * zoom;
                        const screenY = (y) => cy + (y - labelImg.naturalHeight / 2) * zoom;
                        const LABEL_W = 190, LABEL_H = 80; // tamaño aproximado en pantalla
                        const roomRight = labelBox.clientWidth - screenX(maxX);
                        const roomLeft = screenX(minX);
                        labelSide = roomRight >= LABEL_W || roomRight >= roomLeft ? "right" : "left";
                        labelAlign = screenY(minY) + LABEL_H > labelBox.clientHeight ? "bottom" : "top";
                    }

                    return (
                        <div
                        className="absolute bg-surface-base/90 text-ink rounded pointer-events-none whitespace-nowrap z-50 shadow-xl border border-info/50"
                        style={{
                            left: labelSide === "right" ? maxX + 10/zoom : minX - 10/zoom,
                            top: labelAlign === "top" ? minY : maxY,
                            transform: `translate(${labelSide === "right" ? "0" : "-100%"}, ${labelAlign === "top" ? "0" : "-100%"})`,
                            fontSize: `${12/zoom}px`,
                            lineHeight: 1.35,
                            padding: `${4/zoom}px ${6/zoom}px`,
                        }}
                        >
                        <div><span className="text-info">Longitudinal:</span> {lengthMm.toLocaleString(undefined, { maximumFractionDigits: 0 })} mm</div>
                        <div><span className="text-info">{tx("Transversal:")}</span> {widthMm.toLocaleString(undefined, { maximumFractionDigits: 0 })} mm</div>
                        <div><span className="text-info">{tx("Área:")}</span> {areaMm.toLocaleString(undefined, { maximumFractionDigits: 0 })} mm²</div>
                        </div>
                    );
                    })()}
                </React.Fragment>
                ))}
                {/* Measuring Poly */}
                {currentPolygon.map((pt, i) => (
                    <div key={i} className="absolute bg-white/50 rounded-full border border-white"
                        style={{
                            left: pt.x, top: pt.y, width: `${6/zoom}px`, height: `${6/zoom}px`,
                            transform: "translate(-50%, -50%)"
                        }}
                    />
                ))}
                <svg className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible">
                    <path
                        d={currentPolygon.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")}
                        fill="none"
                        stroke="#fff"
                        strokeDasharray="4 2"
                        strokeWidth={2 / zoom}
                    />
                </svg>
            </>
            )}
        </div>
    </div>
  </div>
);
