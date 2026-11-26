import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { translateAdditionalNotes } from "../utils/translationUtils";

/**
 * Muestra un texto libre escrito en español (p. ej. las notas de un daño) traducido al
 * idioma activo de la interfaz. Mientras traduce, o si falla, muestra el original.
 * Solo es de lectura: los campos de edición siguen mostrando el texto original.
 */
export default function TranslatedText({ text, as: Tag = "span", className }) {
  const { i18n } = useTranslation();
  const lang = String(i18n.resolvedLanguage || i18n.language || "es").toLowerCase().split("-")[0];
  const [shown, setShown] = useState(text);

  useEffect(() => {
    let cancelled = false;
    setShown(text);
    if (!text || lang === "es") return undefined;

    translateAdditionalNotes(text, lang)
      .then((translated) => {
        if (!cancelled && translated) setShown(translated);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [text, lang]);

  return (
    <Tag className={className} lang={lang === "es" ? "es" : lang}>
      {shown}
    </Tag>
  );
}
