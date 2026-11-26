# Reporte: depuración, limpieza y seguridad

Resumen de la sesión de depuración del proyecto VND Blade Platform. Armado desde el historial de la conversación; el estado del repositorio puede haber cambiado después (ramas posteriores como `refactor/modularization` o `design-system`).

## 1. Planificación y diagnóstico

- Mapa del proyecto con Repomix: 148 archivos (React/Vite, Supabase y Python). Se corrigió `repomix.config.json`, que tenía un residuo de shell en la primera y la última línea.
- Plan por fases con ruteo a `optimizer-agent`, `auditor-reviewer-agent` y verificación de build.
- Detección con knip, depcheck, ruff y vulture. Los hallazgos se clasificaron en seguros, dudosos y no tocar.

## 2. Limpieza ejecutada (rama `chore/cleanup`)

| Commit | Contenido |
|---|---|
| `548eb067` | Eliminados `UserManagement.jsx`, `ui/select.jsx` y `plugins/visual-editor/`. Desinstaladas 11 dependencias sin uso (`@radix-ui/*` x5, `cors`, `docx`, `pdf-lib`, `html2canvas`, `pdfkit`, `context-mode`) y las 4 de `@babel/*`. Aplicado `npm audit fix` |
| `eb843441` | Poda de claves i18n sin uso: 529 en `es/common`, 632 en `en/common` y 33 en cada `reports`. Cada archivo de traducción quedó cerca de la mitad de su tamaño |
| `2ed6f1d7` | `jspdf` 3.0.4 a 4.2.1 (corrige la vulnerabilidad crítica) |
| `3507887f` | `.gitignore` con `.env.*`, `*.local` y `.env *`; `.env copy.local` conservado en disco |
| `62e57a24` | Vite 4.5.14 a 6.4.5, sin `vite-plugin-rewrite-all` y sin los bloques `historyApiFallback` |
| `b9a8c2c2` | Consolidación del trabajo en curso: 132 borrados, 38 modificados y 54 nuevos, sin secretos |

**Vulnerabilidades de `npm audit`:** de 34 a 5, todas moderadas, sin ninguna alta ni crítica. La rama temporal `test/vite-6-upgrade` se fusionó y se borró.

## 3. Hallazgos importantes

| Hallazgo | Detalle |
|---|---|
| Claves en el historial de git | La service_role actual está en los commits `f77d7f91`, `128dfe42` y `d1e353d0`, que **no** están en `origin/main`. La clave de DeepL y las anon keys antiguas sí están en `origin/main` |
| Más archivos con la service_role | Aparecía en el historial en scripts de prueba y en copias bajo `EXIF/`, no solo en `.env.local` |
| Árbol actual limpio | Sin secretos en código ni documentación; solo la cabecera de ejemplo truncada del README |
| Console Ninja | Inyectaba un hook en `node_modules/vite/bin/vite.js`: `npm run dev` no abría el puerto y `npm run build` terminaba con código 0 **sin compilar nada** |

## 4. Corrección

Varios "el build pasa" reportados antes de la subida a Vite 6 no eran fiables por el hook de Console Ninja. Se detectó después y se compiló saltándolo: 3008 módulos transformados, código 0. Eso sí valida el conjunto de cambios.

## 5. Verificaciones

- Build real con Vite 6.4.5 correcto; `console.log` eliminados del bundle de producción.
- PDF: prueba en Node con la API que usa el proyecto, y exportación real hecha por el usuario con `jspdf` 4.2.1.
- Rutas: las 16 respondieron 200 con el fallback de SPA, incluida una ruta con punto. En el navegador, las protegidas redirigieron a `/login` sin pantalla blanca. El usuario probó después con sesión activa y todo respondió bien.
- No probado por falta de sesión: visor 3D y datos reales (lo cubrió la prueba manual del usuario).

## 6. Pendientes

**A cargo del usuario (crítico)**

- [ ] Rotar la service_role, la anon key y la clave de DeepL.
- [ ] Actualizar `.env.local`, `.env copy.local` y los archivos de `EXIF/` con los valores nuevos.
- [ ] No hacer push de esta historia a ningún remoto mientras la service_role vieja siga activa.

**Pausados a propósito**

- [ ] Purga del historial de git (descartada por el usuario).
- [ ] `react-router` y `react-router-dom` (redirección abierta, requiere otra versión mayor) y las transitivas `glob`, `minimatch` y `sucrase`.
- [ ] Archivos dudosos: `scripts/*.mjs`, Edge Function `notify-inspection-complete`, `public/draco/*`, `main.jsx` y `vite.config.js` de `wtgwtgmgenerator`.
- [ ] `supabase/proposals/` frente a la base real.
- [ ] Scripts `lint` y `test`, que no existen en `package.json`.

## 7. Reglas acordadas

- Todo en local: sin `push` ni conexión con `origin`.
- No tocar `.env copy.local` ni los archivos dudosos sin orden expresa.
