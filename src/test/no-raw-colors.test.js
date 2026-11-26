import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * Guardián del Design System: las pantallas y componentes ya migrados no deben usar
 * clases de color crudas de Tailwind (slate-*, amber-*, white/10…); solo tokens.
 * Al migrar una página nueva, añádela a MIGRATED.
 */
const SRC = path.resolve(__dirname, '..');

const MIGRATED_FILES = [
  'pages/DashboardPage.jsx',
  'pages/ReportsPortalPage.jsx',
  'pages/GeneralProgressPage.jsx',
  'pages/ProjectsPage.jsx',
  'pages/DataCapturePage.jsx',
  'pages/WtgGeneratorPage.jsx',
  'pages/AdminPage.jsx',
  'pages/LoginPage.jsx',
  'pages/InvitePage.jsx',
  'pages/PasswordResetPage.jsx',
  'pages/ImageViewerPage.jsx',
  'components/EditableImageViewer.jsx',
  'pages/DamageEditorPage.jsx',
  'pages/damageEditor/components/ImageStage.jsx',
  'pages/damageEditor/components/DamageInfoPanel.jsx',
  'pages/damageEditor/components/ComparePanel.jsx',
  'pages/damageEditor/components/EditorHeader.jsx',
  'pages/damageEditor/components/EditorToolbar.jsx',
  'pages/damageEditor/components/SectionsPanel.jsx',
  'pages/damageEditor/components/DetectionsPanel.jsx',
  'pages/damageEditor/components/BladeViewerPanel.jsx',
  'components/damageEditor/panels.jsx',
  'components/wtgm/SavedCalibrations.jsx',
  'components/wtgm/EditCalibrationDialog.jsx',
  'pages/ReportViewerPage.jsx',
  'components/Header.jsx',
  'components/DeleteProjectDialog.jsx',
  'components/projects/formKit.jsx',
  'components/reportViewer/viewerKit.jsx',
  'components/reportViewer/ImageCarousel.jsx',
  'lib/classes.js',
  'lib/status.js',
  'lib/severity.js',
];
const MIGRATED_DIRS = [
  'components/maps',
  'components/ui',
  'components/layout',
  'components/dashboard',
  'components/auth',
  'pages/reportViewer/components',
  'pages/imageViewer/components',
];

// Pendientes conocidos: archivos que aún usan colores crudos y se migran en su propia fase.
// Al migrar uno, quítalo de aquí. (Vacío: dialog, alert-dialog y toast ya están migrados.)
const PENDING = new Set([]);

// Literales permitidos a propósito: indicadores de selección neutros de alto contraste sobre la foto
// (blanco), que NO deben seguir la paleta. Se declara archivo → fragmentos exactos que detecta RAW
// (p. ej. `bg-white/50` se detecta como `bg-white`), para que la excepción sea explícita y acotada.
const ALLOWED_LITERALS = {
  // punto de la poligonal de medición: `bg-white/50 ... border-white`
  'pages/damageEditor/components/ImageStage.jsx': ['bg-white', 'border-white'],
};

// Clases crudas de color (no hex dentro de canvas/PDF, que son lógica de imagen)
const RAW =
  /(?<![\w-])(?:bg|text|border|ring|divide|fill|stroke|from|to|via|accent)-(?:slate|gray|zinc|neutral|stone|amber|yellow|orange|red|rose|pink|purple|violet|indigo|blue|sky|cyan|teal|emerald|green|lime)-\d{2,3}\b|(?<![\w-])(?:bg|border|ring|divide)-(?:white|black)\b|(?<![\w-])(?:bg|border|ring|divide)-(?:white|black)\/|bg-\[#[0-9a-fA-F]{3,8}\]/g;

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(jsx?|js)$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });

const rel = (f) => path.relative(SRC, f).replace(/\\/g, '/');

const files = [
  ...MIGRATED_FILES.map((f) => path.join(SRC, f)),
  ...MIGRATED_DIRS.flatMap((d) => walk(path.join(SRC, d))),
].filter((f) => !PENDING.has(rel(f)));

describe('guardián de colores crudos (páginas y componentes migrados)', () => {
  it('hay archivos que vigilar', () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it('los pendientes declarados existen (si se migran o borran, hay que quitarlos de PENDING)', () => {
    [...PENDING].forEach((f) => expect(fs.existsSync(path.join(SRC, f))).toBe(true));
  });

  it('los primitivos dialog, alert-dialog y toast están bajo vigilancia (no están en PENDING)', () => {
    const watched = files.map(rel);
    ['components/ui/dialog.jsx', 'components/ui/alert-dialog.jsx', 'components/ui/toast.jsx'].forEach((f) =>
      expect(watched).toContain(f),
    );
  });

  it.each(files.map((f) => [rel(f), f]))('%s usa solo tokens', (_name, file) => {
    const allowed = ALLOWED_LITERALS[rel(file)] || [];
    // Las líneas marcadas `guard-allow-raw` son excepciones de diseño deliberadas (ver el comentario de cada una)
    const source = fs.readFileSync(file, 'utf8').split('\n').filter((l) => !l.includes('guard-allow-raw')).join('\n');
    const found = (source.match(RAW) || []).filter((c) => !allowed.includes(c));
    expect(found).toEqual([]);
  });
});
