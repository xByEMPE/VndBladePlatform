// Metadatos efectivos de la imagen actual y valores derivados para la regla vertical (GSD, radio del centro,
// inicio global y rotación). Es derivación pura: no contiene hooks de React.
export const useViewerMetrics = ({ currentImage }) => {
  // =========================================================================
  // 1. EXTRACCIÓN DINÁMICA DE METADATOS ESTABLE (SIN RECALIBRACIÓN EXTERNA)
  // =========================================================================
  const effectiveMetadata = {
      ...currentImage?.raw_metadata,
      ...currentImage?.metadata
  };

  // A. Extraer GSD (Tamaño del píxel)
  const rawGSD = 
      effectiveMetadata?.excel_row?.calculated_gsd_mm_px || 
      effectiveMetadata?.Calculated_GSD_mm_px || 
      effectiveMetadata?.gsd || 
      1;
  const gsdMeters = rawGSD / 1000;
  const masterGSD_mm_px = rawGSD;

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
      centerRadiusMeters = effectiveMetadata.excel_row.gpsaltitude;
  }

  // C. Dimensiones de la Imagen
  const imgHeight = 
      effectiveMetadata?.exif_dump?.ExifImageHeight || 
      currentImage?.height || 
      effectiveMetadata?.ImageHeight || 
      3000; 
  const halfImgMeters = (imgHeight / 2) * gsdMeters;

  // Ajustar el inicio global (Borde Superior de la imagen)
  const globalStartMeters = centerRadiusMeters + halfImgMeters;
  const calibration = { rotation: effectiveMetadata?.rotation || 0 };

  return { masterGSD_mm_px, globalStartMeters, calibration };
};
