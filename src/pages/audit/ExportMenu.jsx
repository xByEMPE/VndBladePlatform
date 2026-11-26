import { tx } from "@/i18n/tx";
import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { BTN_SUCCESS } from "@/lib/classes";
import { Download, ChevronDown, FileSpreadsheet, FileText } from "lucide-react";

const TRIGGER = BTN_SUCCESS; // verde
const ITEM =
  "flex w-full cursor-pointer items-center gap-2 rounded-md border border-transparent px-3 py-2 text-left text-xs text-ink transition-colors hover:border-info/30 hover:bg-info/15 hover:text-info";

/**
 * Botón "Exportar" con menú: CSV o Markdown.
 * @param {{ disabled?: boolean, busy?: boolean, onExportCsv: () => void, onExportMarkdown: () => void }} props
 */
const ExportMenu = ({ disabled = false, busy = false, onExportCsv, onExportMarkdown }) => {
  useTranslation(); // re-renderiza al cambiar de idioma
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const pick = (fn) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled || busy}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={TRIGGER}
      >
        <Download className="h-3.5 w-3.5" />
        {busy ? tx("Exportando...") : tx("Exportar")}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-44 rounded-xl border border-line-subtle bg-surface-panel p-1.5 shadow-xl"
        >
          <button type="button" role="menuitem" onClick={pick(onExportCsv)} className={ITEM}>
            <FileSpreadsheet className="h-4 w-4" />
            {tx("Descargar CSV")}
          </button>
          <button type="button" role="menuitem" onClick={pick(onExportMarkdown)} className={`${ITEM} mt-0.5`}>
            <FileText className="h-4 w-4" />
            {tx("Descargar Markdown (.md)")}
          </button>
        </div>
      )}
    </div>
  );
};

export default ExportMenu;
