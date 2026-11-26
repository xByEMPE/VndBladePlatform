# Arquitectura de `src/pages` tras la modularización

Documento de cierre del refactor de la rama `refactor/modularization` (31 commits locales sobre `chore/cleanup`).
Alcance: solo `src/pages/` (se excluye `src/pages/wtgwtgmgenerator/`, que es una mini-app independiente).

> Principio del refactor: **mismo comportamiento, otra estructura.** Los cuerpos de código se movieron sin reescribir,
> se conservó el orden de hooks y efectos, y no se introdujeron `useCallback`, `React.memo` ni contextos nuevos.

## 1. Mapa de módulos

```
src/pages/
├── *Page.jsx                  Páginas (orquestadores): estado + llamadas a hooks + composición de componentes
├── shared/                    Código compartido entre páginas
│   ├── data/                  Capa de acceso a Supabase (una función por consulta)
│   ├── damage/                Reglas y utilidades de daños (tipos, traducciones, severidad, bbox, datos extra)
│   ├── image/                 Miniaturas y recorte de imágenes con bbox
│   └── roles.js               Comparaciones de rol (canEditByRole, isClientRole)
├── reportViewer/              Visor de reportes (ReportViewerPage)
│   ├── hooks/                 useReportData, useDamageActions, useImageBridge, useStitched
│   ├── components/            header/, overview/, tabs/, dialogs/ + DamageThumbnail
│   ├── pdf/                   Generación del PDF (una función por página + createReportPdf)
│   └── utils/                 constants, labels, urls, renderBoundingBox
├── damageEditor/              Editor de daños (DamageEditorPage)
│   ├── hooks/                 useEditorData, useDamageMetrics, useEditorBridge, useDetectionActions, useCanvasInteraction
│   ├── components/            EditorHeader, EditorToolbar, BladeViewerPanel, SectionsPanel, DamageInfoPanel,
│   │                          DetectionsPanel, ImageStage, ComparePanel
│   └── utils/                 downloads, editorState
└── imageViewer/               Visor de imágenes (ImageViewerPage)
    ├── hooks/                 useViewerMetrics, useViewerData, useExifHydration, useCalibration, useViewerView
    ├── components/            ViewerTopBar, ViewerCanvas, ThumbnailsPanel, ViewerDetectionModal
    └── utils/                 stitched (parseStitched)
```

Tamaños (líneas): `ReportViewerPage` 7290 → 1412 · `DamageEditorPage` 3128 → ~890 · `ImageViewerPage` 1355 → ~265.
Carpetas nuevas: `reportViewer` 34 archivos, `damageEditor` 15, `imageViewer` 10, `shared` 18. Sin ciclos de importación.

## 2. Capa compartida (`shared/`)

| Módulo | Responsabilidad |
|---|---|
| `shared/data/*` | Envoltorios finos de Supabase que devuelven `{ data, error }` (catalogs, projects, turbines, blades, captures, findings). Las páginas no llaman a `supabase.from(...)` directamente para estas consultas. |
| `shared/damage/*` | Tipos de daño y traducciones (`damageTypes`, `damageTranslations`, `localizeDamage`), severidad (`severity`), geometría del recuadro (`bbox`) y datos extra de un daño (`damageData`). `DamageEditorPage` mantiene el re-export de `getLocalizedDamageString` por compatibilidad con `DetectionEditModal` y `App.jsx`. |
| `shared/image/*` | Miniaturas (`thumbnails`) y recorte con bbox sobre canvas (`canvasBbox`). |
| `shared/roles.js` | `canEditByRole(role)` = administrador o técnico. `isClientRole(role)` = cliente. |

## 3. Visor de reportes (`reportViewer/`)

`ReportViewerPage` conserva el estado, la selección de daños para el PDF y la composición. El resto vive en:

- **Hooks**
  - `useReportData`: carga del reporte (proyecto, turbina, palas, daños, imágenes) y refresco manual.
  - `useDamageActions`: editar, borrar y guardar detecciones de un daño; estado de los diálogos asociados.
  - `useImageBridge`: puente con otras ventanas (escucha `postMessage`, abre el editor y el visor de imágenes).
  - `useStitched`: reconstrucción (imagen cosida) y apertura del visor desde ella.
- **Componentes** (props planas, sin contexto): cabecera (`ReportHeader`, `ProjectInfoPanel`, `TurbineIdPanel`,
  `ReportTabsBar`), resumen (`ExportSection`, `BladeStatusSection`, `BladeDetailSection`, `DamageListSection`,
  `DamageCard`), pestañas (`ImagesTab`, `StitchedTab`) y diálogo (`DeleteDamageDialog`).
- **PDF**: `createReportPdf` ensambla las páginas (`createCoverPage`, `createContentsPage`, `createExecutiveSummaryPage`,
  `createInspectionResultsPage`, etc.) mediante fábricas `make*` que reciben sus dependencias por parámetro.
  `jspdf` se carga con `import()` dinámico.

## 4. Editor de daños (`damageEditor/`)

`DamageEditorPage` (~890 líneas) declara el estado y llama, en este orden, a:

1. `useExifData` (hook externo) y `useEditorData` (proyecto, turbina, capturas, `getSectionLabel`).
2. `useDamageMetrics` (derivación pura: GSD, radio, `calculateMetrics`, `getGlobalY`, `updateDamageMetrics`).
3. `useEditorBridge` (recibe el estado enviado por el visor: `NAVIGATION_STATE_KEY` + respaldo en `localStorage` / `sessionStorage`).
4. `useCanvasInteraction` (zoom, pan, arrastre/redimensión del recuadro, polígonos, táctil, filtros, tecla Escape).
5. `useDetectionActions` (guardar y eliminar detecciones; incluye los `postMessage` de salida hacia `window.opener`).

La interfaz se compone con `EditorHeader`, `EditorToolbar`, `ImageStage` (visor principal), `ComparePanel` (visor secundario),
`BladeViewerPanel` (modelo 3D), `SectionsPanel`, `DamageInfoPanel` y `DetectionsPanel`.

## 5. Visor de imágenes (`imageViewer/`)

`ImageViewerPage` (~265 líneas, sin efectos propios) llama a: `useExifHydration`, `useViewerMetrics`, `useViewerData`
(inicialización, sesión, metadatos, manifiesto, turbina; devuelve `retryAuth`), `useExifData`, `useCalibration`
(calibración manual del modo *stitched*) y `useViewerView` (zoom, reinicio de vista, estilo de filtros).
Se compone con `ViewerTopBar`, `ViewerCanvas`, `ThumbnailsPanel` y `ViewerDetectionModal`.

## 6. Flujo de estado entre ventanas

El visor de reportes, el editor y el visor de imágenes se comunican entre pestañas/ventanas del mismo origen:

```
ReportViewer ──(localStorage: damageEditorState_<id> / imageViewerState_<id>; URL ?stateKey=)──▶ Editor / Visor
ReportViewer ──(postMessage NAVIGATION_STATE_KEY { storageKey })──────────────────────────────▶ Editor (ya abierto)
Editor        ──(sessionStorage: damageEditorState)  persistencia ante F5
Editor        ──(window.opener.postMessage)──▶ ReportViewer:
                 vind:bbox-update · vind:severity-update · vind:metadata-update · DAMAGE_UPDATED · DAMAGE_DELETED
Visor imágenes ─(postMessage)──▶ ReportViewer: vind:bbox-create · vind:bbox-delete · DELETE_DAMAGE · UPDATE_DAMAGE
ReportViewer  ──(event.source.postMessage)──▶ vind:bbox-created
```

Reglas de implementación:
- **Entrada:** `useEditorBridge` (editor) y `useImageBridge` (reportes) son los únicos listeners de `message`.
- **Salida:** los mensajes hacia `window.opener` viven en `useDetectionActions`, junto a la escritura en la base de datos.
- Estado que se hereda por URL/almacenamiento: `takePendingEditorState` y `readSessionEditorState` (`damageEditor/utils/editorState.js`).

## 7. Centralización de roles

- Fuente de verdad del rol: hook `useRolePermissions` (`src/hooks`), que consulta el rol real del usuario.
- Comparaciones repetidas: `shared/roles.js` (`canEditByRole`, `isClientRole`), usadas en `DamageEditorPage`,
  `useCalibration`, `GeneralProgressPage` y `ReportsPortalPage`.
- Las demás páginas siguen usando las formas del hook (`isAdmin()`, `isClient()`…) sin cambios.
- Pendiente (ver informe de revisión): `DamageEditorPage` toma `userRole` del estado de navegación y no del hook.

## 8. Convenciones adoptadas

1. **Props planas y explícitas** en componentes extraídos (hasta 38 props); sin contexto ni `React.memo`.
2. **Hooks con parámetros explícitos** (objeto desestructurado) y valores devueltos nombrados; la llamada ocupa la
   posición del primer efecto/estado que contiene, para conservar el orden de hooks y efectos.
3. **Cuerpos verbatim:** el código movido es idéntico al original (comprobado por AST y por diferencia contra `HEAD`).
4. **Código sin uso se deja en su sitio** hasta una etapa de limpieza (por ejemplo `applyImageFilters`, `updateDamageInfo`,
   estado `sidebarHover`) y los imports sobrantes de las páginas.
5. **Un commit local por etapa**, sin `push`.

## 9. Cómo se verificó cada etapa

- Script AST: cuerpo idéntico, página = `HEAD` menos lo movido, mismos efectos (orden, dependencias, cuerpo), parámetros
  declarados = usados = pasados, sin referencias previas a la llamada.
- ESLint (`no-undef`) con configuración temporal fuera del repositorio y `vite build` con código 0.
- Comparación en navegador, versión anterior contra nueva, con Supabase simulado: DOM, peticiones, errores y mensajes.
- Pruebas manuales del usuario tras cada commit.
- Limitaciones: no hay tests automáticos ni lint configurado en el proyecto; el arnés no cubre WebGL, descargas reales ni RLS.

## 10. Pendientes conocidos (fuera del refactor)

Ver el informe de la Fase 7: validación de origen en los listeners de `postMessage`, rol del editor tomado del estado de
navegación, ruta `/damage-editor-test` en producción, lógica duplicada entre `ProjectsPage` y `DataCapturePage`,
carga diferida de rutas, limpieza de imports/estado sin uso, desincronización de la insignia de severidad en el visor de
reportes y el timeout intermitente `57014` de la base de datos.
