import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Pencil, Trash2, Plus, ArrowLeft } from "lucide-react";

const SEVERITIES = [
  { value: "Cat 1", labelKey: "reportEditor.severity.cat1" },
  { value: "Cat 2", labelKey: "reportEditor.severity.cat2" },
  { value: "Cat 3", labelKey: "reportEditor.severity.cat3" },
  { value: "Cat 4", labelKey: "reportEditor.severity.cat4" },
  { value: "Cat 5", labelKey: "reportEditor.severity.cat5" },
];

const SECTIONS = ["TE", "PS", "LE", "SS"];
const BLADES = ["Blade A", "Blade B", "Blade C"];

const initialForm = {
  id: null,
  title: "",
  severity: "Cat 1",
  section: "TE",
  radius: "",
  description: "",
  notes: "",
  blade: "Blade A",
};

export default function ReportEditorPage() {
  const { t } = useTranslation("common");
  const { projectId, turbineId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [project, setProject] = useState(null);
  const [turbine, setTurbine] = useState(null);
  const [damages, setDamages] = useState([]);

  const [form, setForm] = useState(initialForm);
  const [statusMsg, setStatusMsg] = useState("");

  const notify = (msg) => setStatusMsg(msg);

  useEffect(() => {
    let isMounted = true;
    async function loadAll() {
      if (!projectId || !turbineId) {
        notify(t("reportEditor.errors.missingParams"));
        setLoading(false);
        return;
      }

      setLoading(true);
      setStatusMsg(t("messages.loading"));
      try {
        const { data: proj, error: pErr } = await supabase
          .from("projects")
          .select("*")
          .eq("id", projectId)
          .single();
        if (pErr) throw pErr;

        let tur = null;
        let tErr = null;

        const q1 = await supabase
          .from("turbines")
          .select("*")
          .eq("project_id", projectId)
          .eq("name", turbineId)
          .maybeSingle();

        if (q1.error) tErr = q1.error;
        else tur = q1.data;

        if (!tur && tErr && (tErr.code === "42703" || (tErr.details || "").includes('column "name"'))) {
          const q2 = await supabase
            .from("turbines")
            .select("*")
            .eq("project_id", projectId)
            .eq("turbine_name", turbineId)
            .maybeSingle();
          if (q2.error) tErr = q2.error;
          else tur = q2.data;
        }

        const { data: ds, error: dErr } = await supabase
          .from("damages")
          .select("*")
          .eq("project_id", projectId)
          .eq("turbine_name", turbineId)
          .order("created_at", { ascending: false });

        if (isMounted) {
          setProject(proj || null);
          setTurbine(tur || null);
          setDamages(ds || []);
        }

        if (pErr) throw pErr;
        if (tErr && !tur) throw tErr;
        if (dErr) throw dErr;

        notify(t("messages.dataSynced"));
      } catch (err) {
        console.error("Error:", err);
        notify(t("reportEditor.errors.loadFailed", { msg: err.message || String(err) }));
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadAll();
    return () => {
      isMounted = false;
    };
  }, [projectId, turbineId, t]);

  const windPark = project?.wind_farm || "";
  const client = project?.client || "";
  const turbineModel = turbine?.model || "";
  const coords = turbine?.gps || "";

  const onEdit = (dmg) => {
    setForm({
      id: dmg.id,
      title: dmg.title || "",
      severity: dmg.severity || "Cat 1",
      section: dmg.section || "TE",
      radius: dmg.radius ?? "",
      description: dmg.description || "",
      notes: dmg.notes || "",
      blade: dmg.blade || "Blade A",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onNew = () => {
    setForm({ ...initialForm, blade: BLADES.includes(form.blade) ? form.blade : "Blade A" });
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    if (!projectId || !turbineId) return;

    if (!form.title?.trim()) {
      notify(t("forms.required"));
      return;
    }
    if (!SEVERITIES.some((s) => s.value === form.severity)) {
      notify(t("reportEditor.errors.invalidSeverity"));
      return;
    }
    if (!SECTIONS.includes(form.section)) {
      notify(t("reportEditor.errors.invalidSection"));
      return;
    }
    if (!BLADES.includes(form.blade)) {
      notify(t("reportEditor.errors.invalidBlade"));
      return;
    }

    setSaving(true);
    setStatusMsg(t("reportEditor.saving"));
    try {
      const payload = {
        id: form.id || undefined,
        project_id: projectId,
        turbine_name: turbineId,
        blade: form.blade,
        title: form.title,
        severity: form.severity,
        section: form.section,
        radius: form.radius !== "" ? Number(form.radius) : null,
        description: form.description || null,
        notes: form.notes || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("damages")
        .upsert(payload, { onConflict: "id" })
        .select()
        .single();

      if (error) throw error;

      setDamages((prev) => {
        const idx = prev.findIndex((d) => d.id === data.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = data;
          return copy;
        }
        return [data, ...prev];
      });

      notify(t("reportEditor.saved"));
      onNew();
    } catch (err) {
      console.error("Save error:", err);
      notify(t("reportEditor.errors.saveFailed", { msg: err.message || String(err) }));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!id) return;
    if (!window.confirm(t("reportEditor.confirmDelete"))) return;

    setDeleting(true);
    setStatusMsg(t("reportEditor.deleting"));
    try {
      const { error } = await supabase.from("damages").delete().eq("id", id);
      if (error) throw error;
      setDamages((prev) => prev.filter((d) => d.id !== id));
      notify(t("reportEditor.deleted"));
    } catch (err) {
      console.error("Delete error:", err);
      notify(t("reportEditor.errors.deleteFailed", { msg: err.message || String(err) }));
    } finally {
      setDeleting(false);
    }
  };

  const reportData = useMemo(
    () => ({
      windPark,
      windTurbine: turbineId,
      blade: form.blade,
      wtgCoord: coords || "",
      bladeSerialNumber: turbine?.blade_serial || "",
      inspectionDate: turbine?.last_update || "",
    }),
    [windPark, turbineId, form.blade, coords, turbine?.blade_serial, turbine?.last_update]
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto text-slate-100">
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-6">
        <button
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={18} /> {t("forms.back")}
        </button>
        <h1 className="text-2xl font-semibold">{t("reportEditor.title")}</h1>
      </div>

      {!!statusMsg && (
        <div className="mb-4 p-3 rounded-md bg-slate-800 border border-slate-700 text-sm">
          {statusMsg}
        </div>
      )}

      {/* Header readonly data */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="col-span-1 md:col-span-2 bg-slate-900 border border-slate-700 rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-2">{t("reportEditor.project")}</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="opacity-70">{t("progress.windFarm")}</div>
            <div className="truncate">{windPark || "—"}</div>
            <div className="opacity-70">{t("progress.client")}</div>
            <div className="truncate">{client || "—"}</div>
          </div>
        </div>
        <div className="col-span-1 md:col-span-2 bg-slate-900 border border-slate-700 rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-2">{t("reportEditor.turbine")}</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="opacity-70">{t("reportEditor.model")}</div>
            <div className="truncate">{turbineModel || "—"}</div>
            <div className="opacity-70">{t("reportEditor.coordinates")}</div>
            <div className="truncate">{coords || "—"}</div>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm opacity-70 mb-1">{t("reportEditor.fields.title")}</label>
            <input
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2"
              name="title"
              value={form.title}
              onChange={onChange}
              placeholder={t("reportEditor.placeholders.title")}
            />
          </div>

          <div>
            <label className="block text-sm opacity-70 mb-1">{t("reportEditor.fields.severity")}</label>
            <select
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2"
              name="severity"
              value={form.severity}
              onChange={onChange}
            >
              {SEVERITIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {t(s.labelKey)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm opacity-70 mb-1">{t("reportEditor.fields.section")}</label>
            <select
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2"
              name="section"
              value={form.section}
              onChange={onChange}
            >
              {SECTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm opacity-70 mb-1">{t("reportEditor.fields.blade")}</label>
            <select
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2"
              name="blade"
              value={form.blade}
              onChange={onChange}
            >
              {BLADES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm opacity-70 mb-1">{t("reportEditor.fields.radius")}</label>
            <input
              type="number"
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2"
              name="radius"
              value={form.radius}
              onChange={onChange}
              placeholder={t("reportEditor.placeholders.radius")}
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-sm opacity-70 mb-1">{t("reportEditor.fields.description")}</label>
            <textarea
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2"
              name="description"
              value={form.description}
              onChange={onChange}
              rows={3}
              placeholder={t("reportEditor.placeholders.description")}
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-sm opacity-70 mb-1">{t("reportEditor.fields.notes")}</label>
            <textarea
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2"
              name="notes"
              value={form.notes}
              onChange={onChange}
              rows={3}
              placeholder={t("reportEditor.placeholders.notes")}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-yellow-500 hover:bg-yellow-600 text-black"
          >
            <Plus size={16} />
            {saving ? t("forms.saving") : t("buttons.save")}
          </button>

          <button
            type="button"
            onClick={onNew}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-600"
          >
            <Pencil size={16} />
            {t("reportEditor.new")}
          </button>
        </div>
      </form>

      {/* List */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3">{t("reportEditor.registeredDamages")}</h2>
        <div className="space-y-3">
          {damages.map((d) => (
            <div key={d.id} className="p-3 rounded-lg bg-slate-900 border border-slate-700">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{d.title}</div>
                  <div className="text-sm opacity-70">
                    {t("reportEditor.badge.blade")}: {d.blade} • {t("reportEditor.badge.section")}: {d.section} •{" "}
                    {t("reportEditor.badge.severity")}: {d.severity}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onEdit(d)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sm"
                  >
                    <Pencil size={14} /> {t("buttons.edit")}
                  </button>
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-sm"
                  >
                    <Trash2 size={14} /> {t("buttons.delete")}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {damages.length === 0 && (
            <div className="text-sm opacity-70">{t("reportEditor.noDamages")}</div>
          )}
        </div>
      </div>
    </div>
  );
}
