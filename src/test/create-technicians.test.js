import { describe, it, expect } from 'vitest';
import { parseCsv, buildPlan, randomPassword, ALLOWED_ROLES } from '../../tools/lib/technicians.js';

const csv = [
  'email,nombre,grupo,rol,job_title',
  'ana.perez@vindgroup.com.mx,Ana Perez,tecnico,technician,TECNICO DE MANTENIMIENTO',
  'beto.lopez@bo.vindgroup.com.mx,"Lopez, Beto",operativo,admin,',
  'ANA.PEREZ@VINDGROUP.COM.MX,Ana Duplicada,tecnico,technician,',
  'ya.existe@vindgroup.com.mx,Ya Existe,operativo,admin,',
  'externo@otra.com,Externo,operativo,admin,',
  'dev.intruso@vindgroup.com.mx,Dev Intruso,operativo,dev,',
  'sin.nombre@vindgroup.com.mx,,operativo,admin,',
].join('\n');

describe('carga de personal: lógica pura', () => {
  it('parseCsv respeta comillas y devuelve objetos por encabezado', () => {
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(7);
    expect(rows[1].nombre).toBe('Lopez, Beto');
    expect(rows[0].job_title).toBe('TECNICO DE MANTENIMIENTO');
    expect(rows[1].job_title).toBe('');
  });

  it('buildPlan: crea las válidas, omite repetidas y existentes, rechaza dominio ajeno, rol dev y sin nombre', () => {
    const plan = buildPlan(parseCsv(csv), new Set(['ya.existe@vindgroup.com.mx']));
    expect(plan.toCreate.map((r) => r.email)).toEqual(['ana.perez@vindgroup.com.mx', 'beto.lopez@bo.vindgroup.com.mx']);
    expect(plan.toCreate[0]).toMatchObject({ rol: 'technician', job_title: 'TECNICO DE MANTENIMIENTO' });
    expect(plan.toCreate[1]).toMatchObject({ rol: 'admin', job_title: null });
    expect(plan.skipped).toEqual([
      { email: 'ana.perez@vindgroup.com.mx', reason: 'repetido en la lista' },
      { email: 'ya.existe@vindgroup.com.mx', reason: 'ya existe en Auth' },
    ]);
    const reasons = plan.invalid.map((i) => i.reason);
    expect(reasons.some((r) => r.includes('fuera de vindgroup'))).toBe(true);
    expect(reasons.some((r) => r.includes('rol no permitido: dev'))).toBe(true);
    expect(reasons.some((r) => r.includes('sin nombre'))).toBe(true);
  });

  it('nunca permite asignar dev por carga masiva', () => {
    expect(ALLOWED_ROLES).toEqual(['technician', 'admin']);
  });

  it('randomPassword es larga, distinta cada vez y cumple complejidad básica', () => {
    const rb = (n) => Buffer.from(Array.from({ length: n }, () => Math.floor(Math.random() * 256)));
    const a = randomPassword(rb);
    const b = randomPassword(rb);
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(a).toMatch(/[a-z]/);
    expect(a).toMatch(/[A-Z]/);
    expect(a).toMatch(/\d/);
  });
});
