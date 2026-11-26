import { useState } from "react";
import { getProjectById, getTurbineByProjectAndName, listBladesByTurbine, listCapturesForBlades, listFindingsWithCapture } from "../../shared/data";
import { tx } from "@/i18n/tx";
import { primeImageUrls, getImageUrl } from "@/lib/storageUrls";
import { toast } from "@/components/ui/use-toast";

// Estado y cargadores de datos del reporte. Los efectos que los disparan (carga inicial y
// carga de imágenes de daños) permanecen en ReportViewerPage para conservar el orden de ejecución.
export const useReportData = ({ projectId, turbineName, isClient, selectedBlade, t }) => {
  // Estados principales
  const [loading, setLoading] = useState(true);

  const [project, setProject] = useState(null);

  const [turbine, setTurbine] = useState(null);

  // === ADMIN: Section Aliases (display-only overrides, persisted to Supabase) ===
  const [sectionAliases, setSectionAliases] = useState({});

  // Estados para imágenes
  const [imagesBySection, setImagesBySection] = useState({
    TE: [],
    PS: [],
    LE: [],
    SS: [],
  });

  const [allTurbineImages, setAllTurbineImages] = useState({});

  const [imagesLoaded, setImagesLoaded] = useState(false);

  // Estados para daños
  const [damages, setDamages] = useState([]);

  const [damageImages, setDamageImages] = useState({});

  // Estado para sincronización manual
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Estado para imagen de identificación del aerogenerador
  const [turbineIdImage, setTurbineIdImage] = useState(null);

  const loadData = async () => {
    try {
      if (!projectId || !turbineName) return;
      setLoading(true);

      // 1. Fetch Project
      const { data: proj, error: projErr } = await getProjectById(projectId);
      if (projErr) throw projErr;
      setProject(proj);

      // 2. Fetch Turbine (by name within project)
      // Note: Turbine name in URL might need decoding
      const decodedName = decodeURIComponent(turbineName);
      const { data: turb, error: turbErr } = await getTurbineByProjectAndName(projectId, decodedName);

      if (turbErr) throw turbErr;

      // START CHANGE: Check if client has permission to view unapproved turbine
      if (isClient && turb.status !== "Aprobado") {
        throw new Error(
          tx("El reporte de esta turbina aún se encuentra en revisión y no ha sido aprobado."),
        );
      }
      // END CHANGE

      // START CHANGE: Round coordinates from DB if present
      // NOTE: We only format string/array coordinates here.
      // JSONB objects (which may contain _section_aliases) are left as-is;
      // display formatting is handled by getCoordinatesDisplay() in the UI.
      if (turb && turb.coordinates) {
        try {
          const formatCoord = (val) => {
            const n = parseFloat(val);
            return !isNaN(n) ? n.toFixed(6) : val;
          };

          let coords = turb.coordinates;
          // Handle if plain string with commas (e.g. "40.123, -3.456")
          if (
            typeof coords === "string" &&
            !coords.trim().startsWith("{") &&
            coords.includes(",")
          ) {
            turb.coordinates = coords
              .split(",")
              .map((s) => formatCoord(s.trim()))
              .join(", ");
          }
          // Handle if array
          else if (Array.isArray(coords)) {
            turb.coordinates = coords.map(formatCoord).join(", ");
          }
          // If it's a JSONB object (possibly containing _section_aliases), leave it as-is.
          // getCoordinatesDisplay() handles clean display in the UI.
        } catch (e) {
          console.warn("[ReportViewer] Error formatting DB coordinates:", e);
        }
      }
      // END CHANGE

      // === Load section aliases from turbine's coordinates JSONB ===
      try {
        const rawCoords = turb.coordinates;
        let coordsObj = {};
        if (
          rawCoords &&
          typeof rawCoords === "object" &&
          !Array.isArray(rawCoords)
        ) {
          coordsObj = rawCoords;
        } else if (rawCoords && typeof rawCoords === "string") {
          try {
            coordsObj = JSON.parse(rawCoords);
          } catch (e) {
            coordsObj = {};
          }
        }
        const aliases = coordsObj._section_aliases;
        if (aliases && typeof aliases === "object") {
          setSectionAliases(aliases);
        } else {
          setSectionAliases({});
        }
      } catch (e) {
        setSectionAliases({});
      }

      // Firma la foto de ID y las caras stitched antes de que el estado las use
      try {
        const st = typeof turb.stitched === "string" ? JSON.parse(turb.stitched) : turb.stitched;
        const stitchedPaths = Object.values(st || {}).flatMap((b) =>
          b && typeof b === "object" ? Object.values(b).filter((v) => typeof v === "string") : [],
        );
        await primeImageUrls([turb.id_image_path, ...stitchedPaths]);
      } catch (e) {
        console.warn("[ReportViewer] No se pudieron firmar ID/stitched:", e);
      }

      setTurbine(turb);

      // 3. Fetch Blades
      const { data: blades, error: bladeErr } = await listBladesByTurbine(turb.id);

      if (bladeErr) throw bladeErr;

      // Map blades to have a name for UI
      const bladesWithName = (blades || []).map((b) => ({
        ...b,
        blade_name: `Blade ${b.position}`,
      }));

      const bladeIds = bladesWithName.map((b) => b.id);

      // 4. Fetch Captures (Images)
      // V2: Query captures table directly
      // Group by blade and section
      const { data: caps, error: capErr } = await listCapturesForBlades(bladeIds);

      if (capErr) throw capErr;

      // Firma en lote (originales + miniaturas) antes de renderizar
      await primeImageUrls(
        (caps || []).map((c) => c.storage_path),
        { withThumbs: true },
      );

      // Organize images
      // Structure: { "Blade A": { "LE": [...], "PS": [...] } }
      const newAllImages = {};

      bladesWithName.forEach((b) => {
        newAllImages[b.blade_name] = { TE: [], PS: [], LE: [], SS: [] };
      });

      (caps || []).forEach((c) => {
        const pos = c.blades?.position;
        const bName = pos ? `Blade ${pos}` : null;

        const sec = c.section;
        let mappedSec = sec;

        if (sec) {
          const sUp = sec.toUpperCase();
          if (sUp.includes("LEADING")) mappedSec = "LE";
          else if (sUp.includes("TRAILING")) mappedSec = "TE";
          else if (sUp.includes("PRESSURE")) mappedSec = "PS";
          else if (sUp.includes("SUCTION")) mappedSec = "SS";
          else if (["LE", "TE", "PS", "SS"].includes(sUp)) mappedSec = sUp;
        }

        if (bName && newAllImages[bName]) {
          if (!newAllImages[bName][mappedSec])
            newAllImages[bName][mappedSec] = [];

          c.url = getImageUrl(c.storage_path);
          c.publicUrl = c.url;
          c.name = c.storage_path.split("/").pop();
          c.path = c.storage_path; // Fix: Rendering logic expects 'path' property

          newAllImages[bName][mappedSec].push(c);
        }
      });

      // 5. SORTING LOGIC: Visual Order MUST be Tip (High Height) -> Root (Low Height)
      Object.keys(newAllImages).forEach((blade) => {
        Object.keys(newAllImages[blade]).forEach((sec) => {
          const list = newAllImages[blade][sec];
          if (list.length === 0) return;

          // Helper to get sequence from filename
          const getSeq = (name) => {
            const match =
              name.match(/[_-](\d{3,4})[_-]/) || name.match(/(\d{4})/);
            return match ? parseInt(match[1], 10) : 0;
          };

          // Validar si tenemos metadatos de altura
          const hasMetadata = list.some(
            (img) =>
              (img.calculated_height_m && img.calculated_height_m > 0) ||
              (img.raw_metadata?.Calculated_Blade_Radius_mm &&
                img.raw_metadata.Calculated_Blade_Radius_mm > 0),
          );

          if (hasMetadata) {
            // Prioridad 1: Altura (Siempre Descendiente para Tip->Root)
            list.sort((a, b) => {
              const hA =
                a.calculated_height_m ||
                a.raw_metadata?.Calculated_Blade_Radius_mm / 1000 ||
                0;
              const hB =
                b.calculated_height_m ||
                b.raw_metadata?.Calculated_Blade_Radius_mm / 1000 ||
                0;
              return hB - hA;
            });
            console.log(
              `[ReportViewer] Sorted ${blade} ${sec} by HEIGHT (Tip->Root)`,
            );
          } else {
            // Prioridad 2: Secuencia + Dirección de Vuelo
            // Buscar sequenceDirection en los metadatos de cualquier imagen del grupo
            const directionInfo = list.find(
              (img) =>
                img.raw_metadata?.sequenceDirection ||
                img.raw_metadata?.sequence_direction,
            );

            // Default para TODAS las secciones: RootToTip (igual que PS/SS funcionan)
            const direction =
              directionInfo?.raw_metadata?.sequenceDirection ||
              directionInfo?.raw_metadata?.sequence_direction ||
              "RootToTip";

            console.log(
              `[ReportViewer] Sorting ${blade} ${sec} using direction: ${direction}`,
            );

            if (direction === "TipToRoot") {
              // Vuelo TipToRoot:
              // Tip = Secuencia Baja (Inicio vuelo) -> Top de Lista
              // Root = Secuencia Alta (Fin vuelo) -> Fondo de Lista
              // Orden Orden: ASCENDENTE
              list.sort((a, b) => getSeq(a.name) - getSeq(b.name));
            } else {
              // Vuelo RootToTip (Default):
              // Root = Secuencia Baja (Inicio) -> Fondo de Lista
              // Tip = Secuencia Alta (Fin) -> Top de Lista
              // Orden: DESCENDENTE
              list.sort((a, b) => getSeq(b.name) - getSeq(a.name));
            }
          }
        });
      });

      setAllTurbineImages(newAllImages);
      setImagesLoaded(true); // Enable image list display
      // Ensure we update current view if needed
      if (selectedBlade && newAllImages[selectedBlade]) {
        setImagesBySection(newAllImages[selectedBlade]);
      } else {
        // Fallback if selectedBlade "Blade A" is not valid?
        // It should be valid since we construct "Blade A".
        setImagesBySection(
          newAllImages[selectedBlade] || { TE: [], PS: [], LE: [], SS: [] },
        );
      }

      // 4.5 Cargar Imagen de Identificación (ID) desde la nueva columna dedicada
      try {
        const exactIdPath = turb.id_image_path;

        if (exactIdPath) {
            const fileName = exactIdPath.split('/').pop();
            const urlData = { publicUrl: getImageUrl(exactIdPath) };

            // Solo seteamos la imagen. No buscamos ningún .json hermano porque la foto ID no lo genera.
            setTurbineIdImage({
              url: urlData.publicUrl,
              name: fileName,
              path: exactIdPath,
            });
        }
      } catch (err) {
        console.warn("[ReportViewer] Error cargando ID image:", err);
      }

      // 5. Fetch Damages -> Findings (V2)
      if (bladeIds.length > 0) {
        // Findings rely on capture_id.
        // We select findings for captures belonging to these blades.
        const { data: dmgs, error: dmgErr } = await listFindingsWithCapture(bladeIds);

        if (dmgErr) throw dmgErr;

        if (dmgs && dmgs.length > 0) {
          console.log("[DEBUG] First Fetched Damage:", dmgs[0]);
          console.log(
            "[DEBUG] Attributes:",
            dmgs[0].attributes,
            "Type:",
            typeof dmgs[0].attributes,
          );
        }

        // Enhance damages (findings) to match UI expectations
        // UI expects: id, severity, description(JSON), blade(name), section(from capture?)
        // Finding usually has 'attributes' or 'region' JSONB.
        // We might need to shim 'description'.

        // Construct a fake 'description' string for UI compat if it relies on JSON.parse(d.description)
        // Or better, update UI to use d.region directly.
        // Given the scope, let's shim it.

        const enhancedDamages = (dmgs || []).map((d) => {
          const pos = d.captures?.blades?.position;

          // Parse region and attributes if they are strings (Supabase sometimes returns strings for JSON columns)
          let region = d.region;
          if (typeof region === "string") {
            try {
              region = JSON.parse(region);
            } catch (e) {
              region = {};
            }
          }

          let attributes = d.attributes;
          if (typeof attributes === "string") {
            try {
              attributes = JSON.parse(attributes);
            } catch (e) {
              attributes = {};
            }
          } else if (!attributes) {
            attributes = {};
          }

          // Merge region and attributes
          const shimDesc = {
            ...(typeof region === "object" ? region : {}),
            ...(typeof attributes === "object" ? attributes : {}),
            // Add legacy fields if needed
          };

          return {
            ...d,
            region: region, // Ensure object in state
            attributes: attributes, // Ensure object in state
            description: JSON.stringify(shimDesc), // SHIM
            blade: pos ? `Blade ${pos}` : "Unknown",
            section: d.captures?.section, // Get section from capture
            capture_storage_path: d.captures?.storage_path, // NEW: Direct image path
            capture_id: d.captures?.id,
            // Extract metrics from attributes to top-level for DamageEditor UI
            radio: attributes.radio || attributes.radius || null,
            length: attributes.length || null,
            width: attributes.width || null,
            area: attributes.area || null,
            damage_type: attributes.damage_type || null,
          };
        });

        setDamages(enhancedDamages);
      }
    } catch (e) {
      console.error("Error loading data:", e);
      toast({
        title: t("common.error"),
        description: t("messages.errorLoadingDetails"), // fallback
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // === Cargar imágenes de daños para el reporte ===
  const loadDamageImages = async () => {
    if (!damages || damages.length === 0) return;

    console.log("[ReportViewer] Pre-loading damage images for PDF...");
    const newDamageImages = {};

    // Mapa para evitar duplicados
    const uniqueImagesToLoad = new Map();

    damages.forEach((damage) => {
      // 1. Imagen específica del daño (si existe en descripción)
      let foundSpecific = false;
      if (damage.description) {
        try {
          const desc = JSON.parse(damage.description);
          if (desc.image_path) {
            const key = `${damage.section}_${damage.blade}_${desc.image_path}`;
            if (!uniqueImagesToLoad.has(key)) {
              uniqueImagesToLoad.set(key, {
                path: desc.image_path,
                section: damage.section,
                blade: damage.blade,
                type: "manual",
                inspection_file_id: desc.inspection_file_id,
              });
            }
            foundSpecific = true;
          }
        } catch (e) {
          // Ignorar errores de parseo
        }
      }

      // 2. Imagen de captura asociada (si existe y no hay específica manual)
      if (!foundSpecific && damage.capture_storage_path) {
        const key = `${damage.section}_${damage.blade}_${damage.capture_storage_path}`;
        if (!uniqueImagesToLoad.has(key)) {
          uniqueImagesToLoad.set(key, {
            path: damage.capture_storage_path,
            section: damage.section,
            blade: damage.blade,
            type: "capture",
            inspection_file_id: damage.capture_id,
          });
        }
      }
    });

    console.log(
      `[ReportViewer] Found ${uniqueImagesToLoad.size} unique images to prepare.`,
    );

    await primeImageUrls([...uniqueImagesToLoad.values()].map((i) => i.path));

    // Procesar carga
    for (const [key, info] of uniqueImagesToLoad) {
      try {
        const data = { publicUrl: getImageUrl(info.path) };

        // Construir claves compatibles con la búsqueda en PDF
        // El PDF busca: `_${section}_${bladeNameForSearch}`
        const bladeNameForSearch = info.blade.replace("Blade ", "Pala ");
        const syntheticKey1 = `image_${info.section}_${bladeNameForSearch}_${info.path.split("/").pop()}`;
        const syntheticKey2 = `image_${info.section}_${info.blade}_${info.path.split("/").pop()}`;

        // Guardar con ambas claves para asegurar match
        const imageObj = {
          ...info,
          originalPath: info.path,
          publicUrl: data.publicUrl,
          imageName: info.path.split("/").pop(),
        };

        newDamageImages[syntheticKey1] = imageObj;
        newDamageImages[syntheticKey2] = imageObj;
      } catch (e) {
        console.error("Error preparing image for PDF:", info.path, e);
      }
    }

    setDamageImages(newDamageImages);
    console.log(
      "[ReportViewer] damageImages state updated with entries:",
      Object.keys(newDamageImages).length,
    );
  };

  // === Función de actualización manual (V2) ===
  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await loadData();
      toast({
        title: t("reportViewer.updated"),
        description: t("reportViewer.syncedOk"),
      });
    } catch (error) {
      toast({
        title: t("reportViewer.error"),
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // === Función para cargar imágenes manualmente ===
  const loadAllBladesImages = async () => {
    await loadData();
  };

  return { loading, project, turbine, sectionAliases, imagesBySection, allTurbineImages, imagesLoaded, damages, damageImages, isRefreshing, turbineIdImage, setProject, setTurbine, setSectionAliases, setImagesBySection, setAllTurbineImages, setDamages, setDamageImages, loadData, loadDamageImages, handleManualRefresh, loadAllBladesImages };
};
