import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import literalsEn from './literals.en.json';
import esCommon from '../locales/es/common.json';
import enCommon from '../locales/en/common.json';

// Módulos de Auditoría, Configuración/roles y Perfil: todo texto fijo que pasa por tx() debe tener
// su traducción al inglés en literals.en.json (si falta, en inglés se vería en español).
const FILES = [
  'src/pages/AuditLogsPage.jsx',
  'src/pages/audit/AuditFilters.jsx',
  'src/pages/audit/AuditPeriodSelector.jsx',
  'src/pages/audit/ExportMenu.jsx',
  'src/pages/audit/JsonDiffModal.jsx',
  'src/pages/audit/auditExport.js',
  'src/pages/ProfilePage.jsx',
  'src/pages/profile/ChangePasswordCard.jsx',
  'src/pages/profile/ProfileDataView.jsx',
  'src/pages/admin/UsersSection.jsx',
  'src/pages/admin/ChangeEmailDialog.jsx',
  'src/components/layout/UserProfile.jsx',
  'src/lib/roleLabel.js',
];

// Etiquetas que se pasan a tx() desde constantes (no como literal directo).
const FROM_CONSTANTS = [
  'Hoy', 'General',
  'INICIO DE SESIÓN', 'CIERRE DE SESIÓN', 'CAMBIO DE CONTRASEÑA',
  'CORREO: SOLICITADO', 'CAMBIO DE CORREO', 'CORREO: FALLÓ',
  'DESARROLLADOR', 'ADMINISTRADOR', 'TÉCNICO', 'CLIENTE',
  'Desarrollador', 'Administrador', 'Técnico', 'Cliente',
];

const TX_CALL = /\btx\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g;

const literalsUsed = () => {
  const used = new Set(FROM_CONSTANTS);
  for (const file of FILES) {
    const src = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
    for (const m of src.matchAll(TX_CALL)) {
      const raw = m[1] ?? m[2];
      used.add(JSON.parse(`"${raw.replace(/"/g, '\\"').replace(/\\'/g, "'")}"`));
    }
  }
  return [...used];
};

describe('i18n de los módulos nuevos', () => {
  it('cada texto fijo tiene traducción al inglés', () => {
    const missing = literalsUsed().filter((k) => literalsEn[k] === undefined);
    expect(missing).toEqual([]);
  });

  it('las traducciones conservan las variables {{...}} del texto original', () => {
    const vars = (s) => (s.match(/\{\{\s*\w+\s*\}\}/g) || []).map((v) => v.replace(/\s/g, '')).sort();
    const broken = literalsUsed()
      .filter((k) => literalsEn[k] !== undefined)
      .filter((k) => JSON.stringify(vars(k)) !== JSON.stringify(vars(literalsEn[k])));
    expect(broken).toEqual([]);
  });

  it('los roles existen en es y en (incluido dev) para los textos con claves t()', () => {
    for (const role of ['dev', 'admin', 'technician', 'client']) {
      expect(esCommon.roles[role], `es roles.${role}`).toBeTruthy();
      expect(enCommon.roles[role], `en roles.${role}`).toBeTruthy();
    }
    expect(enCommon.roles.dev).toBe('Developer');
  });
});
