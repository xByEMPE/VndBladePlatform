import React, { useMemo, useState, useEffect } from "react";

const VirtualBladeRuler = ({
  containerRef, // To measure viewport height
  pan,          // {x, y} screen offset (screen pixels)
  zoom,         // Scale factor
  pixelScale,   // mm/px (GSD)
  currentRadius,// meters (at center of image)
  isTipAtTop = true,
  showRuler = true,
}) => {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef?.current) return;
    const ro = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [containerRef]);

  const rulerData = useMemo(() => {
    if (
      !showRuler ||
      !pixelScale ||
      currentRadius === undefined ||
      currentRadius === null ||
      containerSize.height === 0
    ) {
      return null;
    }

    // Physics Constants
    const mPerPx = pixelScale / 1000.0;
    const sign = isTipAtTop ? 1 : -1;
    
    // Screen Center Y (where currentRadius is located, plus Pan)
    // The "Image Center" is at: (ContainerH / 2) + pan.y
    const screenCenterY = (containerSize.height / 2) + pan.y;

    // Radius at Screen Y:
    // r(y) = centerR + sign * (dy_image) * mPerPx
    // screenY = screenCenterY + dy_screen
    // dy_screen = dy_image * zoom
    // dy_image = (screenY - screenCenterY) / zoom
    
    const getRadius = (sy) => {
        const dy_screen = sy - screenCenterY;
        const dy_image = dy_screen / zoom;
        return currentRadius + sign * (-dy_image) * mPerPx; 
        // Note: Y increases down. 
        // If TipAtTop (sign=1). Moving down (dy>0) -> Radius should DECREASE.
        // So we subtract distance. 
        // Logic: Radius(y) = Center - (y - CenterY)*mPerPx
        // Wait previously: radiusAtCenter + sign * (centerY - y) ...
        // (centerY - y) is -dy.
        // So yes: center + sign * (-dy).
    };

    const getScreenY = (r) => {
        // r = c - s*d*m
        // s*d*m = c - r
        // d = (c - r) / (s*m)
        // d is dist in pixels (unscaled).
        const d_image = (currentRadius - r) / (sign * mPerPx);
        return screenCenterY + (d_image * zoom); // Y positive down
    };

    // Range visible on screen
    const rTop = getRadius(0);
    const rBot = getRadius(containerSize.height);
    
    const maxR = Math.max(rTop, rBot);
    const minR = Math.min(rTop, rBot);

    // Dynamic Level of Detail (LOD)
    // Target ~80 screen pixels
    // Delta Meters for 80px = (80 / zoom) * mPerPx
    const targetStepM = (80 / zoom) * mPerPx;

    const exponent = Math.floor(Math.log10(targetStepM));
    const magnitude = Math.pow(10, exponent); 
    const residual = targetStepM / magnitude; 

    let step = magnitude;
    if (residual > 5) step = 10 * magnitude;
    else if (residual > 2) step = 5 * magnitude;
    else if (residual > 1) step = 2 * magnitude;

    // Generate Ticks
    const startTick = Math.ceil(minR / step) * step;
    const endTick = Math.floor(maxR / step) * step;

    const ticks = [];
    for (let r = startTick; r <= endTick + step / 10000; r += step) {
      const y = getScreenY(r);
      if (y >= -50 && y <= containerSize.height + 50) {
        ticks.push({
          y,
          value: r,
          isMajor: true, 
        });
      }
    }

    return { ticks, step };
  }, [containerSize, pan, zoom, pixelScale, currentRadius, isTipAtTop, showRuler]);

  if (!rulerData) return null;

  // Fixed Visual Sizes (Since this component is now outside the transform container)
  // We want standard size at all times (Screen Pixels)
  const tickHeight = 2; // 2px thickness
  const fontSize = 14;  // 14px font (Increased visibility)
  const tickLength = 15; 
  const majorTickLength = 30;
  const textLeft = 8;

  return (
    <div className="absolute inset-y-0 left-0 w-full pointer-events-none z-20">
      {rulerData.ticks.map((tick, i) => (
        <div
          key={i}
          className="absolute left-0 flex items-center"
          style={{ 
              top: tick.y, 
              width: "100%", 
              transform: "translateY(-50%)" 
          }}
        >
          {/* Tick Line */}
          <div
            style={{
              width: `${tick.isMajor ? majorTickLength : tickLength}px`,
              height: `${tickHeight}px`,
              backgroundColor: "rgba(255, 220, 0, 0.9)", // Yellow
              boxShadow: `0 1px 2px rgba(0,0,0,0.5)`,
            }}
          />
          
          {/* Label - Always show since density is controlled */}
          <span
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: 1,
              marginLeft: `${textLeft}px`,
              color: "#fbbf24", // Yellow-400
              fontFamily: "monospace",
              fontWeight: "bold",
              textShadow: "0.5px 0.5px 1px rgba(0,0,0,1)", // Sharp shadow
              pointerEvents: 'none',
              userSelect: 'none'
            }}
          >
            {(tick.value * 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} mm
          </span>
        </div>
      ))}
    </div>
  );
};

export default VirtualBladeRuler;
