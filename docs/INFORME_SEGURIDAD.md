# Informe de revisión de seguridad — VND Blade Platform

Rama: `refactor/modularization` · Fecha: 2026-11-10 · Entorno de trabajo y pruebas: Supabase `tddtfhmkjlpbcqtahcgf` (staging) · Producción: `yhmhpxwnxcbpouyoxarr`

Alcance: aplicación web (React + Vite) desplegada como sitio estático en Hostinger (Apache), esquema/políticas de Supabase, Edge Function y dependencias npm. Las dependencias Python (app de escritorio y pipeline) quedan fuera del alcance web.

> **Nada de lo corregido se ha desplegado.** Los cambios están en 6 commits locales sobre `refactor/modularization`, sin push. La Edge Function no está desplegada en ningún proyecto. Las pruebas funcionales con sesión real **no se han ejecutado** (ver sección 4).

---

## 1. Resumen ejecutivo

### Estado inicial
- **1 hallazgo BLOCKING:** claves JWT `service_role` de dos proyectos Supabase (`yhmh…` y `rkfl…`) presentes en el historial de git (en `.env.local`, `.env.local.bak`, scripts de prueba y bundles antiguos). No caducan hasta 2033 y 2036.
- **Cabeceras de seguridad ausentes** en el despliegue de Hostinger (sin CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`); `X-Powered-By` anunciaba la plataforma. `vercel.json` no aplica en Hostinger.
- **Scripts inyectados en producción** por `vite.config.js` que enviaban stacks de error y mensajes de consola con `postMessage(..., '*')`.
- **Edge Function sin autenticación efectiva:** cualquiera con la clave `anon` pública podía disparar correos a todos los administradores (el `verify_jwt` del gateway acepta la `anon`). CORS `*`, errores con texto interno y HTML de correo sin escapar.
- **Buckets de Storage públicos** (`images`, `certificates`, `lps`, `pc-releases`, `app-releases`) sin límite de tamaño ni de tipo MIME; el cliente caía a `getPublicUrl` si una ruta no estaba firmada.
- **Dependencias:** 5 avisos moderados de npm; Python con versiones antiguas o sin fijar.

### Estado final
- Sin XSS ni inyección explotable en el frontend; sin `eval` ni `innerHTML` con datos de usuario.
- RLS activo en las 15 tablas públicas de `tddt…`; el cambio de rol no es posible desde el cliente (`authenticated` solo puede actualizar `full_name` y `avatar_url`; `update_user_role` exige admin).
- `dist/` verificado: sin scripts en línea, sin código de Horizons, sin `service_role`, sin `.map` ni archivos de entorno; solo la clave `anon`, que es pública por diseño.
- `public/.htaccess` con cabeceras de seguridad y CSP en **modo solo informe**.
- Edge Function reescrita (local) con autenticación, control de rol, CORS por lista y errores genéricos.
- Cliente de Storage preparado para buckets privados detrás de `VITE_IMAGES_PRIVATE` (apagada).
- `npm audit`: 0 críticas, **0 HIGH**, 2 moderadas (React Router v6, congelado).
- **Siguen abiertos** (responsabilidad del ingeniero): rotación de claves `service_role`, privatización real de buckets, despliegue de la Edge Function y pruebas funcionales.

---

## 2. Matriz de trazabilidad y cumplimiento

### 2.1 Hallazgos resueltos (en el árbol local)

| ID | Hallazgo | Sev. inicial | Cambio | Archivo(s) | Evidencia |
|---|---|---|---|---|---|
| R1 | Scripts de Horizons con `postMessage('*')` y parche de `fetch` inyectados en el build | MAJOR | Eliminados los 4 scripts, el plugin `addTransformIndexHtml` y `console.warn = () => {}` | `vite.config.js` | `dist/index.html` sin scripts en línea; 0 coincidencias de `horizons-`/`originalFetch` en `dist/` |
| R2 | Sin cabeceras de seguridad en Apache; `X-Powered-By` visible | MAJOR | `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `unset X-Powered-By`, CSP `Report-Only`; rewrite SPA y caché intactos; eliminado el `.htaccess` redundante de la raíz | `public/.htaccess` (`.htaccess` raíz borrado) | `dist/.htaccess` contiene todas las cabeceras y el rewrite |
| R3 | `getImageUrl`/`getLongLivedUrl` caían a `getPublicUrl` (se romperían con bucket privado) | MAJOR | Fallback condicionado por `VITE_IMAGES_PRIVATE` (apagada por defecto); con `true` devuelve `""` y registra la ruta; diagnóstico `getUnsignedImagePaths()` (y `window.__getUnsignedImagePaths` solo en desarrollo) | `src/lib/storageUrls.js` | Dos builds (flag `true` y por defecto) con exit 0; la función global no llega a `dist/` |
| R4 | Edge Function accesible con la clave `anon`; CORS `*`; errores internos expuestos; HTML sin escapar | MAJOR | `OPTIONS` 200; solo `POST`; token `Bearer` obligatorio (401); rama `isService` (comparación en tiempo constante) o `getUser()` + rol `admin`/`technician` (403); `turbineId` UUID; CORS por `ALLOWED_ORIGINS`; errores genéricos; `escapeHtml` en la plantilla; `close()` en `finally` | `supabase/functions/notify-inspection-complete/index.ts` | **Sin ejecutar ni compilar** (no hay `deno`); ver sección 4.4 |
| R5 | 5 avisos moderados de npm; `supabase-js` antiguo | MINOR | `npm audit fix` sin `--force` (`sucrase` 3.35.1); `@supabase/supabase-js` fijado a `~2.109.0` (compatible con Node 20 / `.nvmrc`) | `package.json`, `package-lock.json` | `npm audit`: 2 moderadas, 0 HIGH; build exit 0 |
| R6 | Validación de origen en `postMessage` y `JSON.parse` de notas (corrección previa) | MAJOR | Commit `d4edb713` ya aplicado; se auditó que los 2 listeners validan `event.origin === window.location.origin` y los 6 `postMessage` de salida usan `window.location.origin` | `useImageBridge.js`, `useEditorBridge.js`, `useDetectionActions.js` | Revisión de código (Fase 3) |

### 2.2 Hallazgos congelados o no aplicados, con justificación

| ID | Hallazgo | Sev. | Estado | Justificación |
|---|---|---|---|---|
| F1 | `react-router`/`react-router-dom` 6.30.6: 2 avisos moderados (redirección abierta por backslash; `deserializeErrors` en SSR) | MINOR | **Congelado** | La corrección exige v7 (cambio mayor). Riesgo real bajo: no hay SSR y los `navigate()` usan destinos fijos o el hash anexado a `/invite`. Decisión del propietario |
| F2 | Dependencias Python (`requests==2.31.0`, `urllib3==2.1.0`, `Pillow==10.3.0`, `numpy==1.24.3`, `torch`/`supabase` sin versión; sin lockfile) | MAJOR | **Fuera de alcance** | La web desplegada no usa Python; son de la app de escritorio y el pipeline. Los CVE se citaron de memoria y **no se verificaron** con `pip-audit`. A cargo del ingeniero |
| F3 | Buckets `images`, `certificates`, `lps`, `pc-releases`, `app-releases` públicos | MAJOR | **Congelado tras flag** (`images`); sin cambios (resto) | `images` se hace privado en un paso posterior a las pruebas con la bandera. Los otros cuatro no los consume `src/` y se mantienen para no romper clientes externos (escritorio, Android) |
| F4 | Buckets sin `file_size_limit` ni `allowed_mime_types` | MAJOR | Abierto | No se tocó Supabase. Se aplica junto con la privatización |
| F5 | Claves `service_role` en el historial de git | BLOCKING | **Abierto — a cargo del ingeniero** | Proyecto solo local, sin remoto, y se decidió no purgar el historial ni hacer push. La rotación es obligatoria (sección 4.1) |
| F6 | Otros secretos en el historial no identificados (`EXIF/installer/key.json`, `Output/supabase_config.json`, `documentation.md`, `ia.txt`, patrón `sk-`) | MAJOR | Abierto | No se abrieron esos archivos. Revisar y rotar lo que sea una credencial |
| F7 | Auth sin verificar en el panel: Redirect URLs, longitud mínima de contraseña en servidor, protección contra contraseñas filtradas (desactivada), duración de sesión, registro abierto | MINOR | Abierto | El MCP no expone la configuración de Auth |
| F8 | `logout` no limpia `localStorage`/`sessionStorage` (`vnd_translation_*`, `damageEditorState`) | MINOR | Abierto | No solicitado en la fase de correcciones |
| F9 | `InvitePage` acepta tokens también por query string; `decodeURIComponent` sin `try/catch` | MINOR | Abierto | Ídem |
| F10 | `window.open(url, "_blank")` sin `noopener` en `ViewerTopBar.jsx:260` | MINOR | Registrado | Ídem |
| F11 | Notas de daños se envían a un Space público de Hugging Face (LibreTranslate) | MINOR | Registrado | Riesgo de privacidad aceptado por ahora; el token `VITE_LIBRETRANSLATE_TOKEN` quedaría visible en el bundle si se define (hoy está vacío) |
| F12 | Sin scripts `lint`/`test`; sin pruebas automáticas | MAJOR | Abierto | Toda la verificación fue por build y revisión estática |
| F13 | Las migraciones y propuestas de `supabase/` no reflejan la base viva (`private.is_staff()`, etc.) | INFO | Abierto | La base de `tddt…` es la fuente de verdad; conviene regenerar el esquema |
| F14 | Enlaces del PDF firmados a 90 días, no revocables | MINOR | Registrado | Aceptado por diseño; documentado en `storageUrls.js` |
| F15 | Edge Function con `supabase-js@2.38.4` y `deno.land/std@0.168.0` | MINOR | Registrado | Subirlas cambia comportamiento y no hay `deno` para probar |
| F16 | Campo `apiUrl` del generador WTG acepta una URL arbitraria | MINOR | Registrado | Solo admin |
| F17 | Deuda técnica de build: `@import` de fuentes fuera de lugar (la fuente Inter nunca se carga), import dinámico/estático de `translationConfig.js`, chunk de 1,85 MB | INFO | Registrado | Sin impacto en seguridad |

---

## 3. Guía de despliegue en Hostinger

### 3.1 Variables de entorno al compilar
El sitio es estático: **las variables se fijan al compilar**, no en el servidor.

| Variable | Staging (`tddt…`) | Producción (`yhmh…`) |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://tddtfhmkjlpbcqtahcgf.supabase.co` | `https://yhmhpxwnxcbpouyoxarr.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | clave `anon` de `tddt…` | clave `anon` de `yhmh…` |
| `VITE_HF_API_URL` | según entorno (generador WTG) | ídem |
| `VITE_LIBRETRANSLATE_URL` / `_TOKEN` | URL del Space; token vacío salvo necesidad | ídem |
| `VITE_IMAGES_PRIVATE` | `true` solo cuando el bucket esté privado | ídem, tras validar en staging |

Notas:
- **El `dist/` actual apunta a producción (`yhmh…`)** porque `.env.local` lo define. Para staging, usar un archivo de modo: `.env.staging.local` y `npx vite build --mode staging` (los `.env.*` ya están en `.gitignore`).
- Cualquier variable `VITE_*` queda **dentro del bundle público**. No poner secretos en ellas.
- `SUPABASE_SERVICE_ROLE_KEY` **no** debe estar en el mismo archivo que usa el build web. No se empaqueta (no lleva prefijo `VITE_`), pero conviene moverla a un archivo aparte, fuera del proyecto.
- Compilar con `npx vite build && node tools/post-build.js` y comprobar que `dist/.htaccess` contiene las cabeceras **antes de subir** (en una pasada, el primer `npm run build` dejó un `dist/.htaccess` desactualizado).
- Subir el contenido de `dist/` (incluido `.htaccess`, que es un archivo oculto) a `public_html`.

### 3.2 Verificar las cabeceras con `curl -I`

```bash
curl -sI https://DOMINIO/ | grep -iE "x-frame-options|x-content-type-options|referrer-policy|permissions-policy|content-security-policy|x-powered-by|cache-control"
```

Esperado: las cuatro cabeceras de seguridad y `Content-Security-Policy-Report-Only`, sin `X-Powered-By`, y `Cache-Control: no-cache, must-revalidate`.

```bash
curl -sI https://DOMINIO/assets/NOMBRE-DEL-ARCHIVO.js | grep -i cache-control
```

Esperado: `public, max-age=604800, immutable`.

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://DOMINIO/report-viewer/x/y
```

Esperado: `200` (el rewrite SPA sirve `index.html`).

Si faltan las cabeceras: comprobar que `mod_headers` está activo en el plan de Hostinger, que `AllowOverride` permite `.htaccess` y que el CDN no cachea una versión anterior. Si Hostinger no soporta `<If>`, el caché de `/assets/` no se aplicará.

### 3.3 Pasar la CSP de `Report-Only` a modo estricto
1. Desplegar en staging con la CSP en `Report-Only` y abrir la consola del navegador (F12 → Consola).
2. Recorrer con sesión real: login, invitación y recuperación, dashboard, visor de reportes, **visor 3D** (Draco/WASM), editor de daños, galería, descarga del **PDF**, traducción y generador WTG (admin).
3. Buscar mensajes `[Report Only] Refused to …`. Cada uno indica una directiva a ajustar en `public/.htaccess` (por ejemplo `blob:`/`data:` en `connect-src`, un dominio en `img-src`).
4. Repetir hasta que la consola quede limpia en todos los flujos.
5. En `public/.htaccess`, cambiar el nombre de la cabecera de `Content-Security-Policy-Report-Only` a `Content-Security-Policy`, recompilar y subir.
6. Verificar con `curl -I` que aparece `Content-Security-Policy` y repetir el recorrido. En modo estricto `frame-ancestors` sí se aplica (en solo informe se ignora).
7. **Marcha atrás:** devolver el nombre `…-Report-Only` y volver a subir.

Limitaciones conocidas de la política: `style-src` mantiene `'unsafe-inline'` (hay `<style dangerouslySetInnerHTML>` y estilos en línea de React). No hay HSTS; añadir `Strict-Transport-Security` cuando se confirme que todo el dominio va por HTTPS.

---

## 4. Pendientes de infraestructura (hoja de ruta para el ingeniero)

### 4.1 Rotación de claves `service_role`
Proyectos afectados: **`yhmhpxwnxcbpouyoxarr`** (producción) y **`rkflyjbhjbkoeidfluva`**. El historial también contiene sus claves `anon`, que son públicas.

1. En el panel de cada proyecto (Settings → API / API Keys), identificar si usa claves heredadas (JWT) o el sistema nuevo de claves.
   - **Heredadas:** regenerar el *JWT secret* invalida **a la vez** la `anon` y la `service_role` y cierra todas las sesiones. Hay que recompilar y volver a desplegar la web con la nueva `anon`.
   - **Nuevas (secret keys):** crear una clave secreta nueva, migrar los consumidores y borrar la antigua; la `anon` no cambia.
2. Inventariar y actualizar **todos** los consumidores de la `service_role`: secretos de Edge Functions, `scripts/delete-storage-folder.mjs`, `ai_pipeline`, la app de escritorio EXIF, webhooks y cualquier `.env.local` (incluido `.env copy.local`).
3. Revocar la clave antigua y comprobar que ya no funciona (REST con la clave vieja debe devolver 401).
4. Revisar los logs de Supabase (Auth, API, Storage) de los últimos meses por accesos anómalos.
5. Revisar y rotar lo que sea credencial en los archivos del historial no identificados (F6) y cualquier clave `sk-`.
6. Si el repositorio llegara a publicarse o compartirse, **asumir el historial comprometido**: purgarlo (por ejemplo con `git filter-repo`) antes de hacerlo. Hoy no se ha purgado ni hecho push, por decisión del propietario.
7. Sacar `SUPABASE_SERVICE_ROLE_KEY` de `.env.local` y dejar de versionar copias (`.env copy.local`).

### 4.2 Pruebas funcionales en staging (`tddt…`) con sesión real
Actualizar `supabase-js` (2.55 → 2.109) y los cambios de Vite/Storage no se pueden certificar solo con el build.

- **Auth:** login válido e inválido; invitación y recuperación de contraseña (con enlaces reales); cierre de sesión; renovación de token.
- **Roles y RLS:** con un usuario `client`, `technician` y `admin`: acceso a rutas, lectura de proyectos ajenos (debe fallar), intento de cambiar `role` por la API REST (debe fallar), `update_user_role` como no admin (debe fallar).
- **Imágenes:** visor de reportes, galería, miniaturas, imágenes ID y stitched, editor de daños, visor 3D.
- **PDF:** generar el reporte y **abrir los enlaces** incrustados.
- **Tiempo real:** página de avance (Realtime).
- **Traducción** y **generador WTG** (admin).
- **Consola:** sin errores de CSP (sección 3.3).
- Registrar cualquier fallo con la URL, el rol y el mensaje de consola.

### 4.3 Activar `VITE_IMAGES_PRIVATE=true` y privatizar el bucket `images`
1. En staging, ejecutar `VITE_IMAGES_PRIVATE=true npm run dev` y recorrer visor, galería, editor y PDF. En la consola ejecutar `__getUnsignedImagePaths()`: debe devolver `[]`.
2. Si devuelve rutas, cada una indica un consumidor al que le falta `primeImageUrls`/`primeLongLivedUrls`. Riesgos ya identificados: **enlaces del PDF** (`createInspectionResultsPage.js` usa `imageInfo.originalPath`, pero se firma `capture_storage_path`) y **fotos manuales de daños**.
3. Confirmar qué otros clientes usan el bucket `images` por URL pública (app de escritorio, Android, pipeline).
4. En `tddt…`, hacer el bucket privado (`UPDATE storage.buckets SET public = false WHERE id = 'images';`; existe una propuesta en `supabase/proposals/06_private_buckets.sql`). Las políticas de lectura para `authenticated` ya existen en la base viva.
5. Añadir `file_size_limit` y `allowed_mime_types` al bucket (F4).
6. Compilar con `VITE_IMAGES_PRIVATE=true`, desplegar y repetir 4.2.
7. **Marcha atrás:** `UPDATE storage.buckets SET public = true WHERE id = 'images';` y recompilar sin la bandera.
8. Repetir en producción solo después de superar staging. Los otros cuatro buckets requieren acuerdo con los clientes externos.

### 4.4 Despliegue formal de la Edge Function `notify-inspection-complete`
1. Instalar Deno y ejecutar `deno check supabase/functions/notify-inspection-complete/index.ts` (el archivo **no se ha compilado**).
2. Mantener `verify_jwt = true` en `supabase/config.toml`.
3. Secretos: `SMTP_HOSTNAME`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` y, si un navegador la llama, `ALLOWED_ORIGINS` (lista separada por comas). `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los provee Supabase.
4. Desplegar primero en `tddt…`:
   ```bash
   supabase functions deploy notify-inspection-complete --project-ref tddtfhmkjlpbcqtahcgf
   ```
5. Pruebas:

   | Caso | Esperado |
   |---|---|
   | `OPTIONS` | 200 |
   | Sin `Authorization` | 401 |
   | Clave `anon` como Bearer | 401 |
   | Token de un `client` | 403 |
   | Token de `technician`/`admin` | 200 (**envía correos reales** a los admins; usar un entorno con administradores de prueba) |
   | `service_role` como Bearer | 200 |
   | `turbineId` no UUID | 400 |
   | `turbineId` inexistente | 404 |

6. **Contrato cambiado:** los errores ahora son genéricos (401/403/404/405/500). Revisar el webhook, el pipeline o la app Android que la invocan si leían el texto del error. No se encontró en el repo quién la llama.
7. Pasar a producción después.

---

## 5. Hoja de Ruta Operativa y Protocolo de Validación en Staging

Secuencia recomendada: 5.1 → 5.2 → 5.3 → 5.4. Staging es `tddtfhmkjlpbcqtahcgf`.

### 5.1 Gestión de archivos pendientes de daños
`src/pages/shared/damage/damageTranslations.js` y `src/pages/shared/damage/localizeDamage.js` tenían cambios **anteriores** a esta revisión y quedaron **deliberadamente sin confirmar** en el árbol de trabajo: no forman parte del endurecimiento de seguridad y esta revisión no los auditó. Para no mezclarlos con los 6 commits de seguridad, se commitean por separado (revisar el diff antes):

```bash
git status --short
git diff src/pages/shared/damage/
git add src/pages/shared/damage/ && git commit -m "feat(damage): update translation and localization utilities"
```

Si no se quieren conservar todavía, aislarlos con `git stash push -- src/pages/shared/damage/` y recuperarlos después con `git stash pop`.

### 5.2 Compilación para Staging (`tddtfhmkjlpbcqtahcgf`)
El `dist/` que existe hoy se generó apuntando a **producción** (`yhmh…`). Antes de compilar para staging:

1. Verificar que `.env.local` apunte al proyecto de pruebas (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` deben ser los de `tddt…`). Este comando solo imprime la URL, no la clave:
   ```bash
   grep -n "VITE_SUPABASE_URL" .env.local
   ```
   Debe contener `tddtfhmkjlpbcqtahcgf`. Alternativa sin tocar `.env.local`: crear `.env.staging.local` y compilar con `--mode staging`.
2. Generar el artefacto limpio:
   ```bash
   npx vite build && node tools/post-build.js
   ```
3. Comprobar que el bundle apunta a staging y no a producción (el primero debe dar 1 o más; el segundo, 0):
   ```bash
   grep -c "tddtfhmkjlpbcqtahcgf" dist/assets/index-*.js
   grep -c "yhmhpxwnxcbpouyoxarr" dist/assets/index-*.js
   ```
4. Comprobar que `dist/.htaccess` contiene las cabeceras (`Content-Security-Policy-Report-Only`, `X-Frame-Options`) y subir el contenido de `dist/`, incluido ese archivo oculto.

### 5.3 Protocolo de pruebas en navegador (Hostinger / Staging)
1. **Consola (F12 → Consola).** Con sesión real, recorrer login, invitación/recuperación, visor de reportes, visor 3D, editor de daños, PDF, traducción y generador WTG. Buscar advertencias `[Report Only] Refused to …`; cada una indica una directiva de la CSP por ajustar (sección 3.3).
2. **URLs firmadas: `window.__getUnsignedImagePaths()`.** ⚠️ Esa función global **solo existe en desarrollo** (`import.meta.env.DEV`): **no está en el bundle compilado** que se sube a Hostinger. El diagnóstico se hace en local contra staging:
   - Poner en `.env.local` (apuntando a `tddt…`) la línea `VITE_IMAGES_PRIVATE=true`.
   - Ejecutar `npm run dev`, abrir la app, iniciar sesión y recorrer visor, galería, editor y PDF.
   - En la consola del navegador:
     ```js
     window.__getUnsignedImagePaths()
     ```
     Esperado: `[]`. Si devuelve rutas, cada una es un consumidor al que le falta `primeImageUrls`/`primeLongLivedUrls` (riesgos conocidos: enlaces del PDF y fotos manuales de daños).
   - En un build desplegado con `VITE_IMAGES_PRIVATE=true` el equivalente es la pestaña Red: no debe haber peticiones a `/storage/v1/object/public/images/…` ni imágenes rotas.
3. **Cabeceras Apache** (sustituir el dominio por el de staging):
   ```bash
   curl -I https://tu-subdominio-staging.com/
   ```
   Esperado en la respuesta: `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy-Report-Only: …`, `Referrer-Policy`, `Permissions-Policy`, y **sin** `X-Powered-By`. Versión filtrada:
   ```bash
   curl -sI https://tu-subdominio-staging.com/ | grep -iE "x-frame-options|x-content-type-options|content-security-policy-report-only|referrer-policy|permissions-policy|x-powered-by"
   ```

### 5.4 Acciones de infraestructura en Supabase (Ingeniero Backend)
1. **Rotación prioritaria de las claves `service_role` comprometidas** (`yhmhpxwnxcbpouyoxarr` y `rkflyjbhjbkoeidfluva`) desde el panel de cada proyecto, siguiendo el protocolo de la sección 4.1 (inventariar consumidores, actualizar secretos, revocar la clave antigua y comprobar que devuelve 401).
2. **Despliegue de la Edge Function** (primero en staging; antes, `deno check` y los secretos de la sección 4.4):
   ```bash
   supabase functions deploy notify-inspection-complete --project-ref tddtfhmkjlpbcqtahcgf
   ```
   Si la CLI ya está enlazada al proyecto, basta `supabase functions deploy notify-inspection-complete`. Verificar con la tabla de casos de la sección 4.4.
3. **Privatización definitiva del bucket `images`**, solo después de que 5.3 (punto 2) dé `[]`:
   ```sql
   UPDATE storage.buckets SET public = false WHERE id = 'images';
   ```
   Luego compilar con `VITE_IMAGES_PRIVATE=true` en el archivo de entorno del build y repetir 5.2 y 5.3:
   ```bash
   npx vite build && node tools/post-build.js
   ```
   Marcha atrás: `UPDATE storage.buckets SET public = true WHERE id = 'images';` y recompilar sin la variable. Repetir en producción solo después de superar staging.

---

## 6. Verificación realizada
- `git status`: 9 archivos modificados o eliminados, 1 sin rastrear (`.repomixignore`), sin temporales ni respaldos.
- `npm audit`: 0 críticas, 0 HIGH, 2 moderadas (React Router).
- `npx vite build && node tools/post-build.js`: exit 0, 3057 módulos.
- `dist/`: sin scripts en línea, sin Horizons, sin `.map`/`.env`/`.sql`/`.py`, sin `service_role` ni claves `sk-`/`AKIA`; un solo JWT, con rol `anon`; `VITE_LIBRETRANSLATE_TOKEN` presente con valor vacío.

**No verificado:** ejecución de la app con sesión real; compilación de la Edge Function; cabeceras en el servidor de Hostinger; Realtime y Storage tras la actualización de `supabase-js`; ausencia de CVE en Python; la configuración de Auth del panel; producción (`yhmh…`), cuya base no se auditó.
