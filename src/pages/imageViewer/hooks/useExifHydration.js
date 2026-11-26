import { useEffect } from "react";
import { fetchExifJson } from "@/hooks/useExifData";

// Hidratación de metadatos: pide los JSON externos de cada imagen y los fusiona en raw_metadata (una sola vez por imagen).
export const useExifHydration = ({ allImages, setAllImages }) => {
  // Metadata Fetching Effect
  useEffect(() => {
    if (!allImages.length) return;

    // Check if we need to fetch external EXIF JSONs (if not already hydrated)
    // We only do this if raw_metadata doesn't contain chord_data
    // or if we suspect we need markers.

    // We'll fetch for ALL images to ensure correct ruler calibration.
    // Optimization: check if already hydrated to avoid loops
    const needsFetch = allImages.some(
      (img) => !img.raw_metadata?.chord_data?.hydrated
    );

    if (needsFetch) {
      const fetchAllMetadata = async () => {
        console.log("[ImageViewer] Fetching external metadata for images...");
        const updatedImages = await Promise.all(
          allImages.map(async (img) => {
            // If already hydrated, skip
            if (img.raw_metadata?.chord_data?.hydrated) return img;

            let json = null;
            try {
                // Fetch sidecar JSON if available (suppressing errors)
                json = await fetchExifJson(img);
            } catch (e) {
                // Ignore errors
            }

            if (json) {
              // Merge JSON data into raw_metadata
              // Priority: JSON > DB
              const newMeta = { ...img.raw_metadata, ...json };
              // Mark as hydrated to prevent re-fetch
              if (!newMeta.chord_data) newMeta.chord_data = {};
              newMeta.chord_data.hydrated = true;

              return { ...img, raw_metadata: newMeta };
            }

            // Mark as checked even if failed, to avoid inf loop
            const newMeta = { ...(img.raw_metadata || {}) };
            if (!newMeta.chord_data) newMeta.chord_data = {};
            newMeta.chord_data.hydrated = true;
            return { ...img, raw_metadata: newMeta };
          })
        );

        // Only update if changes
        // Note: This might cause re-render loop if not careful.
        // But we check needsFetch.
        setAllImages(updatedImages);
        console.log("[ImageViewer] Metadata updated.");
      };

      fetchAllMetadata();
    }
  }, [allImages]);
};
