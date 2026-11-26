# Contexto de la sesión: VINDGROUP (React + Vite + Supabase)

Rama `design-system`. Fecha de referencia: 2026-11-25. El usuario hace los `git push`; yo no.

## Proyectos Supabase
| Ref | Rol |
|---|---|
| `tddtfhmkjlpbcqtahcgf` | Pruebas |
| `yhmhpxwnxcbpouyoxarr` | **Producción** (el panel lo llama "Testing") |

Dominio de producción (Hostinger): https://vnd-blade-platform.com.mx

## Reglas permanentes
- Trabajo paso a paso: plan, aprobación, un paso, checklist de prueba manual.
- Cambios SQL: borrador en `supabase/proposals/`, mostrar, esperar aprobación, mover a `supabase/migrations/`, aplicar y verificar con roles reales en transacciones revertidas (nunca como `postgres`).
- **No tocar producción sin luz verde explícita por paso.**
- No hacer `git push`. Nunca commitear `REPORTE_DEPURACION.md`.
- Datos personales reales (correos, nombres, CSV) fuera de git: `data-private/` está en `.gitignore`.
- Nunca imprimir ni pedir claves `service_role` en el chat.
- Reusar chips y botones existentes (`RoleChip`, `BTN_*`); sin `bg-info` sólido.
- Commits firmados como Danny, con el trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- No crear cuentas ni enviar correos sin permiso.

## Qué se construyó
- **Rol `dev` y Master Dev** (`enrique.hernandez@bo.vindgroup.com.mx`): solo él asigna `dev`. Enrique es `dev` en producción.
- **`audit_logs`:** 13 tablas auditadas; `captures` y `findings` excluidas.
- **`staff_list` ligada a `user_id`:** modo estricto; `list_selectable_staff()`; triggers `projects_normalize_staff`, `projects_sync_staff_access` y `user_profiles_sync_staff_list`.
- **Catálogo de parques:** `wind_farms.metadata` (`turbine_models[]`, `expected_turbines`); la Sección 1 autocompleta modelo y número de turbinas.
- **Perfil de solo lectura** para todos los no-client.
- **Admin:** gestiona usuarios como un dev no Master, pero no toca cuentas dev. Ve Configuración.
- **Cambio de correo asistido:** Edge Function `admin-change-user-email`.
- **Mapa:** RPC `get_project_map_data` con muestreo GPS.
- **Hoy:** se quitó "Resumen de proyectos" de Configuración (`src/pages/AdminPage.jsx`). Es solo front y no está commiteado.

## Estado de producción
| Tanda | Contenido | Estado |
|---|---|---|
| 1A | Enum `dev` | Aplicada |
| 1B | Perfiles `dev` y auditoría | Aplicada |
| 1C | Contexto de auditoría y sesiones | Aplicada |
| 1D | Mapa | Aplicada |
| 1E | Cambio de correo y admin | Aplicada |
| 1F | `staff_list` y `metadata` | Aplicada |
| 1G | Enrique a `dev` | Hecha por el usuario |
| Fase 2 | Edge Function `admin-change-user-email` v1 | Desplegada |
| Fase 3 | Front en Hostinger | Subido por el usuario |
| Fase 4 | Técnicos y operativos | Cargados por SQL |

**Carga de personal en producción (por SQL, no con el script):**
- Se procesaron 149 filas del Excel RH.
- 144 cuentas nuevas, 4 existentes (solo se agregó el nombre) y 1 perfil creado (Fernando Vallejo).
- Nombre = NOMBRE + APELLIDO_PATERNO + APELLIDO_MATERNO en formato título.
- `job_title` = `TIPO_CARGO` tal cual, y "Tec. Mtto." si venía vacío (7 casos).
- Todos los nuevos quedaron como `technician`.
- Existentes: Kevin, Osmar y José siguen `admin` y Rubi sigue `client`; solo recibieron nombre.
- Usuarios: 160, con roles dev 1, admin 4, client 10 y technician 145.
- No hubo cuentas sin perfil ni correos duplicados.
- Las cuentas nuevas tienen contraseña aleatoria desconocida y no se envió ningún correo. Cada persona debe usar "olvidé mi contraseña".
- Quedaron fuera 45 filas de otro dominio, 6 del área administrativa y 2 sin correo.
- Juan Carlos Jimenez Cruz tiene dos cuentas (`juan.cruz@` y `juan.jimenez@`).
- Lista exacta cargada: `data-private/carga_prod.txt` (fuera de git).

## Pendientes
1. **El usuario** debe definir el secreto `ALLOWED_ORIGINS=https://vnd-blade-platform.com.mx` en la Edge Function de producción. Después pruebo el preflight CORS y un `dry_run`.
2. Verificar el front con sesión real: login, `/profile`, Configuración (admin y dev), crear proyecto con parque y equipo, mapa en Avance general, y que un cliente solo vea lo suyo.
3. Probar que llegue el correo de "olvidé mi contraseña" (depende del SMTP de Supabase).
4. Commitear y desplegar el cambio de hoy (quitar Resumen de proyectos). Opcional: borrar `src/pages/admin/ProjectsSummary.jsx` y sus textos i18n.
5. Proyecto de pruebas: quitar los triggers `audit_capture_row_changes` de `captures` y `findings`.
6. Actualizar `docs/PLAN_PRODUCCION.md`: OAXACA 4 aprobado, tandas 1A–1G hechas y carga de técnicos hecha.
7. Opcionales si se piden:
   - Normalizar errores de `TIPO_CARGO` (`OPERTIVO`, `OEPRACIONES`).
   - Decidir sobre el rol de Rubi.
   - Incluir las filas excluidas.
   - Revisar a la persona con dos correos.
   - Pendientes del mapa (7.1–7.4, CSP).

## Archivos clave
- Migraciones: `supabase/migrations/20261124000000` a `20261125220000`.
- Plan de producción: `docs/PLAN_PRODUCCION.md`.
- Ensayo local con Docker: `docker/local-db/`.
- Edge Function: `supabase/functions/admin-change-user-email/`.
- Front: `src/pages/AdminPage.jsx`, `src/pages/admin/UsersSection.jsx`, `src/pages/ProfilePage.jsx`, `src/components/projects/formKit.jsx`, `src/hooks/useSelectableStaff.js`, `src/lib/windFarmDefaults.js`.
- Herramientas: `tools/create-technicians.mjs` y `tools/lib/technicians.js` (carga con Admin API; ya no es el método usado).
- Notas de build:
  - Vite carga `.env.local` en todos los modos, así que producción usa `.env.production.local` (no está en git).
  - En Windows `npm run build` no hace nada: correr `node tools/generate-llms.js`, `npx vite build` y `node tools/post-build.js` por separado.
