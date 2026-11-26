# Contexto: Generador WTG (.wtgm)

Resumen de lo implementado para integrar el calibrador de geometría WTG en la plataforma: código web y base de datos (Supabase).

## 1. Objetivo

Sección solo para administradores, accesible desde el menú inicial, que:

1. Permite cargar 2 fotos de calibración de una turbina (Foto 1: góndola → punta de pala; Foto 2: góndola → cimentación).
2. Antes de anotar, pide los datos de la turbina (con confirmación si faltan campos).
3. Calcula los 11 valores de geometría y genera el archivo `.wtgm`.
4. Con las marcaciones completas, habilita **Guardar**: sube las fotos a un bucket privado y registra todo en la tabla `wtgmFile`.

## 2. Código web

### Archivos nuevos
| Archivo | Función |
|---|---|
| `src/pages/WtgGeneratorPage.jsx` | Página contenedora con el encabezado de la plataforma (Volver, ícono ámbar, "Generador de geometría WTG", etiqueta Administrador). Monta el calibrador con `requireInfo` y `onSave`. |
| `src/lib/wtgmStorage.js` | `saveWtgmCalibration(payload)`: sube las 2 fotos al bucket y hace `upsert` de la fila en `wtgmFile`. |
| `src/pages/wtgwtgmgenerator/src/TurbineInfoDialog.jsx` | Diálogo modal con los 6 datos requeridos y confirmación de campos faltantes. |
| `supabase/migrations/20261024120000_wtgm_file.sql` | Tabla, bucket y políticas RLS. |

### Archivos modificados
| Archivo | Cambio |
|---|---|
| `src/App.jsx` | Ruta `/wtg-generator` protegida con `RoleGuard requiredRole="admin"`. |
| `src/lib/utils.js` | `/wtg-generator` añadida solo a `ROLE_ACCESS` del rol admin. |
| `src/pages/DashboardPage.jsx` | Tarjeta "Generador WTG" en Módulos (solo admin). La grilla pasa a `lg:grid-cols-3 xl:grid-cols-5`. |
| `src/pages/wtgwtgmgenerator/src/WtgCalibrator.jsx` | Props opcionales `requireInfo` y `onSave`; diálogo previo a anotar; botón Guardar; campo Fabricante; "Tipo WTG" renombrado a "Modelo WTG"; se quitó el título propio (lo aporta la página). |
| `src/pages/wtgwtgmgenerator/src/WtgCalibrator.css` | Paleta de la plataforma (`#030712`, ámbar `#f59e0b`, bordes translúcidos), fuente heredada, estilos del diálogo, y neutralización del CSS global de `input`/`select` (padding `.75rem !important`) para que los campos no salgan recortados. |

### Comportamiento
- **Diálogo**: se abre al tener las 2 fotos cargadas y no se cierra con Esc. Campos: Parque eólico, Fabricante/Tecnólogo, Modelo WTG, Altura de torre (m), Diámetro de rotor (m), Longitud de pala (m). Si falta alguno, "Continuar" muestra la lista de faltantes y pregunta si continuar sin ellos. Sin longitud de pala no se calcula ni se guarda hasta capturarla.
- **Guardar**: habilitado con las 2 fotos cargadas y el resultado calculado. Rutas en el bucket: `<id>/photo1_<nombre>` y `<id>/photo2_<nombre>`. Un segundo guardado actualiza el mismo registro y no resube fotos idénticas en la misma sesión. Si el primer guardado falla, se borran las fotos subidas. Se muestra "Guardado" mientras no haya cambios posteriores.
- El calibrador sigue funcionando como app independiente (`main.jsx`) sin diálogo ni Guardar, porque las props son opcionales.
- Si se vuelve a reemplazar la carpeta `wtgwtgmgenerator`, hay que reaplicar el estilo y los cambios de `WtgCalibrator.jsx`/`.css` y `TurbineInfoDialog.jsx`.

## 3. Base de datos (Supabase)

Script: `supabase/migrations/20261024120000_wtgm_file.sql`. **Estado: escrito, pendiente de ejecutar** en el SQL Editor (el conector de Supabase no estaba autorizado).

### Tabla `public."wtgmFile"` (nombre entre comillas, camelCase)
- `id uuid` (PK, generado en cliente), `created_at`, `updated_at` (trigger `update_updated_at_column`), `created_by` (`auth.uid()`).
- Turbina: `wind_farm`, `manufacturer`, `wtg_model`, `tower_height_m`, `rotor_diameter_m`, `blade_length_m`, `blade_length_ref`, `axis_source`, `turbine_code`, `power_rating`, `missing_fields text[]`.
- Fotos (relación con el bucket): `photo1_path`, `photo1_name`, `photo1_width`, `photo1_height` y lo equivalente para `photo2_*`.
- Resultado: `keypoints`, `geometry` (valores, diagnósticos, avisos), `uncertainty`, `wtgm` (documento completo), `method`, `sigma_px` (todos jsonb salvo `method` y `sigma_px`).

### Bucket `wtgmFile`
Privado (`public = false`).

### RLS
- Tabla: política `FOR ALL` para `authenticated` con `get_current_user_role() = 'admin'`.
- `storage.objects` del bucket `wtgmFile`: políticas de select, insert, update y delete, todas restringidas al rol admin.

## 4. Pendientes

1. Ejecutar el SQL en Supabase.
2. Probar con sesión admin: diálogo, aviso de campos faltantes, guardado, fila creada y 2 fotos en el bucket.
3. Confirmar que técnico y cliente no pueden leer ni escribir tabla ni bucket.
4. Verificación visual del calibrador y su comportamiento responsive (no se pudo por sesión cerrada en el navegador integrado).
5. Opcional: pantalla para listar y reabrir calibraciones guardadas.
6. Verificación realizada hasta ahora: `vite build` correcto. No se corrieron lint ni tests.

## 5. Actualización: lista de calibraciones guardadas

`WtgGeneratorPage` ahora tiene dos pestañas:

- **Calibraciones guardadas** (por defecto): lista desde la tabla `wtgmFile` (`listWtgmCalibrations()` en `src/lib/wtgmStorage.js`). Cada fila muestra el **modelo de WTG** como indicador destacado, parque, fabricante, ID, fecha, torre/rotor/pala, método y aviso de datos sin completar. Filtros por modelo con conteo. El único botón de cada fila es **Generar .wtgm**, que descarga el documento `wtgm` guardado de esa turbina. Componente: `src/components/wtgm/SavedCalibrations.jsx` (estados de carga, error y vacío).
- **Nueva calibración**: el calibrador (queda montado al cambiar de pestaña para no perder fotos ni marcaciones). Con `allowExport={false}` ya no muestra su propio "Generar .wtgm"; al guardar se refresca la lista.

## 6. Actualización: catálogo de 5 modelos y edición de calibraciones

- **Catálogo**: `turbine_catalog.json` ahora trae V90, AW-125/3000, AW132, G145 y G80. Varios traen `hubLength: null`; el script `scripts/seed-wtgm-catalog.mjs` usa el valor genérico (2.5 m) y lo marca en `missing_fields` y en los avisos, igual que `nacelleThickness`. El SQL regenerado (`supabase/seeds/wtgm_catalog.sql`) se aplicó en la base (upsert por id determinista, 5 filas).
- **Editar guardadas** (con o sin fotos): botón **Editar** en cada fila de la lista, junto a **Generar .wtgm**. `EditCalibrationDialog.jsx` edita los datos de la turbina y los 11 valores del .wtgm; `updateWtgmCalibration()` (en `src/lib/wtgmStorage.js`) regenera el documento con su checksum y actualiza la fila. Los valores cambiados marcan `method = 'edited'`, se anula su incertidumbre y se eliminan sus avisos de "valor genérico". Las filas sin fotos muestran "Sin fotos de calibración".
- **Deploy (Hostinger)**: `public/.htaccess` cacheaba `index.html` 7 días en el CDN (`s-maxage=604800`), por lo que la sección nueva no aparecía tras subir el build. Ahora el HTML va con `no-cache` y solo `/assets/` (con hash) se cachea.

`WtgCalibrator.jsx` recibe la nueva prop opcional `allowExport` (por defecto `true`, así la app independiente no cambia).
