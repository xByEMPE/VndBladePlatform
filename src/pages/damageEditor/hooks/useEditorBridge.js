import { useEffect } from "react";

// Puente de entrada del editor: recibe por postMessage la clave del estado enviado por el visor (localStorage)
// y, como respaldo, busca el estado en sessionStorage / localStorage al cargar.
// Los postMessage de salida hacia window.opener se quedan en los manejadores de DamageEditorPage.
export const useEditorBridge = ({ setReceivedState }) => {
  // Listener para recibir datos del estado desde localStorage
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data.type === "NAVIGATION_STATE_KEY") {
        const storageKey = event.data.storageKey;

        try {
          const stateData = JSON.parse(localStorage.getItem(storageKey));
          if (stateData && stateData.imageSrc) {
            setReceivedState(stateData); // daño recién enviado: reemplaza al anterior

            // Guardar en sessionStorage para sobrevivir a recargas
            try {
              sessionStorage.setItem(
                "damageEditorState",
                JSON.stringify(stateData)
              );
            } catch (error) {
              console.error(
                "[DamageEditor] Error guardando en sessionStorage:",
                error
              );
            }

            // Limpiar localStorage después de usar
            localStorage.removeItem(storageKey);
            console.log(
              "[DamageEditor] Datos limpiados de localStorage:",
              storageKey
            );
          } else {
            console.warn(
              "[DamageEditor] Datos no encontrados en localStorage:",
              storageKey
            );
          }
        } catch (error) {
          console.error(
            "[DamageEditor] Error parseando datos de localStorage:",
            error
          );
        }
      }
    };

    // También buscar datos en localStorage y sessionStorage al cargar (fallback)
    const searchForData = () => {

      // Primero buscar en sessionStorage (para recargas)
      const sessionData = sessionStorage.getItem("damageEditorState");
      console.log(
        "[DamageEditor] sessionStorage data:",
        sessionData ? "ENCONTRADO" : "NO ENCONTRADO"
      );

      if (sessionData) {
        try {
          const stateData = JSON.parse(sessionData);
          if (stateData && stateData.imageSrc) {
            setReceivedState((prev) => prev || stateData);
            return; // Si encontramos datos en sessionStorage, no buscar en localStorage
          }
        } catch (error) {
          console.error(
            "[DamageEditor] Error parseando sessionStorage:",
            error
          );
        }
      }

      // Si no hay datos en sessionStorage, buscar en localStorage
      const keys = Object.keys(localStorage);
      const damageEditorKey = keys.find((key) =>
        key.startsWith("damageEditorState_")
      );

      if (damageEditorKey) {
        try {
          const stateData = JSON.parse(localStorage.getItem(damageEditorKey));
          if (stateData && stateData.imageSrc) {
            setReceivedState(stateData); // daño recién enviado: reemplaza al anterior

            // Guardar en sessionStorage para futuras recargas
            try {
              sessionStorage.setItem(
                "damageEditorState",
                JSON.stringify(stateData)
              );
            } catch (error) {
              console.error(
                "[DamageEditor] Error copiando a sessionStorage:",
                error
              );
            }

            localStorage.removeItem(damageEditorKey);
          }
        } catch (error) {
          console.error(
            "[DamageEditor] Error en fallback localStorage:",
            error
          );
        }
      }
    };

    window.addEventListener("message", handleMessage);
    console.log("[DamageEditor] Listener de mensajes configurado");

    // Buscar datos inmediatamente y después de un delay
    searchForData();

    const retryTimer = setTimeout(searchForData, 1000);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearTimeout(retryTimer);
      console.log("[DamageEditor] Listeners removidos");
    };
  }, []);
};
