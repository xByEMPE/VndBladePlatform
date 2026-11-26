import { useTranslation } from "react-i18next";
import { tx } from "@/i18n/tx";
import React, { useCallback, useEffect, useState } from "react";
import { FilePlus2, FolderOpen, Ruler } from "lucide-react";
import WtgCalibrator from "@/pages/wtgwtgmgenerator/src/WtgCalibrator.jsx";
import SavedCalibrations from "@/components/wtgm/SavedCalibrations";
import EditCalibrationDialog from "@/components/wtgm/EditCalibrationDialog";
import PageHeader from "@/components/layout/PageHeader";
import { FOCUS } from "@/lib/classes";
import { listWtgmCalibrations, saveWtgmCalibration } from "@/lib/wtgmStorage";

const TABS = [
  { key: "saved", label: "Calibraciones guardadas", Icon: FolderOpen },
  { key: "new", label: "Nueva calibración", Icon: FilePlus2 },
];

const WtgGeneratorPage = () => {
  useTranslation();
  const [tab, setTab] = useState("saved");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listWtgmCalibrations());
      setError("");
    } catch (e) {
      setError(e.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Al guardar, la lista se actualiza para que la calibración aparezca de inmediato
  const handleSave = async (payload) => {
    const saved = await saveWtgmCalibration(payload);
    refresh();
    return saved;
  };

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-background text-ink">
      <div className="shrink-0 bg-surface-panel">
        <div className="px-3 pt-3 sm:px-5">
          <PageHeader
            className="border-b-0 pb-3"
            icon={<Ruler size={24} />}
            overline={tx("Herramientas")}
            title={tx("Generador de geometría WTG")}
          />
        </div>

        <div className="border-b border-line-subtle px-3 sm:px-5">
          <div role="tablist" aria-label={tx("Secciones del generador")} className="flex gap-1 overflow-x-auto">
            {TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                id={`wtg-tab-${key}`}
                type="button"
                role="tab"
                aria-selected={tab === key}
                aria-controls={`wtg-panel-${key}`}
                onClick={() => setTab(key)}
                className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-xs font-semibold transition-colors ${FOCUS} ${
                  tab === key
                    ? "border-brand text-brand"
                    : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {tx(label)}
                {key === "saved" && rows.length > 0 && (
                  <span className="rounded-sm bg-line-subtle px-1.5 text-[10px] tabular-nums text-ink">{rows.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        id="wtg-panel-saved"
        role="tabpanel"
        aria-labelledby="wtg-tab-saved"
        hidden={tab !== "saved"}
        className="px-3 py-5 sm:px-5"
      >
        <SavedCalibrations
          rows={rows}
          loading={loading}
          error={error}
          onRefresh={refresh}
          onCreate={() => setTab("new")}
          onEdit={setEditing}
        />
        {editing && (
          <EditCalibrationDialog
            key={editing.id}
            row={editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              refresh();
            }}
          />
        )}
      </div>

      {/* Se mantiene montado para no perder fotos ni marcaciones al cambiar de pestaña */}
      <div
        id="wtg-panel-new"
        role="tabpanel"
        aria-labelledby="wtg-tab-new"
        hidden={tab !== "new"}
        className={tab === "new" ? "flex flex-1 flex-col" : ""}
      >
        <WtgCalibrator
          apiUrl={import.meta.env.VITE_HF_API_URL || ""}
          requireInfo
          allowExport={false}
          onSave={handleSave}
        />
      </div>
    </div>
  );
};

export default WtgGeneratorPage;
