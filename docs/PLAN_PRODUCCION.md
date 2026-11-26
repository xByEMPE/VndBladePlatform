# Plan de producción (proyecto `yhmhpxwnxcbpouyoxarr`)

Plan por tandas con compuertas. **Nada de esto se ejecuta sin aprobación explícita de cada tanda.** Incluye lo del mapa
interactivo (`REPORTE_MAPA_INTERACTIVO.md`, sección 8). Inventario de solo lectura hecho el 2026-11-25; no se modificó nada.

## 1. Estado real de producción (lo que se midió)

| Tema | Producción |
|---|---|
| Proyecto | `yhmhpxwn…`, nombre en el panel **"Testing"** (confirmar que es el de Hostinger; `.env copy.local` apunta a él) |
| Datos | 15 usuarios (5 admin, 10 client), 7 proyectos, 378 turbinas, 1 134 palas, **76 978 capturas (219 MB)**, **19 713 hallazgos (27 MB)**, 24 parques, 3 empresas, 1 419 aerogeneradores |
| Migraciones registradas | solo 4: `clonacion_esquema`, `wtgmfile_read_authenticated`, `rls_policies_optimized_initplan`, `rls_phase4_grants_and_functions` |
| Rol `dev`, `audit_logs`, `private.is_dev`, `allowed_modules`, `job_title`, `wind_farms.metadata` | **no existen** |
| RPC `list_selectable_staff`, `get_project_map_data`, `admin_email_change_*`, `audit_logs_*` | **no existen** |
| Edge Functions | solo `notify-inspection-complete` (falta `admin-change-user-email`) |
| RLS | activo en las 15 tablas, con la versión **optimizada por conjuntos** (`private.readable_project_ids()` / `writable_project_ids()`). Pruebas tiene la versión lenta por fila; producción va por delante |
| Buckets | `images`, `app-releases`, `pc_releases`, `lps`, `certificates` (públicos) y `wtgmFile` (privado) |
| Triggers fuera del repo | `on_auth_user_created` (`handle_new_user`, fuerza `client`), `trg_sync_project_relations`, `rls_auto_enable` |

**Consecuencia:** de la cadena del repo solo se aplica desde `20261124000000` en adelante. Las migraciones
`20261019150000_esquema` y `20261024120000_wtgm_file` **no se ejecutan** (producción ya las tiene vía `clonacion_esquema`).

## 2. Riesgos encontrados y cómo se cubren

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | `20261124010000` redefine `private.is_admin()`/`is_staff()` para incluir `dev`; las usan todas las políticas | Seguro mientras no haya devs; probar con roles reales en ensayo |
| R2 | `update_user_role(uuid, access_role_enum)` actual es solo-admin sin reglas; se reemplaza por `(uuid, text)` | `DROP` y las migraciones `110000`/`120000` van **juntas** en una sola tanda (sin hueco) |
| R3 | `user_profiles`: hoy `authenticated` solo tiene SELECT; la cadena agrega UPDATE por columnas y el guard | Probar perfil/Configuración con admin y client |
| R4 | **Backfill de `staff_list`** (`20261125200000`) vincula por correo y el trigger concede `project_access` a quien aparezca | **Simulacro previo de solo lectura**: listar qué accesos nuevos crearía. Aprobar la lista antes de aplicar |
| R5 | La auditoría en `captures` (77 k filas) y `findings` (19 k) inflaría `audit_logs` con cargas masivas y cascadas | **Resuelto**: se excluyen de la auditoría (decisión 2) |
| R6 | **Modo estricto** de `staff_list`: un front viejo abierto no podrá guardar equipos nuevos | Aplicar la migración justo antes de subir el front; ventana de minutos |
| R7 | `Enrique` hoy es `admin`; sin rol `dev` no hay Master Dev operativo | Tras la cadena, promoverlo a `dev` (paso explícito) |
| R8 | Los 5 admins actuales pasan a un modelo más restrictivo (no asignan `dev`, no cambian su rol, no tocan cuentas dev) | Avisarles; es el comportamiento acordado |
| R9 | `.env.local` lo carga Vite en **todos** los modos y apunta a pruebas | Construir con variables de producción (`.env.production.local`) y comprobar la URL dentro de `dist` |
| R10 | `service_role` vieja sigue en commits locales (115 por delante de `origin/main`) | Rotar antes de cualquier `git push`; la subida a Hostinger es solo `dist` |

## 3. Fases

### Fase 0: preparación (sin tocar producción)
1. **Respaldo** de producción (Dashboard → Database → Backups / PITR) y copia del `dist` actual de Hostinger. Anotar la hora.
2. **Rotar `service_role`** y actualizar los secretos donde se use (la anon key no cambia).
3. ~~**Ensayo local "como producción"**~~ **Hecho** (ver sección 7).
4. Confirmar con el equipo: ventana de mantenimiento y aviso a los 5 admins.

### Fase 1: base de datos (en este orden; cada tanda con verificación y rollback)
| Tanda | Migraciones | Verificación |
|---|---|---|
| 1A | `20261124000000` (enum `dev`) | el enum tiene `dev` |
| 1B | `20261124010000` … `20261124140000` (helpers, `user_profiles`, `audit_logs`, protecciones Master, sincronía de correo) | roles reales: admin, client, anon |
| 1C | `20261125100000` … `20261125130000`, `…160000` (auditoría: contexto, sesiones, búsqueda, filtros) | `/dev/auditoria` con un dev |
| 1D | `20261125140000`, `…150000` (**mapa**: `get_project_map_data` con muestreo GPS) | RPC con usuario con acceso, sin acceso y `anon`; medir tiempo con RLS real |
| 1E | `20261125170000` … `20261125190000`, `…220000` (cambio de correo asistido y **admin**) | pruebas del admin (24 casos) |
| 1F | Simulacro R4 y luego `20261125200000` (`staff_list`) y `20261125210000` (`metadata`) | solo después de aprobar la lista de accesos |
| 1G | Promover a Enrique a `dev` (SQL puntual, aprobado) | menú Auditoría y Configuración completa |

1F es la tanda que provoca la ventana R6: se ejecuta **inmediatamente antes** de la Fase 3.

### Fase 2: Edge Function
Desplegar `admin-change-user-email`, definir `ALLOWED_ORIGINS` con el dominio de Hostinger y probar el preflight CORS y
el cambio de correo de un client (dry run).

### Fase 3: front en Hostinger
1. `npm run build` completo con variables de **producción**; verificar que `dist` no contiene la URL de pruebas.
2. Subir `dist` conservando `.htaccess`. Si se añade CSP: `connect-src https://tiles.openfreemap.org`,
   `worker-src blob:`, `img-src data: blob:` (el mapa lo necesita).
3. Verificación: login; `/profile`; Configuración como admin y como dev; crear proyecto con parque y equipo; mapa en
   Avance general (con y sin turbinas ubicadas); un client solo ve lo suyo.

### Fase 4: datos
- **Parques:** `parks_catalog_load.sql` tras una comparación en seco contra el catálogo real (producción tiene los mismos 24).
- **Técnicos:** con la Admin API (no por SQL), con el criterio de limpieza de `job_title_equivalences.md`, **sin enviar correos**;
  después ajustar rol y `job_title`. Con aprobación del listado.

## 4. Mapa interactivo (de `REPORTE_MAPA_INTERACTIVO.md`)
- **Sí entra en este despliegue:** migraciones `140000` y `150000`, chunk `TurbineMap` + worker, CSP, rotación de claves.
- **7.1 (optimizar RLS):** producción **ya tiene** las políticas por conjuntos; el costo por fila medido en pruebas
  (~0.8 ms/captura) no aplica igual allí. Se medirá la RPC en producción con roles reales (transacción revertida) antes de dar por bueno.
  Conviene además llevar esa capa al repo como migración base (hoy solo vive en producción) y a pruebas.
- **Fuera de este despliegue (recomendado):** 7.2 (partir `TurbineMap`), 7.3 (mapa LPS) y 7.4 (vulnerabilidades de `i18next` y
  `react-router-dom`, versiones mayores). Mezclarlas con esta salida sube el riesgo sin necesidad.

## 5. Reversa
- **Front:** restaurar el `dist` anterior de Hostinger.
- **Base:** las migraciones son aditivas. Reversa puntual: quitar triggers `projects_normalize_staff`, `projects_sync_staff_access`,
  `user_profiles_sync_staff_list` y los de auditoría; restaurar las funciones `private.is_admin()/is_staff()` y
  `update_user_role(uuid, access_role_enum)` originales (definiciones guardadas en el inventario). Restauración completa: respaldo de la Fase 0.

## 6. Decisiones (respondidas por el dueño)
1. `yhmhpxwn…` **es producción** (aunque el panel diga "Testing"). No se aplica nada ahí sin luz verde explícita por paso.
2. Auditoría: **se excluyen `captures` y `findings`** (13 tablas auditadas). Hecho en `20261124020000_audit_logs.sql`.
   El proyecto de pruebas aún tiene esos dos triggers (`DROP TRIGGER audit_capture_row_changes ON captures/findings`) y hay que quitarlos allá.
3. Ventana y aviso a los 5 admins: los coordina el dueño.
4. Técnicos reales: **después** de desplegar y verificar el front, y tras aprobar el simulacro del backfill.
5. Ensayo local "como producción": **hecho** (sección 7).

## 7. Resultados del ensayo local y del simulacro (2026-11-25)

**Ensayo en Docker** (`docker/local-db/rehearsal.sh`): esquema del repo + capa de producción reconstruida
(`docker/local-db/prod_baseline/10_prod_layer.sql`) + las 21 migraciones nuevas, con datos sintéticos a escala de producción
(7 proyectos, 378 turbinas, 1 134 palas, ~77 000 capturas, ~19 900 hallazgos, 5 admin y 10 client).

| Comprobación | Resultado |
|---|---|
| La cadena completa sobre el estado de producción | se aplica sin errores |
| Choque encontrado | `projects.created_by` existe en producción pero ninguna migración del repo lo crea; `20261125200000` ya lo declara con `IF NOT EXISTS` |
| Admin / client con acceso / client sin acceso / anon | 7 proyectos y 378 turbinas / 2 proyectos y 140 turbinas / 0 filas / permission denied |
| **RPC del mapa**, proyecto de 100 turbinas (~20 400 capturas), con las políticas de producción | **2.2 s (admin), 1.8 s (client)**, por debajo del límite de 8 s |
| Dev (Enrique tras promoverlo): auditoría, visibilidad, elegibles | lee `audit_logs`; ve todo; 5 personas elegibles |
| Admin: auditoría, cambio de rol, Master | no lee `audit_logs`; cambia client→technician; no toca al Master |
| Auditoría | 13 triggers; 0 en `captures`/`findings`; UPDATE de 5 000 capturas no crea filas en `audit_logs` |

La RPC del mapa dentro de producción (con su hardware y datos reales) se mide en la Fase 1D, en transacción revertida, antes de darla por buena.

**Simulacro del backfill de `staff_list` sobre datos reales de producción (solo lectura):**
10 entradas en 7 proyectos; 4 coinciden con un perfil y 6 son históricas sin cuenta (quedan intactas y legibles).
El backfill crearía **3 accesos nuevos** en `project_access`:

| Proyecto | Rol del perfil |
|---|---|
| INSPECCIÓN EXTERNA DE PALAS | admin (ya ve todo; sin efecto real) |
| INSPECCION PALAS CON DRON | admin (ya ve todo; sin efecto real) |
| **INSPECCION PALAS OAXACA 4** | **client** (esta persona **ganaría acceso** al proyecto) |

Sin duplicados. **Pendiente de aprobación:** el acceso del client a OAXACA 4 (aprobar tal cual o excluirlo antes de aplicar).
