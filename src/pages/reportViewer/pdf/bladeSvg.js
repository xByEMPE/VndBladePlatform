// === UTILIDAD: Carga blade.svg, dibuja dot de daño en canvas, retorna dataURL ===
export const drawBladeSvgWithDot = (radiusMeters, bladeLength, severityColor) => {
  return new Promise((resolve) => {
    const W = 600;
    const H = 160;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    // Fondo blanco
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // Lógica para colocar el punto basada en los márgenes
    const drawDotAndResolve = (padL, padR) => {
      const bladeStartX = padL;
      const bladeEndX = W - padR;
      const bladeW = bladeEndX - bladeStartX;

      const bl = bladeLength > 0 ? bladeLength : 50;
      const clampedR = Math.max(0, Math.min(radiusMeters, bl));
      const fraction = clampedR / bl;

      const dotX = bladeStartX + fraction * bladeW;
      const dotY = H / 2;

      // Línea indicadora vertical
      ctx.beginPath();
      ctx.moveTo(dotX, dotY + 25);
      ctx.lineTo(dotX, dotY - 25);
      ctx.strokeStyle = severityColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Dot de severidad
      ctx.beginPath();
      ctx.arc(dotX, dotY, 12, 0, Math.PI * 2);
      ctx.fillStyle = severityColor;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Etiquetas ROOT / TIP (Solo si tu SVG no las tiene integradas)
      ctx.fillStyle = "#444444";
      ctx.font = "bold 13px Arial";
      ctx.textAlign = "center";
      ctx.fillText("ROOT", padL, H - 8);
      ctx.fillText("TIP", W - padR, H - 8);

      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };

    // 1. Intentamos cargar tu archivo SVG local
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Dibuja tu SVG en todo el canvas
      ctx.drawImage(img, 0, 0, W, H);
      // PAD_L y PAD_R dependen de cuánto margen vacío tenga tu SVG por dentro.
      // Puedes ajustar estos números (por ej. 25, 25) si el punto no llega exactamente a las puntas.
      drawDotAndResolve(25, 25);
    };

    // 2. Si falla la carga del SVG (ruta mala o problema de red), usamos el fallback
    img.onerror = () => {
      console.warn(
        "[drawBladeSvgWithDot] No se pudo cargar /icons/blade.svg. Usando silueta fallback.",
      );
      const midY = H / 2;
      const rootHalfH = 52;
      const tipHalfH = 4;
      const PAD_L = 44;
      const PAD_R = 32;
      const bladeStartX = PAD_L;
      const bladeEndX = W - PAD_R;
      const bladeW = bladeEndX - bladeStartX;

      ctx.beginPath();
      ctx.moveTo(bladeStartX, midY - rootHalfH);
      ctx.bezierCurveTo(
        bladeStartX + bladeW * 0.35,
        midY - rootHalfH * 0.85,
        bladeStartX + bladeW * 0.7,
        midY - tipHalfH * 3.5,
        bladeEndX,
        midY - tipHalfH,
      );
      ctx.quadraticCurveTo(bladeEndX + 6, midY, bladeEndX, midY + tipHalfH);
      ctx.bezierCurveTo(
        bladeStartX + bladeW * 0.7,
        midY + tipHalfH * 2.5,
        bladeStartX + bladeW * 0.35,
        midY + rootHalfH * 0.75,
        bladeStartX,
        midY + rootHalfH,
      );
      ctx.quadraticCurveTo(
        bladeStartX - 8,
        midY,
        bladeStartX,
        midY - rootHalfH,
      );
      ctx.closePath();
      ctx.fillStyle = "#e8e8e8";
      ctx.fill();
      ctx.strokeStyle = "#555555";
      ctx.lineWidth = 2;
      ctx.stroke();

      drawDotAndResolve(PAD_L, PAD_R);
    };

    // Ruta de tu archivo SVG
    img.src = "/icons/blade.svg";
  });
};
