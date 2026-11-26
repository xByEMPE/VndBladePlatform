// Estado enviado por el visor: la clave más reciente "damageEditorState_<ts>" de localStorage.
// Se consume (se copia a sessionStorage y se borra) para que una recarga siga mostrando el mismo daño.
export function takePendingEditorState() {
  try {
    const key = Object.keys(localStorage)
      .filter((k) => k.startsWith("damageEditorState_"))
      .sort((a, b) => Number(b.split("_")[1]) - Number(a.split("_")[1]))[0];
    if (!key) return null;
    const data = JSON.parse(localStorage.getItem(key) || "null");
    localStorage.removeItem(key);
    if (!data?.imageSrc) return null;
    sessionStorage.setItem("damageEditorState", JSON.stringify(data));
    return data;
  } catch {
    return null;
  }
}

export function readSessionEditorState() {
  try {
    const saved = JSON.parse(sessionStorage.getItem("damageEditorState") || "null");
    return saved && saved.imageSrc ? saved : null;
  } catch {
    return null;
  }
}
