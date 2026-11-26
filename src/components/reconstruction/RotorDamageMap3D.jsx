import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// Colores por categoría (mismos tonos que los chips SEV: emerald, lime, amber, orange, red)
export const SEV_HEX = { 1: "#10b981", 2: "#84cc16", 3: "#f59e0b", 4: "#f97316", 5: "#ef4444" };

// Posición de cada pala vista desde el frente (barlovento), en sentido horario desde las 12h
export const BLADE_ANGLE_DEG = { A: 0, B: 120, C: 240 };

const MODEL_SRC = "/models/3dmodel.glb";
const ROOT_FRAC = 0.06; // fracción del radio del rotor que ocupa el buje (donde empieza la pala)

/**
 * Turbina 3D (modelo GLB de la plataforma) con los daños sobre sus palas: A 12h, B 4h, C 8h.
 * Cada daño se proyecta sobre la superficie real del modelo desde la cara que le corresponde
 * (concha de presión de frente, concha de succión por detrás, bordes por los lados).
 * Hover -> onHover(damage, {x, y}); clic -> onSelect(damage).
 *
 * damages: [{ id, blade: "A", section: "LE", s: 0..1, u: 0..1, sev: 1..5 }]
 */
export default function RotorDamageMap3D({
  damages = [],
  visibleBlades = ["A", "B", "C"],
  visibleSev = [1, 2, 3, 4, 5],
  highlightId = null,
  focusBlade = null, // null = turbina completa
  onHover,
  onSelect,
  onHighlightScreen, // (pos|null): posición en pantalla del daño resaltado (para mostrar su ficha)
  height = 620,
}) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const stateRef = useRef({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Callbacks siempre actualizados sin reconstruir la escena
  const cbRef = useRef({ onHover, onSelect, onHighlightScreen });
  cbRef.current = { onHover, onSelect, onHighlightScreen };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    let disposed = false;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.5, 5000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1a1a, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 0.7);
    sun.position.set(5, 10, 7.5);
    scene.add(sun);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    const markers = [];
    const labels = [];
    let model = null;
    let geo = null; // { center, R, zc }

    new GLTFLoader().load(
      MODEL_SRC,
      (gltf) => {
        if (disposed) return;
        model = gltf.scene;
        const shell = new THREE.MeshStandardMaterial({ color: new THREE.Color("#F7F8F9"), metalness: 0, roughness: 0.9 });
        let rotor = null;
        model.traverse((o) => {
          if (!o.isMesh) return;
          o.material?.dispose?.();
          o.material = shell;
          if (o.name === "Rotor") rotor = o;
        });
        scene.add(model);
        model.updateMatrixWorld(true);

        // Geometría del rotor: palas a 0/120/240°, por lo que alto = 1.5 R
        const bb = new THREE.Box3().setFromObject(rotor || model);
        const R = (bb.max.y - bb.min.y) / 1.5;
        const center = new THREE.Vector3((bb.min.x + bb.max.x) / 2, bb.max.y - R, 0);
        const zc = (bb.min.z + bb.max.z) / 2;
        const depth = bb.max.z - bb.min.z;
        geo = { center, R, zc };

        // Ubicar cada daño proyectándolo sobre la pala desde su cara
        const raycaster = new THREE.Raycaster();
        const markerGeo = new THREE.SphereGeometry(0.012 * R, 16, 12);
        const target = rotor || model;
        for (const d of damages) {
          if (!(d.blade in BLADE_ANGLE_DEG) || !Number.isFinite(d.s)) continue;
          const a = THREE.MathUtils.degToRad(BLADE_ANGLE_DEG[d.blade]);
          const dir = new THREE.Vector3(Math.sin(a), Math.cos(a), 0);
          const tangent = new THREE.Vector3(Math.cos(a), -Math.sin(a), 0); // sentido de giro (horario de frente) -> borde de ataque
          const s = Math.min(0.985, Math.max(0, d.s));
          const axis = center.clone().addScaledVector(dir, R * (ROOT_FRAC + s * (1 - ROOT_FRAC)));
          axis.z = zc;
          const off = (d.u ?? 0.5) - 0.5;
          const chord = R * 0.05;
          const thick = depth * 0.25;
          const cast = {
            PS: { from: new THREE.Vector3(0, 0, 1), shift: tangent.clone().multiplyScalar(off * chord) },
            SS: { from: new THREE.Vector3(0, 0, -1), shift: tangent.clone().multiplyScalar(-off * chord) },
            LE: { from: tangent.clone(), shift: new THREE.Vector3(0, 0, off * thick) },
            TE: { from: tangent.clone().negate(), shift: new THREE.Vector3(0, 0, -off * thick) },
          }[d.section] || { from: new THREE.Vector3(0, 0, 1), shift: new THREE.Vector3() };

          let point = null;
          for (const shift of [cast.shift, new THREE.Vector3()]) {
            const origin = axis.clone().add(shift).addScaledVector(cast.from, R);
            raycaster.set(origin, cast.from.clone().negate());
            const hit = raycaster.intersectObject(target, true)[0];
            if (hit) {
              point = hit.point.clone().addScaledVector(cast.from, 0.006 * R);
              break;
            }
          }
          if (!point) point = axis;

          const color = SEV_HEX[d.sev] || SEV_HEX[3];
          const m = new THREE.Mesh(
            markerGeo,
            new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, roughness: 0.4 }),
          );
          m.position.copy(point);
          m.userData.damage = d;
          scene.add(m);
          markers.push(m);
        }

        // Etiquetas A/B/C en la punta de cada pala
        for (const [blade, deg] of Object.entries(BLADE_ANGLE_DEG)) {
          const a = THREE.MathUtils.degToRad(deg);
          const label = makeLabel(blade);
          label.position.copy(center).add(new THREE.Vector3(Math.sin(a), Math.cos(a), 0).multiplyScalar(R * 1.08));
          label.position.z = zc;
          label.scale.setScalar(R * 0.09);
          label.userData.blade = blade;
          scene.add(label);
          labels.push(label);
        }

        controls.minDistance = R * 0.15;
        controls.maxDistance = R * 10;
        camera.near = R / 200;
        camera.far = R * 50;
        camera.updateProjectionMatrix();
        stateRef.current = { ...stateRef.current, markers, labels, frame };
        applyVisibility();
        frame(stateRef.current.focusBlade);
        setLoading(false);
      },
      undefined,
      () => {
        if (!disposed) {
          setError(t("reconstruction.model3dError"));
          setLoading(false);
        }
      },
    );

    // Vistas: turbina completa o una pala
    function frame(blade) {
      if (!geo) return;
      const { center, R, zc } = geo;
      const target = center.clone();
      target.z = zc;
      let dist = R * 3.2;
      if (blade && blade in BLADE_ANGLE_DEG) {
        const a = THREE.MathUtils.degToRad(BLADE_ANGLE_DEG[blade]);
        target.add(new THREE.Vector3(Math.sin(a), Math.cos(a), 0).multiplyScalar(R * 0.55));
        dist = R * 1.9;
      }
      controls.target.copy(target);
      camera.position.set(target.x + dist * 0.18, target.y + dist * 0.06, target.z + dist);
      controls.update();
    }

    // Interacción: hover y clic (sin disparar clic al arrastrar)
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let down = null;
    const pick = (e) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      return raycaster.intersectObjects(markers.filter((m) => m.visible), false)[0]?.object || null;
    };
    const onMove = (e) => {
      const m = pick(e);
      renderer.domElement.style.cursor = m ? "pointer" : "grab";
      const r = container.getBoundingClientRect();
      cbRef.current.onHover?.(m ? m.userData.damage : null, { x: e.clientX - r.left, y: e.clientY - r.top });
    };
    const onLeave = () => cbRef.current.onHover?.(null);
    const onDown = (e) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const m = pick(e);
      if (m) cbRef.current.onSelect?.(m.userData.damage);
    };
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerleave", onLeave);
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.style.cursor = "grab";

    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(container);

    let raf = 0;
    let lastPos = null;
    const proj = new THREE.Vector3();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = performance.now() / 1000;
      let hlMarker = null;
      for (const m of markers) {
        const hl = m.userData.damage.id === stateRef.current.highlightId;
        if (hl && m.visible) hlMarker = m;
        m.scale.setScalar(hl ? 1.9 + Math.sin(t * 6) * 0.25 : 1);
      }
      controls.update();
      renderer.render(scene, camera);

      // Informar dónde está en pantalla el daño resaltado (solo si cambió)
      let pos = null;
      if (hlMarker) {
        proj.copy(hlMarker.position).project(camera);
        pos = {
          x: Math.round(((proj.x + 1) / 2) * container.clientWidth),
          y: Math.round(((1 - proj.y) / 2) * container.clientHeight),
        };
      }
      if (pos?.x !== lastPos?.x || pos?.y !== lastPos?.y) {
        lastPos = pos;
        cbRef.current.onHighlightScreen?.(pos);
      }
    };
    loop();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerleave", onLeave);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        if (o.material) {
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((mat) => {
            mat.map?.dispose();
            mat.dispose();
          });
        }
      });
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [damages]);

  // Filtros y resaltado sin reconstruir la escena (con el GLB las palas no se ocultan: se filtran sus daños)
  function applyVisibility() {
    const st = stateRef.current;
    if (!st.markers) return;
    for (const m of st.markers) {
      const d = m.userData.damage;
      m.visible = (st.visibleBlades?.includes(d.blade) ?? true) && (st.visibleSev?.includes(d.sev) ?? true);
    }
  }

  useEffect(() => {
    Object.assign(stateRef.current, { visibleBlades, visibleSev, highlightId });
    applyVisibility();
  }, [visibleBlades, visibleSev, highlightId]);

  useEffect(() => {
    stateRef.current.focusBlade = focusBlade;
    stateRef.current.frame?.(focusBlade);
  }, [focusBlade]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-md border border-white/10 bg-gradient-to-b from-slate-900 to-[#030712]"
      style={{ height }}
      role="img"
      aria-label={t("reconstruction.model3dAria")}
    >
      {loading && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-white/10 bg-slate-900/90 px-2.5 py-1.5 text-xs text-slate-300">
          {t("reconstruction.loading3d")}
        </div>
      )}
      {error && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-200">
          {error}
        </div>
      )}
    </div>
  );
}

// Etiqueta "A/B/C" como sprite
function makeLabel(text) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgba(15,23,42,0.9)";
  ctx.beginPath();
  ctx.arc(64, 64, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.fillStyle = "#fbbf24";
  ctx.font = "bold 64px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
}
