import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { listCaptureMetadataByIds, getTurbineGeometry, getTurbineGeometryLegacy } from "../../shared/data";
import { BladeManifestService } from "@/services/BladeManifestService";

// Carga de datos del visor: inicialización desde el estado de navegación, escucha de sesión, metadatos masivos,
// manifiesto de la pala, metadatos de la imagen actual y geometría de la turbina. Los efectos conservan su orden.
export const useViewerData = ({
  allImages, currentImage, isStitched, currentImageIndex,
  location, navigate, setIsStitched, setStitchedTurbineId,
  setAllImages, setCurrentImageIndex, setLoading, setBladeLength,
  setManifestData, setManifestLoading, setPolygons, setTurbineCoords,
}) => {
  // ----- INITIAL DATA LOADING -----
  useEffect(() => {
    const initializeViewer = async () => {
      console.log("[ImageViewer] Initializing...");

      // 1. Resolve State (Location vs LocalStorage)
      let initialData = location.state;

      // If no location state (e.g. refresh or new tab), try local storage
      if (!initialData) {
        console.log(
          "[ImageViewer] No location state, checking LocalStorage..."
        );

        // Try to get specific key from URL
        const params = new URLSearchParams(location.search);
        const specificKey = params.get("stateKey");

        let storageKey = null;
        if (specificKey) {
          // STRICT MODE: If ID is provided, ONLY use that ID.
          if (localStorage.getItem(specificKey)) {
            console.log(
              "[ImageViewer] Found specific stateKey in URL:",
              specificKey
            );
            storageKey = specificKey;
          } else {
            console.warn(
              `[ImageViewer] State key ${specificKey} provided but not found in storage.`
            );
            // DO NOT FALLBACK to random keys here. This is the fix.
            // We want to force a clean failure rather than showing wrong data.
          }
        } else {
          // LEGACY/FALLBACK MODE: Only if NO key was provided in URL
          console.log(
            "[ImageViewer] No stateKey in URL, attempting legacy fallback..."
          );
          const keys = Object.keys(localStorage);
          storageKey = keys.find((k) => k.startsWith("imageViewerState_"));
        }

        if (storageKey) {
          try {
            initialData = JSON.parse(localStorage.getItem(storageKey));
            console.log(
              "[ImageViewer] Recovered state from LocalStorage. Images count:",
              initialData?.allImages?.length
            );
          } catch (e) {
            console.error("[ImageViewer] Error parsing LocalStorage state", e);
          }
        }
      }

      if (initialData?.allImages?.length > 0) {
        setAllImages(initialData.allImages);
        setIsStitched(!!initialData.isStitched);
        setStitchedTurbineId(initialData.turbineId || null);
        setCurrentImageIndex(initialData.currentImageIndex || 0);

        // Pre-load Blade Length from previous page if available
        if (initialData.bladeLength) {
          setBladeLength(Number(initialData.bladeLength));
        }

        // Fetch Turbine Data for measurements if we have IDs
        if (
          initialData.navigationData?.projectId &&
          initialData.navigationData?.wtg
        ) {
          fetchTurbineData(
            initialData.navigationData.projectId,
            initialData.navigationData.wtg
          );
        }
      } else {
        console.warn("[ImageViewer] No images found. Redirecting...");
        // Delay redirect to avoid flash
        setTimeout(() => navigate(-1), 2000);
      }

      setLoading(false);
    };

    initializeViewer();
  }, [location.state, navigate]); // Run once on mount (dep array safe)

  // Auth Listener to retry fetch on reconnection/wake
  const [retryAuth, setRetryAuth] = useState(0);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          console.log(`[ImageViewer] Auth event: ${event}. Refetching meta...`);
          setRetryAuth((prev) => prev + 1);
        }
      }
    );
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // BULK FETCH METADATA (VITAL FOR CALIBRATION)
  // We need to fetch metadata for ALL images in this set to find Root/Tip for global scaling.
  // Viewing images one-by-one is too slow and causes race conditions in calibration.
  useEffect(() => {
    const fetchAllMetadata = async () => {
      if (!allImages || allImages.length === 0 || isStitched) return;

      // Extract IDs or Paths
      // If we have IDs, use them. If not, use file_paths?
      // Ideally we use IDs.
      const ids = allImages.map((img) => img.id).filter(Boolean);

      if (ids.length === 0) {
        // Fallback to paths? Or just skip?
        // If IDs are missing, we might have issue.
        return;
      }

      console.log(
        "[ImageViewer] Bulk fetching metadata for",
        ids.length,
        "images..."
      );

      const { data, error } = await listCaptureMetadataByIds(ids);

      if (error) {
        console.error("[ImageViewer] Bulk metadata fetch error:", error);
        return;
      }

      if (data && data.length > 0) {
        console.log("[ImageViewer] Bulk metadata fetched. Updating state...");

        setAllImages((prev) => {
          // Create a map for faster lookup
          const metaMap = new Map();
          data.forEach((item) => {
            if (item.raw_metadata) metaMap.set(item.id, item.raw_metadata);
          });

          return prev.map((img) => {
            if (img.id && metaMap.has(img.id)) {
              // Merge existing meta with new meta (new wins)
              return {
                ...img,
                raw_metadata: { ...img.raw_metadata, ...metaMap.get(img.id) },
              };
            }
            return img;
          });
        });
      }
    };

    // Debounce or just run once?
    // Run whenever the list of IDs changes?
    // We can just rely on basic deps.
    fetchAllMetadata();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allImages.length, retryAuth]); // trigger on length change or auth retry

  // --- FETCH MANIFEST (VIRTUAL RULER) ---
  useEffect(() => {
    const fetchManifest = async () => {
        // Need ProjectName, Turbine, Blade
        const state = location.state;
        const nav = state?.navigationData;
        const currentBlade = state?.section ? state.section.split('_')[1] : null; // "Pala A" -> "A" (approximation)
        
        // Ensure we have context
        if (!nav || !nav.projectName || !nav.wtg || !nav.blade) return;
        
        // Extract Letter (A, B, C)
        let bladeLetter = nav.blade;
        if (bladeLetter.includes("Blade")) bladeLetter = bladeLetter.replace("Blade", "").trim();
        if (bladeLetter.includes("Pala")) bladeLetter = bladeLetter.replace("Pala", "").trim();
        
        console.log(`[ImageViewer] Fetching Manifest for: ${nav.projectName} - ${nav.wtg} - Blade ${bladeLetter}`);
        
        setManifestLoading(true);
        // Primero por la ruta real de las fotos (válida con cualquier prefijo de proyecto); la convención antigua es respaldo
        let manifest = null;
        const samplePath = [currentImage, ...allImages].map((img) => img?.storage_path).find(Boolean);
        if (samplePath) manifest = await BladeManifestService.fetchManifestForImage(samplePath);
        if (!manifest) manifest = await BladeManifestService.fetchManifest(nav.projectName, nav.wtg, bladeLetter);

        if (manifest) {
            const calib = BladeManifestService.getCalibration(manifest);
            setManifestData(calib);
            console.log("[ImageViewer] Manifest Calibration applied:", calib);
            
            // Override bladeLength if manifest has it
            if (calib.bladeLength && calib.bladeLength > 0) {
                 setBladeLength(calib.bladeLength / 1000); // mm to meters
            }
        } else {
            setManifestData(null);
        }
        setManifestLoading(false);
    };
    
    fetchManifest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, allImages.length > 0]); // Re-run if navigation changes or once the images are known

  useEffect(() => {
    const fetchImageMeta = async () => {
      if (!currentImage || isStitched) return;

      console.log(
        "[ImageViewer] fetchImageMeta called. currentImage:",
        // Log minimal info
        typeof currentImage === "string"
          ? currentImage
          : currentImage?.name || currentImage?.id || currentImage?.file_path
      );

      // If we already have robust metadata (raw_metadata and blade_length) for the current image,
      // we might consider skipping the fetch to avoid unnecessary network calls.
      // However, the current fetch also updates blade_length from the DB, which might be more up-to-date.
      // For now, we'll always fetch to ensure the latest data.

      let query = supabase
        .from("captures")
        .select(
          `
          raw_metadata,
          blades (
            turbines (
              blade_length
            )
          )
        `
        )
        .maybeSingle();

      // Determine the primary identifier for the query
      if (currentImage?.id || currentImage?.inspection_file_id) {
        query = query.eq(
          "id",
          currentImage.id || currentImage.inspection_file_id
        );
      } else if (currentImage?.file_path || currentImage?.path) {
        // Handle potential encoding differences
        const rawPath = currentImage.file_path;
        // Try decoding just in case
        let decodedPath = rawPath;
        try {
          decodedPath = decodeURIComponent(rawPath);
        } catch (e) {}

        // We can't do OR in a single chain easily without 'or()' syntax which is complex with precedence.
        // We'll trust that the DB stores the raw path (decoded usually, but sometimes spaces).
        // Let's rely on decoded path if raw matches URL style.
        query = query.eq("storage_path", decodedPath);
      } else {
        return;
      }

      // Use maybeSingle() to avoid PGRST116 (0 rows) error if data missing or RLS blocks it
      const { data, error } = await query;

      if (error) {
        console.warn("[ImageViewer] Error fetching metadata:", error.message);
        return;
      }

      // Check if data is null (meaning 0 rows found)
      if (!data) {
        console.warn(
          "[ImageViewer] Metadata not found (0 rows). Check path or RLS/Auth.",
          currentImage.file_path
        );
        return;
      }

      if (data.raw_metadata || data.blades?.turbines?.blade_length) {
        console.log(
          "[ImageViewer] Fresh metadata fetched (Rad/GSD/Length updated)."
        );

        // Extract blade_length if found
        if (data.blades?.turbines?.blade_length) {
          const bl = Number(data.blades.turbines.blade_length);
          if (bl && !isNaN(bl)) {
            console.log(
              "[ImageViewer] Found blade_length in DB relationship:",
              bl
            );
            setBladeLength(bl);
          }
        }

        // DEBUG: Log excel_row to verify keys
        console.log(
          "[ImageViewer] Metadata Excel Row:",
          data.raw_metadata?.excel_row
        );

        // Update local state with fresh metadata
        setAllImages((prev) => {
          return prev.map((img) => {
            const match =
              (img.id && img.id === currentImage.id) ||
              (img.file_path && img.file_path === currentImage.file_path);

            if (match) {
              return {
                ...img,
                raw_metadata: {
                  ...img.raw_metadata,
                  ...data.raw_metadata,
                  // Inject blade_length into metadata too if needed for fallback
                  Length:
                    data.blades?.turbines?.blade_length ||
                    img.raw_metadata?.Length,
                },
              };
            }
            return img;
          });
        });
      }
    };

    fetchImageMeta();
  }, [currentImage?.id, currentImage?.file_path, retryAuth, isStitched]);

  // Reset polygons when image changes (optional, but requested behavior is usually per-image)
  useEffect(() => {
    setPolygons([]);
  }, [currentImageIndex]);

  // Fetch Turbine Root Coords & Blade Length
  const fetchTurbineData = async (projectId, turbineName) => {
    try {
      // Try exact match first
      let { data, error } = await getTurbineGeometry(projectId, turbineName);

      if (error || !data) {
        // Fallback to 'name' col if schema differs
        const { data: data2, error: error2 } = await getTurbineGeometryLegacy(projectId, turbineName);
        data = data2;
      }

      if (data) {
        setBladeLength(data.blade_length);
        if (data.coordinates) {
          // Assuming coordinates is { lat: ..., lon: ... } or similar JSON
          setTurbineCoords(data.coordinates);
        }
      }
    } catch (e) {
      console.error("Error fetching turbine data:", e);
    }
  };

  return { retryAuth };
};
