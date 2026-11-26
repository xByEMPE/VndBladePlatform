import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Personal activo (admin, technician, dev) que se puede asignar al "Technical team" de un proyecto.
// Lo entrega la RPC public.list_selectable_staff(): solo id, nombre, correo y puesto, y solo a personal.
export function useSelectableStaff() {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: rpcError } = await supabase.rpc("list_selectable_staff");
      if (cancelled) return;
      if (rpcError) {
        setError(rpcError);
        setPeople([]);
      } else {
        setError(null);
        setPeople(Array.isArray(data) ? data : []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { people, loading, error };
}

// Nombre para mostrar de una persona seleccionable (cae al correo si el perfil no tiene nombre).
export const personLabel = (p) => (p.full_name && p.full_name.trim()) || p.email;
