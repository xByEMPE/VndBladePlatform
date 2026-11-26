import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Hook to load EXIF data from an image
 * Sources:
 * 1. DB (captures.raw_metadata.exif_dump) - Best if we have ID
 * 2. Storage JSON (images bucket) - If we have path/URL
 */
// Helper to fetch EXIF JSON directly
export const fetchExifJson = async (imageParams) => {
    let basePath = "";
    if (typeof imageParams === 'string') {
        basePath = imageParams;
    } else {
        basePath = imageParams.file_path || imageParams.storage_path || imageParams.name;
    }

    if (!basePath) return null;

    // Clean up if basePath is already a full URL
    const isUrl = basePath.startsWith("http");
    let storagePath = basePath;
    
    if (isUrl) {
        try {
            const urlObj = new URL(basePath);
            const pathParts = urlObj.pathname.split("/images/");
            if (pathParts.length > 1) {
                storagePath = decodeURIComponent(pathParts[1]);
            } else {
                 // Fallback: try to find 'images' in path
                 const idx = basePath.indexOf("/images/");
                 if (idx !== -1) {
                     storagePath = decodeURIComponent(basePath.substring(idx + 8)); // 8 = length of "/images/"
                 }
            }
        } catch (e) {
            console.warn("Error parsing URL:", basePath, e);
        }
    }

    // Remove extension and append _exif.json
    // Matches Backend Convention: image.jpg -> image_exif.json
    const jsonPath = storagePath.replace(/\.[^/.]+$/, "") + "_exif.json";

    try {
        const { data, error } = await supabase.storage
            .from('images')
            .download(jsonPath);

        if (error) {
            // Silently fail for 404s as sidecar might not exist
            // console.debug("EXIF JSON not found:", jsonPath);
            return null;
        }

        const text = await data.text();
        return JSON.parse(text);
    } catch (err) {
        // console.debug("Error parsing EXIF JSON:", err);
        return null;
    }
};

export const useExifData = (imageParams) => {
  const [exifData, setExifData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!imageParams) {
      setExifData(null);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchExifJson(imageParams);
        setExifData(data);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [imageParams]); // Dependency on imageParams object/string

  return { exifData, loading, error };
};
