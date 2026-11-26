import { useTranslation } from "react-i18next";
import { tx } from "@/i18n/tx";
import React, { useRef, useEffect, useState } from "react";
import { severityHex, severityLabel } from "@/lib/severity";

/**
 * BladeModelViewer - Displays blade model with radial damage position markers
 */
const BladeModelViewer = ({ 
  bladeLength = 50, 
  damages = [], 
  currentDamageId = null,
  onDamageClick // Default undefined so we can check for existence
}) => {
  useTranslation();
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [imageHeight, setImageHeight] = useState(0);

  // DEBUG: Check what damages are being received
  useEffect(() => {
    console.log("[BladeModelViewer] Received damages:", damages);
    const valid = damages.filter(d => {
        const r = d.radio || d.my_matrix_r || d.r_meters;
        return r !== null && r !== undefined && !isNaN(parseFloat(r));
    });
    console.log("[BladeModelViewer] Valid damages with radio:", valid);
  }, [damages]);

  // Escala de severidad compartida (src/lib/severity.js). Sin severidad se asume Cat 3, como antes.
  const normalizeSeverity = (severity) => severityLabel(severity || 3) || `Cat ${severity}`;
  const getSeverityColor = (severity) => severityHex(severity || 3);

  // Update height when image loads or resizes
  const handleImageLoad = (e) => {
    const height = e.target.clientHeight;
    setImageHeight(height);
  };

  useEffect(() => {
    if (!imgRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === imgRef.current) {
          // Use contentRect for precise dimensions
          setImageHeight(entry.contentRect.height);
        }
      }
    });

    resizeObserver.observe(imgRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  /**
   * Calculate Y position for damage marker
   * Radio: 0m (root/base) to bladeLength (tip/top)
   * 
   * Calibrated red line positions (measured from actual bladeModel.png):
   * - Top red line (tip): 32px at 4.02% from top
   * - Bottom red line (root): 705px at 96.67% from top
   */
  const calculateYPosition = (radioMeters) => {
    if (!imageHeight || !bladeLength) return 0;

    // Red line positions as percentage of image height (calibrated)
    const tipPercent = 0.0402;    // Top red line (tip) - measured
    const rootPercent = 0.9667;   // Bottom red line (root) - measured
    
    const tipY = imageHeight * tipPercent;
    const rootY = imageHeight * rootPercent;
    const usableHeight = rootY - tipY;

    // Normalize radio to 0-1 range
    // radioMeters can sometimes exceed bladeLength slightly due to GPS inaccuracies, clamp it?
    // For visualization let's clamp it to visible range 0-1.05 to avoid markers flying off too far
    const clampedRadio = Math.max(0, Math.min(radioMeters, bladeLength * 1.05));
    const normalizedPosition = clampedRadio / bladeLength;
    
    // Map: radio=0 (root) -> rootY (bottom), radio=bladeLength (tip) -> tipY (top)
    const yPos = rootY - (normalizedPosition * usableHeight);

    return yPos;
  };

  // Filter valid damages with radio information
  const validDamages = damages.filter(d => {
    const radio = d.radio || d.my_matrix_r || d.r_meters;
    return radio !== null && radio !== undefined && !isNaN(parseFloat(radio));
  });

  // Render ruler ticks
  const renderRuler = () => {
    if (!imageHeight || !bladeLength) return null;

    const ticks = [];
    // Determine step size based on blade length to avoid clutter
    const step = bladeLength > 40 ? 5 : (bladeLength > 20 ? 2 : 1); 
    const minorStep = 1;

    for (let r = 0; r <= Math.ceil(bladeLength); r += minorStep) {
      if (r > bladeLength && r - bladeLength > 1) continue;
      
      const y = calculateYPosition(r);
      const isMajor = r % step === 0 || r === 0 || Math.abs(r - bladeLength) < 0.1;
      
      // Filter ticks too close to ends if they overlap heavily
      if (r !== 0 && r < 1 && Math.abs(calculateYPosition(0) - y) < 8) continue;
      
      ticks.push(
        <div 
          key={`ruler-${r}`} 
          className="absolute right-0 flex items-center justify-end pointer-events-none" 
          style={{ 
            top: `${y}px`, 
            width: "60px", // Increased width for larger text
            transform: "translateY(-50%)" 
          }}
        >
          {isMajor && (
            <span className="text-xs font-bold text-slate-300 mr-1 font-mono tabular-nums text-shadow-sm select-none">
              {r}m
            </span>
          )}
          <div 
            className={`bg-slate-400 ${isMajor ? "w-4 h-0.5" : "w-2 h-[1px]"}`} 
            style={{ opacity: isMajor ? 0.9 : 0.5 }}
          />
        </div>
      );
    }
    return ticks;
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-slate-900 flex items-center justify-center overflow-x-hidden" // Changed overflow-hidden to overflow-x-hidden just in case vertical needs space, but mainly keeps container clean.
      style={{ minHeight: "400px" }}
    >
      <div className="relative h-full flex justify-center w-full"> {/* Added w-full to ensure centering works relative to full width */}
        {/* Ruler Container - Positioned absolutely on the left of the container, inside padding */}
        <div 
          className="absolute left-2 top-0 bottom-0 w-16 flex flex-col pointer-events-none z-10"
          // Removed negative transform that pushed it off-screen
        >
          {renderRuler()}
        </div>

        {/* Blade Model Image */}
        <img
          ref={imgRef}
          src="/icons/bladeModel.png"
          alt="Blade Model"
          className="h-full max-h-full object-contain z-0"
          onLoad={handleImageLoad}
        />

        {/* Red Line Indicators (Visual Reference) */}
        {imageHeight > 0 && (
          <>
            {/* Tip Line */}
            <div 
              className="absolute left-[-10px] right-[-10px] border-t border-red-500/30 border-dashed pointer-events-none"
              style={{ top: imageHeight * 0.0402 }}
            />
            {/* Root Line */}
            <div 
              className="absolute left-[-10px] right-[-10px] border-t border-red-500/30 border-dashed pointer-events-none"
              style={{ top: imageHeight * 0.9667 }}
            />
          </>
        )}

        {/* Damage Position Markers */}
        {imageHeight > 0 && validDamages.map((damage) => {
          const radio = parseFloat(damage.radio || damage.my_matrix_r || damage.r_meters || 0);
          const yPosition = calculateYPosition(radio);
          const isSelected = damage.id === currentDamageId;
          const color = getSeverityColor(damage.severity);

          return (
            <div
              key={damage.id}
              className={`absolute transition-all duration-200 hover:scale-125 z-10 ${onDamageClick ? 'cursor-pointer' : 'cursor-default'}`}
              style={{
                left: "55%", // Slightly offset to right to not cover center line
                top: `${yPosition}px`,
                transform: "translate(-50%, -50%)",
                zIndex: isSelected ? 20 : 10,
              }}
              onClick={() => onDamageClick && onDamageClick(damage.id)}
              title={tx("{{severity}} - Radio: {{mm}}mm", { severity: normalizeSeverity(damage.severity), mm: (radio * 1000).toFixed(0) })}
            >
              {/* Outer glow ring for selected damage */}
              {isSelected && (
                <div
                  className="absolute rounded-full animate-pulse"
                  style={{
                    width: "24px",
                    height: "24px",
                    backgroundColor: color,
                    opacity: 0.3,
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                  }}
                />
              )}
              
              {/* Main marker dot */}
              <div
                className="rounded-full border-2 border-white shadow-lg"
                style={{
                  width: isSelected ? "16px" : "12px",
                  height: isSelected ? "16px" : "12px",
                  backgroundColor: color,
                  boxShadow: isSelected 
                    ? `0 0 12px ${color}, 0 0 24px ${color}40`
                    : `0 2px 8px rgba(0,0,0,0.5)`,
                }}
              />

              {/* Horizontal line extending to the right */}
              <div
                className="absolute"
                style={{
                  left: isSelected ? "8px" : "6px",
                  top: "50%",
                  width: "20px",
                  height: "2px",
                  backgroundColor: color,
                  opacity: 0.6,
                  transform: "translateY(-50%)",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Info overlay */}
      {validDamages.length > 0 && (
        <div className="absolute top-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded z-30 pointer-events-none">
          {validDamages.length} radio{validDamages.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default BladeModelViewer;
