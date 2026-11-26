import { useCallback, useEffect, useRef, useState } from "react";
import { getProjectMapData } from "@/pages/shared/data/mapData";

/**
 * Datos de daño y posición estimada por turbina para el mapa (RPC get_project_map_data).
 * Nunca lanza: un fallo queda en `error` para que la pantalla siga funcionando (el mapa se ve sin
 * color de severidad) y pueda ofrecer reintentar con `reload`.
 *
 * @param {string|null|undefined} projectId
 * @param {boolean} enabled   false para proyectos LPS (no usan el mapa)
 * @param {*} refreshKey      al cambiar (p. ej. nº de turbinas) vuelve a consultar
 */
export const useProjectMapData = (projectId, enabled, refreshKey) => {
  // `loading` arranca en true si ya se va a consultar, para no pintar un cuadro sin datos de daño.
  const [state, setState] = useState(() => ({ rows: null, loading: Boolean(enabled && projectId), error: null }));
  const requestRef = useRef(0); // una respuesta tardía de otra consulta no debe pisar la actual

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    if (!enabled || !projectId) {
      setState({ rows: null, loading: false, error: null });
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const { data, error } = await getProjectMapData(projectId);
      if (requestId !== requestRef.current) return;
      if (error) throw error;
      setState({ rows: data || [], loading: false, error: null });
    } catch (error) {
      if (requestId !== requestRef.current) return;
      setState({ rows: null, loading: false, error });
    }
  }, [projectId, enabled]);

  useEffect(() => {
    load();
    return () => {
      requestRef.current += 1; // invalida la consulta en curso al desmontar o cambiar de proyecto
    };
  }, [load, refreshKey]);

  return { ...state, reload: load };
};

export default useProjectMapData;
