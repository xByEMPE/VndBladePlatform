import React from "react";
import { normSev, getDamageMetrics } from "../../shared/damage";
import BladeModelViewer from "@/components/BladeModelViewer";

export const BladeViewerPanel = ({ editingDetection, detections, isSidebarOpen, initialDamageInfo, bladeLength, project, turbine, selectedDamageId, bladeDamages, goToDamage }) => (
  <div
      className={`relative overflow-hidden border-l border-line-subtle bg-surface-panel transition-all duration-300 ease-in-out ${isSidebarOpen ? "hidden lg:block lg:w-60" : "w-0 border-none"}`}
      style={{ opacity: isSidebarOpen ? 1 : 0 }}
  >
     {isSidebarOpen && (
        <BladeModelViewer
          bladeLength={(() => {
            // PRIORITY 1: Turbine data from database (requested by user)
            if (turbine?.blade_length) {
              const lengthMeters = turbine.blade_length;

              // Safety check for units (if > 200 assumes mm)
              let finalLength = lengthMeters;
              if (lengthMeters > 200) { 
                  finalLength = lengthMeters / 1000;
              }

              console.log("[DamageEditor] Using blade length from TURBINE:", finalLength);
              return finalLength;
            }

            // PRIORITY 2: Project data from database
            if (project?.blade_length) {
              const lengthMeters = project.blade_length; 

              // Safety check for units
              let finalLength = lengthMeters;
              if (lengthMeters > 200) { 
                  finalLength = lengthMeters / 1000;
              }

              console.log("[DamageEditor] Using blade length from PROJECT:", finalLength);
              return finalLength;
            }

            // PRIORITY 3: Prop passed from navigation
            if (bladeLength) {
              console.log("[DamageEditor] Using blade length from PROP:", bladeLength);
              return bladeLength;
            }

            // PRIORITY 4: Default fallback
            console.warn("[DamageEditor] Using default blade length: 50m");
            return 50;
          })()}
          damages={bladeDamages.map((d) => {
            // Si el daño está abierto en el lienzo se usa su valor en vivo (al mover el recuadro)
            const live = detections.find((x) => String(x.id) === String(d.id));
            const m = getDamageMetrics(d);
            const liveRadio = live ? parseFloat(live.radio) : NaN;
            const markerRadio = Number.isFinite(liveRadio) ? liveRadio : m.radio;
            return {
              id: d.id,
              radio: markerRadio > 0 ? markerRadio : null,
              severity: live?.severity || normSev(d.severity),
              damage_type: live?.damage_type || m.damage_type,
              capture_id: d.capture_id,
            };
          })}
          currentDamageId={selectedDamageId || editingDetection?.id || initialDamageInfo?.damageId}
          onDamageClick={(damageId) => goToDamage(damageId)}
        />
     )}
  </div>
);
