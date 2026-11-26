import { useState, useEffect, useMemo } from "react";
import { getProjectById, getProjectByName, listTurbinesByProject, listCapturesByBlade } from "../../shared/data";
import { getImageUrl, primeImageUrls } from "@/lib/storageUrls";

// Carga de datos del editor: proyecto, turbina (y sus alias de sección) y capturas de la pala.
// La llamada a este hook debe ocupar la posición del primer efecto de carga dentro de DamageEditorPage
// (tras useExifData) para conservar el orden de ejecución de los efectos.
export const useEditorData = ({ currentImage, navigationData, allImages, setAllImages }) => {
  // Project data state for wind_farm
  const [project, setProject] = useState(null);

  // Fetch project data to get wind_farm
  useEffect(() => {
    const fetchProject = async () => {
      console.log("[DamageEditor] Attempting to fetch project...");
      console.log("[DamageEditor] currentImage:", currentImage);
      console.log("[DamageEditor] navigationData:", navigationData);
      
      try {
        let data = null;
        
        // Try by project_id first
        if (currentImage?.project_id) {
          console.log("[DamageEditor] Fetching by project_id:", currentImage.project_id);
          const result = await getProjectById(currentImage.project_id);
          
          if (result.error) {
            console.error("[DamageEditor] Error fetching by project_id:", result.error);
          } else {
            setProject(result.data);
            data = result.data;
            console.log("[DamageEditor] Project fetched:", result.data);
          }
        }
        
        // Fallback: try by project name
        if (!data && navigationData?.projectName) {
          console.log("[DamageEditor] Fetching by project name:", navigationData.projectName);
          const result = await getProjectByName(navigationData.projectName);
          
          if (result.error) {
            console.error("[DamageEditor] Error fetching by project name:", result.error);
          } else {
            data = result.data;
          }
        }
        
        if (data) {
          console.log("[DamageEditor] Project loaded successfully:", data);
          setProject(data);
        } else {
          console.warn("[DamageEditor] Could not load project - no project_id or projectName match");
        }
      } catch (error) {
        console.error("[DamageEditor] Unexpected error loading project:", error);
      }
    };
    
    fetchProject();
  }, [currentImage?.project_id, navigationData?.projectName]);

  // Fetch turbine data to get blade_length
  const [turbine, setTurbine] = useState(null);

  // Debug state
  const [debugInfo, setDebugInfo] = useState({ source: 'init', wtgName: null, turbinesFound: [] });

  useEffect(() => {
    const fetchTurbine = async () => {
      // 1. Try to get WTG name from navigation data
      let wtgName = navigationData?.wtg || navigationData?.wtgName;
      
      // 2. Fallback: Try to parse from storage path if available
      // Format usually: "ProjectName/WTG/Blade/..."
      if (!wtgName && currentImage?.storage_path) {
          const parts = currentImage.storage_path.split('/');
          if (parts.length >= 2) {
              wtgName = parts[1]; // Store the raw value found
              console.log("[DamageEditor] Derived WTG from storage_path:", wtgName);
          }
      }

      // 3. Resolve Project ID
      const projectId = currentImage?.project_id || project?.id;

      setDebugInfo(prev => ({ ...prev, wtgName, projectId, source: 'fetching' }));

      if (projectId) {
        try {
            // First, just get ALL turbines to see what we are dealing with
            // This is safer than guessing the name format (125 vs WTG125, etc)
            const { data: allTurbines, error: allError } = await listTurbinesByProject(projectId);

            if (allError) {
                console.error("[DamageEditor] Error fetching all turbines:", allError);
            } else {
                console.log("[DamageEditor] All turbines:", allTurbines);
                setDebugInfo(prev => ({ ...prev, turbinesFound: allTurbines || [] }));

                // Now try to find the matching one
                if (allTurbines && allTurbines.length > 0) {
                    // DEBUG: Log all available names
                    console.log("[DamageEditor] Searching for:", wtgName);
                    // Use turbine_name column as per user schema
                    const getTurbineName = (t) => t.turbine_name || t.name || t.wtg || "";
                    console.log("[DamageEditor] Available turbine names:", allTurbines.map(getTurbineName));

                    // Try exact match
                    let match = allTurbines.find(t => getTurbineName(t) == wtgName);
                    
                    // Try partial match or numeric match if not found
                    if (!match && wtgName) {
                         // Check if wtgName "125" is inside "WTG-125" or vice versa
                         const wtgStr = wtgName.toString().toLowerCase();
                         match = allTurbines.find(t => {
                            const tName = getTurbineName(t).toString().toLowerCase();
                            return tName.includes(wtgStr) || wtgStr.includes(tName); 
                         });
                    }
                    
                    // Fallback: If only 1 turbine exists in the project, USE IT.
                    // This assumes the user is navigating within a single-turbine project context
                    if (!match && allTurbines.length === 1) {
                         console.log("[DamageEditor] Single turbine fallback used:", getTurbineName(allTurbines[0]));
                         match = allTurbines[0];
                    }

                    if (match) {
                        console.log("[DamageEditor] Found matching turbine:", match);
                        setTurbine(match);
                        setDebugInfo(prev => ({ 
                            ...prev, 
                            match: getTurbineName(match), 
                            bladeLen: match.blade_length 
                        }));
                    } else {
                        console.warn("[DamageEditor] No matching turbine found for:", wtgName);
                        setDebugInfo(prev => ({ ...prev, match: 'None (Search Failed)' }));
                    }
                }
            }
        } catch (err) {
          console.error("[DamageEditor] Exception in turbine fetch:", err);
        }
      } else {
        console.warn("[DamageEditor] Skipping turbine fetch - missing projectId");
      }
    };

    fetchTurbine();
  }, [project?.id, currentImage?.project_id, currentImage?.storage_path, navigationData]);

  // Section mapping logic ported from ReportViewerPage
  const sectionAliases = useMemo(() => {
    try {
      if (turbine?.coordinates) {
        const coords = typeof turbine.coordinates === 'string' 
          ? JSON.parse(turbine.coordinates) 
          : turbine.coordinates;
        return coords?._section_aliases || {};
      }
    } catch (e) {
      console.warn("[DamageEditor] Error parsing coordinates:", e);
    }
    return {};
  }, [turbine]);

  const getSectionLabel = (sectionKey) => {
    if (!sectionKey) return sectionKey;
    return sectionAliases[sectionKey] || sectionKey;
  };

  // Fetch all images for the blade (for Other Sections navigation)
  useEffect(() => {
    console.log("[DamageEditor] ===== FETCH USEEFFECT TRIGGERED =====");
    console.log("[DamageEditor] Dependencies:", { 
      projectId: project?.id, 
      currentImageBladeId: currentImage?.blade_id,
      currentImageExists: !!currentImage
    });

    const fetchAllBladeImages = async () => {
      // CRITICAL: Use blade_id, not blade name
      const bladeId = currentImage?.blade_id;
      const projectId = project?.id || currentImage?.project_id;
      
      console.log("[DamageEditor] Checking if full blade fetch is needed:", { bladeId, projectId, currentAllImagesCount: allImages?.length });

      if (!bladeId || !projectId) {
          console.warn("[DamageEditor] Cannot fetch all blade images: Missing blade_id or project ID.");
          return;
      }

      // Check existing images
      const sections = new Set((allImages || []).map(img => img.section));
      console.log("[DamageEditor] Current sections available:", Array.from(sections));

      if (!bladeId || !projectId) {
          console.warn("[DamageEditor] Waiting for blade_id and project_id to be available...");
          return;
      }

      console.log(`[DamageEditor] Fetching full image set for blade_id: ${bladeId} (Project: ${projectId})`);
      
      try {
          // Attempt: 'captures' table (Confirmed by User Schema)
          // Schema: blade_id is uuid, calculated_height_m is double
          let { data, error } = await listCapturesByBlade(bladeId); // captures table uses blade_id directly
          
          if (error) {
              console.warn("[DamageEditor] 'captures' fetch error:", error);
          }

          if (data && data.length > 0) {
              console.log(`[DamageEditor] Fetched ${data.length} images from 'captures'.`);
              
              // Firma en lote originales + miniaturas antes de generar las URLs
              await primeImageUrls(data.map((img) => img.storage_path), { withThumbs: true });

              // Normalize data and Extract Radius consistently
              const normalizedData = data.map(img => {
                  const meta = img.metadata || {};

                  
                  let r_val = null;
                  
                  
                  if (meta.Calculated_Blade_Radius_mm !== undefined) {
                      r_val = Number(meta.Calculated_Blade_Radius_mm) / 1000;
                  } else if (img.calculated_height_m !== undefined && img.calculated_height_m !== null) {
                      r_val = Number(img.calculated_height_m);
                  } else if (meta.radius !== undefined) {
                       // heuristic: if > 100 it's likely mm, else meters
                       const val = Number(meta.radius);
                       r_val = val > 200 ? val / 1000 : val;
                  } else if (img.position_meters !== undefined) {
                      r_val = Number(img.position_meters);
                  }
                  
                  // Generate Public URL for OptimizedImage
                  const pubUrl = img.storage_path 
                    ? getImageUrl(img.storage_path) 
                    : null;

                  return {
                      ...img,
                      calculated_height_m: r_val, // Normalized Radius in Meters
                      storage_path: img.storage_path,
                      publicUrl: pubUrl,
                      section: img.section
                  };
              });

              // Debug log for radius values
              const sample = normalizedData.find(d => d.calculated_height_m);
              console.log("[DamageEditor] Sample radius check:", sample ? `ID ${sample.id} -> ${sample.calculated_height_m}m` : "No radius found");

              // Verify we actually got other sections
              const newSections = new Set(normalizedData.map(img => img.section));
              console.log("[DamageEditor] Fetched sections:", Array.from(newSections));
              
              setAllImages(normalizedData);
          } else {
              console.warn("[DamageEditor] Failed to find blade images in 'captures'.");
          }
      } catch (e) {
          console.error("[DamageEditor] Error fetching blade images:", e);
      }
    };
    
    // Trigger
     fetchAllBladeImages();
  }, [project?.id, currentImage?.blade_id]); // Use blade_id dependency

  return { project, turbine, getSectionLabel };
};
