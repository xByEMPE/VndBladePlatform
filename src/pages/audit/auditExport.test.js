import { describe, it, expect } from 'vitest';
import { buildCsv, buildMarkdown, getChangedFields, fetchAllLogs } from './auditExport';

const logs = [
  {
    id: 1,
    user_id: 'u1',
    user_role: 'dev',
    action: 'UPDATE',
    table_name: 'public.user_profiles',
    record_id: 'r1',
    created_at: '2026-11-24T10:00:00Z',
    old_data: { role: 'admin', note: 'a|b', updated_at: '1' },
    new_data: { role: 'dev', note: 'a|b', updated_at: '2' },
    metadata: { ip: '1.2.3.4' },
  },
];
const userMap = { u1: 'dev@x.com' };

describe('auditExport', () => {
  it('getChangedFields ignora updated_at', () => {
    expect(getChangedFields(logs[0].old_data, logs[0].new_data)).toEqual(['role']);
  });

  it('buildCsv: cabecera + fila, comillas escapadas', () => {
    const csv = buildCsv(logs, userMap);
    const [header, row] = csv.split('\n');
    expect(header).toContain('"Fecha"');
    expect(row).toContain('"dev@x.com"');
    expect(row).toContain('{""role"":""admin""');
  });

  it('buildMarkdown: tabla resumen y detalle con valores anterior/nuevo', () => {
    const md = buildMarkdown(logs, userMap, 'Hoy');
    expect(md).toContain('# Auditoría y Registros');
    expect(md).toContain('- **Periodo:** Hoy');
    expect(md).toContain('| UPDATE | user_profiles |');
    expect(md).toContain('| `role` | "admin" | "dev" |');
  });
});

describe('motivo en las exportaciones', () => {
  const withReason = [
    {
      id: 9,
      user_id: 'u1',
      user_role: 'dev',
      action: 'EMAIL_CHANGE',
      table_name: 'auth.users',
      record_id: 'r9',
      created_at: '2026-11-24T10:00:00Z',
      old_data: { email: 'a@x.com' },
      new_data: { email: 'b@x.com' },
      metadata: { reason: 'ya no tiene acceso | a su correo', request_id: 'abc12345-0000', ip: '1.2.3.4' },
    },
  ];

  it('CSV: última columna "Motivo" con el texto; vacía cuando no hay motivo', () => {
    const csv = buildCsv([...withReason, ...logs], {});
    const [header, first, second] = csv.split('\n');
    expect(header.endsWith('"Motivo"')).toBe(true);
    expect(first.endsWith('"ya no tiene acceso | a su correo"')).toBe(true);
    expect(second.endsWith('""')).toBe(true);
  });

  it('Markdown: columna Motivo en el resumen (con | escapado) y línea Motivo en el detalle', () => {
    const md = buildMarkdown(withReason, {}, 'Hoy');
    expect(md).toContain('| Campos afectados | Motivo |');
    expect(md).toContain('| email | ya no tiene acceso \\| a su correo |');
    expect(md).toContain('- Motivo: ya no tiene acceso | a su correo');
  });

  it('Markdown: sin motivo no agrega la línea de detalle', () => {
    expect(buildMarkdown(logs, {}, 'Hoy')).not.toContain('- Motivo:');
  });
});

describe('fetchAllLogs (exportación desde el servidor)', () => {
  const makePage = (totalRows) => async (offset, limit) => ({
    data: Array.from({ length: Math.max(0, Math.min(limit, totalRows - offset)) }, (_, i) => ({ id: offset + i, total: totalRows })),
    error: null,
  });

  it('junta todas las páginas hasta el total', async () => {
    const calls = [];
    const page = makePage(1200);
    const res = await fetchAllLogs(async (o, l) => { calls.push([o, l]); return page(o, l); });
    expect(res.rows).toHaveLength(1200);
    expect(res.truncated).toBe(false);
    expect(calls).toEqual([[0, 500], [500, 500], [1000, 500]]);
  });

  it('respeta el tope e indica que se truncó, con el total real', async () => {
    const res = await fetchAllLogs(makePage(12000), { cap: 1000 });
    expect(res.rows).toHaveLength(1000);
    expect(res.total).toBe(12000);
    expect(res.truncated).toBe(true);
  });

  it('sin resultados devuelve vacío y propaga los errores del servidor', async () => {
    expect((await fetchAllLogs(makePage(0))).rows).toEqual([]);
    await expect(fetchAllLogs(async () => ({ data: null, error: new Error('boom') }))).rejects.toThrow('boom');
  });
});
