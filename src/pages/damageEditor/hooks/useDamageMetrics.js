// Métricas del daño a partir de los metadatos de la imagen (GSD, radio del centro de la imagen en la pala,
// altura de la imagen) y de la geometría del recuadro. Es derivación pura: no contiene hooks de React.
// La llamada va justo después de los useRef de DamageEditorPage porque recibe imageRef.
export const useDamageMetrics = ({ currentImage, effectiveMetadata, imageRef, setDamageInfo }) => {
  // A. Extraer GSD (Tamaño del píxel)
  const rawGSD = 
      effectiveMetadata?.excel_row?.calculated_gsd_mm_px || 
      effectiveMetadata?.Calculated_GSD_mm_px || 
      effectiveMetadata?.gsd || 
      1;
  const gsdMeters = rawGSD / 1000;

  // B. Extraer Altura/Radio en el centro de la foto
  let centerRadiusMeters = 0;
  if (effectiveMetadata?.excel_row?.calculated_blade_radius_mm != null) {
      centerRadiusMeters = effectiveMetadata.excel_row.calculated_blade_radius_mm / 1000;
  } else if (effectiveMetadata?.Calculated_Blade_Radius_mm != null) {
      centerRadiusMeters = effectiveMetadata.Calculated_Blade_Radius_mm / 1000;
  } else if (currentImage?.calculated_height_m != null) {
      centerRadiusMeters = currentImage.calculated_height_m;
  } else if (effectiveMetadata?.radius != null) {
      const val = Number(effectiveMetadata.radius);
      centerRadiusMeters = val > 200 ? val / 1000 : val;
  } else if (effectiveMetadata?.excel_row?.gpsaltitude != null) {
      centerRadiusMeters = effectiveMetadata.excel_row.gpsaltitude; // Fallback a GPS bruto
  }

  // C. Dimensiones de la Imagen
  const imgHeight = 
      effectiveMetadata?.exif_dump?.ExifImageHeight || 
      currentImage?.height || 
      effectiveMetadata?.ImageHeight || 
      3000; 
  const halfImgMeters = (imgHeight / 2) * gsdMeters;

  // D. Orientación de la regla virtual
  // A petición estricta: La regla SIEMPRE debe ir en descenso (Tip -> Root visualmente)
  // La punta asume valores altos arriba (Y=0), y desciende al ir hacia abajo.
  const isTipAtTop = true; 

  // Ajustar el inicio global (Borde Superior de la imagen)
  const globalStartMeters = centerRadiusMeters + halfImgMeters;
  // =========================================================================
    
  // Helper: Calculate Metrics
  const calculateMetrics = (bbox) => {
      if (!currentImage || !bbox || !imageRef.current) return null;
      const img = imageRef.current;
      const [nx, ny, nw, nh] = bbox;
      
      const w_px = nw * img.naturalWidth;
      const h_px = nh * img.naturalHeight;
      const realY_px = ny * img.naturalHeight;
      const centerY_px = realY_px + (h_px / 2);
      
      const width_mm = (w_px * gsdMeters * 1000).toFixed(0);
      const height_mm = (h_px * gsdMeters * 1000).toFixed(0); 
      const length_mm = height_mm; 
      const area_mm2 = (width_mm * length_mm).toFixed(0);
      const calculatedRadius = (getGlobalY(centerY_px)).toFixed(2);
      
      return {
          width: width_mm,
          length: length_mm,
          area: area_mm2,
          radio: calculatedRadius
      };
  };

  // Helper: Get Global Y in Meters (for Ruler/Crosshair)
  const getGlobalY = (localY) => {
      if (!imageRef.current || !currentImage) return 0;
      
      const centerImageY = imageRef.current.naturalHeight / 2;
      const deltaYFromCenter = localY - centerImageY;
      const dMeters = deltaYFromCenter * gsdMeters;
      
      // La punta está arriba (Y=0), así que bajar en Y disminuye el radio.
      return centerRadiusMeters - dMeters;
  };

  // Función unificada para calcular y actualizar métricas
  const updateDamageMetrics = (bbox) => {
      const metrics = calculateMetrics(bbox);
      if (!metrics) return;

      setDamageInfo(prev => ({
          ...prev,
          ...metrics
      }));
  };

  return { centerRadiusMeters, calculateMetrics, getGlobalY, updateDamageMetrics };
};
