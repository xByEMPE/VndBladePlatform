import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { getLocalizedDamageString } from "@/pages/DamageEditorPage";

const DetectionEditModal = ({ detection, onSave, onClose }) => {
  const { t, i18n } = useTranslation();
  // Configuración de campos editable
  const [severity, setSeverity] = useState(detection.severity || "Cat 3");
  const [category, setCategory] = useState(detection.category || "Daño");
  const [damageType, setDamageType] = useState(detection.damage_type || detection.category || "Daño");
  const [comments, setComments] = useState(detection.description || "");

  const damageTypes = [
    "Erosión de borde de ataque",
    "Fisura",
    "Delaminación",
    "Impacto de rayo sin daños en el laminado",
    "Daños en cinta de protección de BA",
    "Suciedad",
    "Otros"
  ];

  const handleSave = () => {
    onSave({
      ...detection,
      severity,
      category,
      damage_type: damageType,
      description: comments,
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-slate-800 p-6 rounded-lg w-96 border border-slate-600">
        <h3 className="text-white text-lg font-bold mb-4">{t("reportViewer.editDetection", { defaultValue: "Editar Detección" })}</h3>

        {/* Dimensions Display */}
        <div className="mb-4 bg-slate-700/50 p-3 rounded border border-slate-600">
          <label className="block text-slate-400 text-xs mb-2 font-medium uppercase tracking-wider">{t("reportViewer.calculatedDimensions", { defaultValue: "Dimensiones Calculadas" })}</label>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
             <div className="flex justify-between">
                <span className="text-slate-400">{t("reportViewer.width", { defaultValue: "Transversal" })}:</span> 
                <span className="text-white font-mono">{Math.round(detection.width_mm || detection.width || 0)} mm</span>
             </div>
             <div className="flex justify-between">
                <span className="text-slate-400">{t("reportViewer.height", { defaultValue: "Longitudinal" })}:</span> 
                <span className="text-white font-mono">{Math.round(detection.length_mm || detection.length || 0)} mm</span>
             </div>
             <div className="flex justify-between">
                 <span className="text-slate-400">{t("reportViewer.radius", { defaultValue: "Radio" })}:</span> 
                 <span className="text-white font-mono">{((detection.radius_mm || detection.radius || 0) / 1000).toFixed(2)} m</span>
             </div>
             <div className="flex justify-between">
                 <span className="text-slate-400">{t("reportViewer.area", { defaultValue: "Área" })}:</span> 
                 <span className="text-white font-mono">{Math.round(detection.area || 0)} mm²</span>
             </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-slate-400 text-sm mb-1">{t("reportViewer.severity", { defaultValue: "Severidad" })}</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="w-full bg-slate-700 text-white rounded p-2 text-sm border border-slate-600"
          >
            <option value="Cat 1">{t("reportViewer.cat1", { defaultValue: "Cat 1" })}</option>
            <option value="Cat 2">{t("reportViewer.cat2", { defaultValue: "Cat 2" })}</option>
            <option value="Cat 3">{t("reportViewer.cat3", { defaultValue: "Cat 3" })}</option>
            <option value="Cat 4">{t("reportViewer.cat4", { defaultValue: "Cat 4" })}</option>
            <option value="Cat 5">{t("reportViewer.cat5", { defaultValue: "Cat 5" })}</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-slate-400 text-sm mb-1">{t("reportViewer.damageType", { defaultValue: "Tipo de Daño" })}</label>
          <select
            value={damageType}
            onChange={(e) => {
                setDamageType(e.target.value);
                setCategory(e.target.value); // Sync category if needed
            }}
            className="w-full bg-slate-700 text-white rounded p-2 text-sm border border-slate-600"
          >
            {damageTypes.map(type => (
                <option key={type} value={type}>{getLocalizedDamageString(type, i18n)}</option>
            ))}
          </select>
        </div>

        <div className="mb-6">
          <label className="block text-slate-400 text-sm mb-1">{t("reportViewer.comments", { defaultValue: "Comentarios" })}</label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            className="w-full bg-slate-700 text-white rounded p-2 text-sm border border-slate-600 h-24 resize-none"
            placeholder={t("reportViewer.addDescriptionPlaceholder", { defaultValue: "Agregar descripción o comentarios..." })}
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-500"
          >
            {t("common.cancel", { defaultValue: "Cancelar" })}
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
          >
            {t("common.save", { defaultValue: "Guardar" })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DetectionEditModal;
