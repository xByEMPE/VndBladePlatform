import { tx, dateLocale } from "@/i18n/tx";

// Función para descargar imagen en negativo
export async function downloadNegativePng(imageUrl, filename = "image-negative.png") {
  const res = await fetch(imageUrl, { mode: "cors" });
  if (!res.ok)
    throw new Error(tx("No se pudo descargar la imagen ({{status}})", { status: res.status }));
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i]; // R
    data[i + 1] = 255 - data[i + 1]; // G
    data[i + 2] = 255 - data[i + 2]; // B
  }
  ctx.putImageData(imgData, 0, 0);
  const pngBlob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  if (!pngBlob) throw new Error(tx("No se pudo generar el PNG."));
  const url = URL.createObjectURL(pngBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Función para descargar imagen con marca de agua
export async function downloadWithWatermark(
  imageUrl,
  damageInfo,
  navigationData,
  filename = "image-watermark.png",
  detection = null
) {
  const res = await fetch(imageUrl, { mode: "cors" });
  if (!res.ok)
    throw new Error(tx("No se pudo descargar la imagen ({{status}})", { status: res.status }));
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);

  // Dibujar el bounding box del daño si existe
  if (detection && detection.bbox) {
    const [nx, ny, nw, nh] = detection.bbox;
    const x = nx * bitmap.width;
    const y = ny * bitmap.height;
    const w = nw * bitmap.width;
    const h = nh * bitmap.height;

    // Normalizar severidad a formato "Cat X"
    let normalizedSeverity = detection.severity;
    if (normalizedSeverity && !normalizedSeverity.startsWith("Cat ")) {
      normalizedSeverity = `Cat ${normalizedSeverity}`;
    }
    
    console.log("[downloadWithWatermark] Drawing bbox with severity:", {
      original: detection.severity,
      normalized: normalizedSeverity
    });

    // Colores de severidad
    const colors = {
      "Cat 1": "#10B981",  // Verde
      "Cat 2": "#84CC16",  // Lima
      "Cat 3": "#F59E0B",  // Ámbar
      "Cat 4": "#F97316",  // Naranja
      "Cat 5": "#EF4444",  // Rojo
    };
    const color = colors[normalizedSeverity] || "#6B7280";

    // Dibujar borde del bounding box
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, w, h);
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
  }

  // Configurar estilo del texto (tamaño más pequeño)
  const fontSize = Math.max(12, Math.floor(bitmap.width / 60));
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
  ctx.lineWidth = 2;

  // Convertir radio de metros a milímetros
  let radioMm = "-";
  if (damageInfo?.radio) {
    const radioMeters = parseFloat(damageInfo.radio);
    if (!isNaN(radioMeters)) {
      radioMm = (radioMeters * 1000).toFixed(0);
    }
  }

  // Formatear severidad como "Cat X"
  let severityDisplay = damageInfo?.severity;
  if (severityDisplay && !severityDisplay.toString().startsWith("Cat ")) {
      severityDisplay = `Cat ${severityDisplay}`;
  }
  const severity = severityDisplay || "N/A";

  // Información a mostrar
  console.log("[downloadWithWatermark] navigationData:", navigationData);
  console.log("[downloadWithWatermark] windFarm check:", {
    fromNavWindFarm: navigationData?.windFarm,
    fromNavWind_farm: navigationData?.wind_farm,
    fromDetection: detection?.wind_farm,
  });
  
  const lines = [
    tx("Parque: {{value}}", { value: navigationData?.windFarm || navigationData?.wind_farm || "N/A" }),
    `WTG: ${navigationData?.wtg || "N/A"}`,
    tx("Pala: {{value}}", { value: navigationData?.blade || "N/A" }),
    tx("Sección: {{value}}", { value: damageInfo?.section || navigationData?.section || "N/A" }),
    tx("Tipo: {{value}}", { value: severity }),
    tx("Radio: {{value}} mm", { value: radioMm }),
    `Longitudinal: ${damageInfo?.length || "N/A"} mm`,
    tx("Transversal: {{value}} mm", { value: damageInfo?.width || "N/A" }),
    tx("Fecha: {{date}}", { date: new Date().toLocaleDateString(dateLocale(), { day: "2-digit", month: "2-digit", year: "numeric" }) }),
  ];

  // Dibujar fondo semi-transparente
  const padding = 10;
  const lineHeight = fontSize + 5;
  const boxHeight = lines.length * lineHeight + padding * 2;
  const maxTextWidth = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const boxWidth = maxTextWidth + padding * 2;

  // Posicionar en la parte inferior izquierda
  const boxX = 10;
  const boxY = bitmap.height - boxHeight - 10;

  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

  // Dibujar texto
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  lines.forEach((line, index) => {
    const y = boxY + padding + (index + 1) * lineHeight - 5;
    ctx.strokeText(line, boxX + padding, y);
    ctx.fillText(line, boxX + padding, y);
  });

  const pngBlob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  if (!pngBlob) throw new Error(tx("No se pudo generar el PNG."));
  const url = URL.createObjectURL(pngBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
