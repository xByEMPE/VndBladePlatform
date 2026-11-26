# Reporte: mapa interactivo de aerogeneradores y hoja de ruta

Entrega cerrada el 2026-11-24 en la rama `design-system`. Este documento resume lo construido, cómo se verificó, lo que
quedó pendiente y el plan acordado para las siguientes tareas. Complementa a `REPORTE_DEPURACION.md` (limpieza y
seguridad de la sesión anterior).

## 1. Resumen

La pantalla **Avance general** muestra, para los proyectos de dron, un mapa interactivo (MapLibre + OpenFreeMap) en lugar
de la lista de turbinas. Cada aerogenerador es una figura con aspas que giran, pintada según el daño máximo, ubicada en
su coordenada. Los proyectos LPS conservan la lista.

El usuario hizo la revisión visual completa en el navegador y la dio por buena: aspas, tarjeta de detalle con foto y
enlace al reporte, leyenda y filtros, consola sin errores ni bloqueos de CSP, filtrado del rol cliente,
`BladeModelViewer` y proyectos LPS.

## 2. Qué se entregó

| Commit | Contenido |
|---|---|
| `b9069572` | RPC `get_project_map_data` (severidad máxima, nº de hallazgos y posición estimada por turbina). |
| `5d524db0` | Utilidades, capa de datos, hook y dependencias (`maplibre-gl`, `react-map-gl`). |
| `416dddb2` | El mapa en `GeneralProgressPage` (solo dron). |
| `92958778` | Giro más barato, severidad que se refresca y propuesta para acotar la RPC. |
| `53f87693` | Migración con muestreo del GPS (hasta 10 capturas por pala). |

En total: 30 archivos, +3456 / −26 líneas. Todo está en local; no se hizo `push`.

**Funcionalidad**

- Posición de cada turbina por prioridad: `turbines.coordinates` → mediana del GPS de sus capturas → bandeja
  «Turbinas sin ubicación» (solo aparece si hay casos). El detalle indica si la coordenada es «registrada» o «estimada
  por fotos».
- Color por severidad máxima Cat 1–5 (neutro si no hay daños o no está inspeccionada), con leyenda que también filtra.
- Detalle al pasar el mouse (se fija con un clic): foto de identificación firmada al abrirlo, severidad máxima
  («Ninguna» si no hay), daños, estado y botón del reporte. La tarjeta se coloca según el espacio real del mapa y nunca
  se corta.
- Eliminar reporte solo para admin/dev (botón rojo). Los clientes ven únicamente turbinas «Aprobado».
- Carga diferida (`React.lazy` + `Suspense`), reintento ante errores de teselas y fallo de la RPC contenido sin romper
  la pantalla.
- Estilos de mapa `light`/`dark` desacoplados en `src/lib/mapStyles.js`: añadir satélite es una entrada nueva.
- Escala de severidad compartida en `src/lib/severity.js` (la usan el mapa y `BladeModelViewer`; el PDF conserva su
  paleta). Contraste WCAG verificado por prueba.

## 3. Decisiones y su motivo

| Decisión | Motivo |
|---|---|
| RPC `SECURITY INVOKER` con `search_path` fijo y `EXECUTE` solo para `authenticated` | Respeta el RLS del usuario; sin acceso para `anon`. |
| Mediana del GPS en vez de promedio | Una foto con GPS erróneo no desplaza el punto. |
| Posición estimada cuando `coordinates` está vacío | La turbina 25 no tiene coordenadas, pero sus 212 fotos sí tienen GPS. |
| Worker de MapLibre registrado explícitamente (`src/lib/maplibre.js`) | MapLibre 6 deduce la URL del worker de `import.meta.url`; Vite mueve el módulo y el mapa quedaba vacío («Worker failed to load»). Fallaba también en producción. |
| Colocación calculada en `src/lib/popupPlacement.js` | MapLibre elige el ancla antes de que la tarjeta tenga su tamaño final y no conoce la altura de la figura. |
| Filtro de clientes en el frontend | Igual que la lista anterior; endurecerlo en BD sería vía RLS en `turbines`. |

## 4. Verificación

| Comprobación | Resultado |
|---|---|
| Suite de pruebas | 547 de 547 pasan (29 archivos). |
| ESLint | Sin errores en lo nuevo; 6 avisos preexistentes en `GeneralProgressPage.jsx`. |
| `vite build` | Compila. El mapa (chunk `TurbineMap`, con `maplibre-gl`: ~318 kB gzip) y su worker (~549 kB) salen en archivos aparte y solo se descargan al abrir el mapa. |
| RPC con usuarios reales (RLS) | Con acceso: 1 fila, 66 ms. Admin: 62 ms. Sin acceso: 0 filas. `anon`: `permission denied`. |
| Severidad máxima | Probada con hallazgos simulados dentro de una transacción revertida (resultado 5 con severidades 2, 5 y 3). |
| `npm audit` | Ninguna de las 6 vulnerabilidades viene de `maplibre-gl` ni `react-map-gl` (ver 7.4). |
| Revisión visual en navegador | Hecha y aprobada por el usuario. |

Las medidas de la RPC se tomaron con `set local role authenticated` y `request.jwt.claims` dentro de `begin … rollback`.
Hacerlo como `postgres` omite el RLS y da tiempos engañosos.

## 5. Hallazgos de la revisión y auditoría

| Severidad | Hallazgo | Estado |
|---|---|---|
| MAJOR | La RPC cuesta ~0.8 ms por captura con RLS (190 ms con una turbina; sin RLS, 7 ms). | Mitigado con muestreo; causa raíz pendiente (7.1) |
| MAJOR | La severidad del mapa quedaba vieja al crear o editar hallazgos. | Corregido |
| MAJOR | Un `drop-shadow` sobre cada figura animada se repintaba en cada cuadro. | Corregido |
| MINOR | Con más de 60 turbinas, todas giraban a la vez. | Corregido: solo gira la del cursor o la seleccionada |
| MINOR | `supabase_realtime` no publica ninguna tabla en el proyecto de pruebas; los canales de tiempo real de esta pantalla no emiten. | Informativo |
| MINOR | Si `id_image_path` guardara una URL `https://`, la foto se cargaría desde ese dominio (sin riesgo de script). | Sin cambio |
| SUGGESTION | `TurbineMap.jsx` es largo; `mapItems` se recalcula en cada render. | Tarea 7.2 |

Seguridad: sin `dangerouslySetInnerHTML`; las URLs se construyen con `encodeURIComponent`; los nombres se pintan como
texto.

## 6. Límites conocidos

- La foto de identificación pesa ~4.2 MB y no hay miniatura; se descarga solo al abrir la tarjeta.
- El tamaño de la tarjeta se estima (372 × 300 px); si en algún caso no coincide, desplaza por dentro en vez de cortarse.
- `gps_samples` ya no cuenta todas las capturas, sino las usadas en la estimación (máximo 30).
- Mapa solo para dron. Sin capa satélite.
- Hoy la base de pruebas tiene 0 hallazgos: los colores de severidad se probaron con datos simulados, no con datos reales.

## 7. Hoja de ruta acordada

Orden propuesto (el usuario fijó la prioridad de la 7.1 y la relación entre 7.2 y 7.3; el resto es mi sugerencia):

1. **7.1** Optimización global del RLS — mayor impacto en rendimiento real.
2. **7.4a** Vulnerabilidades de producción — pequeña y de riesgo acotado.
3. **7.2** Dividir `TurbineMap.jsx` y memoizar `mapItems` — requisito previo de LPS.
4. **7.3** Mapa para proyectos LPS, empezando por una Fase 0.
5. **7.4b** Vulnerabilidades de desarrollo, en un PR aparte.

### 7.1 Optimización global del RLS (incluye `get_project_progress`)

**Evidencia.** Las políticas de lectura son:

| Tabla | Condición `USING` |
|---|---|
| `blades` | `private.can_read_project(private.project_id_of_turbine(turbine_id))` |
| `captures` | `private.can_read_project(private.project_id_of_blade(blade_id))` |
| `findings` | `private.can_read_project(private.project_id_of_capture(capture_id))` |

Las funciones `project_id_of_*`, `is_admin` y `can_read_project` son `SQL STABLE SECURITY DEFINER` con `SET search_path`:
no se pueden expandir en línea y se ejecutan **por cada fila**, cada una con su propio join. En la turbina 25 (212
capturas): mediana del GPS 163 ms (~0.77 ms por captura); `get_project_progress` 174 ms; la misma consulta sin RLS, 7 ms.
Extrapolación lineal (no medida): un proyecto de ~70 000 capturas rondaría los 55 s, por encima del `statement_timeout` de
`authenticated` (8 s).

**Fases**

1. *Línea base:* conjunto sintético (p. ej. 100 turbinas × ~700 capturas) en una rama o transacción revertida; medir
   `get_project_progress`, `get_project_map_data` y las consultas de las páginas con RLS real.
2. *Candidatos* (hipótesis a medir, no decisiones):
   - Denormalizar `project_id` en `blades`, `captures` y `findings` (columna con índice mantenida por trigger) y escribir
     la política como pertenencia a un conjunto calculado una vez: `project_id in (select …)` o `exists` contra
     `project_access`, con `(select private.is_admin())` fuera de la fila.
   - Alternativa sin cambio de esquema: reescribir las políticas para que Postgres evalúe el conjunto de proyectos
     legibles una sola vez.
3. *Prueba de equivalencia (crítica):* matriz de roles (admin, dev, técnico con acceso, cliente con acceso, sin acceso,
   inactivo, `anon`) × tablas × operaciones. Un RLS más rápido no puede dejar ver ni un registro más.
4. *Despliegue:* primero pruebas, luego producción con plan de reversa.

**Hecho cuando:** `get_project_progress` y la RPC del mapa quedan por debajo de un umbral acordado con el conjunto
sintético, y la matriz de equivalencia no muestra ninguna diferencia.

### 7.2 Dividir `TurbineMap.jsx` y memoizar `mapItems`

`TurbineMap.jsx` tiene 554 líneas y mezcla leyenda, bandeja, marcador, tarjeta, foto y la lógica de hover/fijado.

- Extraer `TurbineLegend`, `UnlocatedTray`, `TurbineMarker`, `TurbinePopup`/`TurbinePhoto` y un hook
  `useHoverDetail` (hover, fijado, temporizador de cierre y colocación).
- Memoizar `mapItems` en la pantalla (los hooks deben quedar antes del `return` anticipado de `loading`).
- Sin cambios de comportamiento: las 78 pruebas de `turbine-map.test.jsx` deben pasar sin editarse; añadir pruebas por
  pieza.
- Prerrequisito de LPS, para no engordar más el componente.

### 7.3 Mapa para proyectos LPS (reutilizando `TurbineMap`)

**Fase 0 (corta, solo lectura)** para confirmar antes de programar:

1. **Coordenadas.** La consulta LPS de `GeneralProgressPage` pide `id, turbine_name, status, inspection_date, lps_data`
   y **no** trae `coordinates`; `wind_turbines` (catálogo) no tiene coordenadas. ¿De dónde salen: `turbines.coordinates`,
   algún campo de `lps_data` o las fotos?
2. **Métrica de color.** ¿Estado de la prueba LPS, hallazgos o severidad? Hoy la pantalla solo lee `lps_data?.fotos`, así
   que el contenido de `lps_data` está sin documentar.
3. **Datos reales.** La base de pruebas no tiene ninguna turbina LPS; hace falta un ejemplo real.
4. **RPC.** ¿Se extiende `get_project_map_data` o se crea una variante LPS?

Cada punto se resuelve con los datos de Supabase y el visor LPS (`/lps-viewer`). El resultado de la Fase 0 se presenta
antes de tocar código, como se hizo con dron.

### 7.4 Vulnerabilidades de `npm audit` (6)

| Paquete | Severidad | Ámbito | Arreglo disponible |
|---|---|---|---|
| `i18next` | moderada | producción (directa) | 27.2.7 (versión mayor) |
| `react-router-dom` | moderada | producción (directa) | 7.18.7 (versión mayor) |
| `react-router` | moderada | producción (transitiva) | 7.18.7 (versión mayor) |
| `vitest` | **crítica** | desarrollo (directa) | 5.1.1 (versión mayor) |
| `tinypool` | **crítica** | desarrollo (transitiva) | 5.1.1 (versión mayor) |
| `@vitest/mocker` | moderada | desarrollo (transitiva) | 5.1.1 (versión mayor) |

- **7.4a PR de producción:** `i18next` y `react-router-dom`/`react-router`. Ambas son versiones mayores: revisar sus
  guías de migración y las marcas de futuro ya avisadas por React Router en consola.
- **7.4b PR de desarrollo (aparte):** `vitest` 5 arrastra `tinypool` y `@vitest/mocker`. Las dos críticas están en
  herramientas de prueba, no en el código publicado, pero el salto de versión mayor puede romper las 547 pruebas.
- No usar `npm audit fix --force` a ciegas.

## 8. Antes de desplegar

- [ ] Aplicar en **producción** las migraciones `20261125140000_get_project_map_data.sql` y
      `20261125150000_get_project_map_data_sample_gps.sql`. Solo están aplicadas en el proyecto de pruebas
      (`tddtfhmkjlpbcqtahcgf`). Confirmar también cuáles migraciones anteriores ya están en producción.
- [ ] Probar la RPC en producción con un usuario con acceso, uno sin acceso y `anon`, igual que en pruebas.
- [ ] **Rotar claves** (pendiente de `REPORTE_DEPURACION.md`): la `service_role` actual está en commits locales que no
      están en `origin/main`. Los commits del mapa se apilan sobre esa historia: **no hacer `push` mientras la clave
      vieja siga activa.**
- [ ] Revisar la política de CSP del hosting si se añade una: el mapa necesita `connect-src` a
      `https://tiles.openfreemap.org`, `worker-src blob:` e `img-src data: blob:`. El repositorio no define ninguna.

## 9. Diferencias con `REPORTE_DEPURACION.md`

- Los scripts `lint` y `test` que ese reporte daba por inexistentes **ya existen** en `package.json`.
- `npm audit` pasó de 5 moderadas (sin altas ni críticas) a 6, con 2 críticas en herramientas de desarrollo (`vitest`,
  `tinypool`). Ese reporte no las tenía; no se investigó desde cuándo aparecen.
- Se añadieron dos dependencias (`maplibre-gl`, `react-map-gl`); ninguna introduce vulnerabilidades.
- El archivo `.env copy.local` apunta al proyecto que el usuario indica como producción; no se tocó.
