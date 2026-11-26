import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Pill from './Pill';
import StatusPill from './StatusPill';
import RoleChip from './RoleChip';
import { STATUS, getStatus } from '@/lib/status';
import { getRoleChip } from '@/lib/roleLabel';
import { toChipStatusKey } from '@/lib/projectStatus';

describe('Pill (base)', () => {
  it('forma de píldora: bordes totalmente redondeados, texto pequeño en negrita', () => {
    render(<Pill>Hola</Pill>);
    expect(screen.getByText('Hola')).toHaveClass('inline-flex', 'rounded-full', 'px-2', 'py-1', 'text-xs', 'font-semibold');
    expect(screen.getByText('Hola')).not.toHaveClass('border');
  });

  it('bordered añade borde y className se fusiona', () => {
    render(<Pill bordered className="border-brand/30 ml-2">B</Pill>);
    expect(screen.getByText('B')).toHaveClass('border', 'border-brand/30', 'ml-2');
  });
});

describe('StatusPill (estado como píldora tenue)', () => {
  it.each([
    ['done', 'text-status-done', 'bg-status-done/10'],
    ['progress', 'text-status-progress', 'bg-status-progress/10'],
    ['alert', 'text-status-alert', 'bg-status-alert/10'],
    ['review', 'text-sev-4', 'bg-sev-4/10'],
    ['planning', 'text-brand', 'bg-brand/10'],
    ['cancelled', 'text-error-text', 'bg-error-bg'],
    ['pending', 'text-ink-muted', 'bg-surface-card'],
  ])('estado %s: texto del color sobre fondo teñido (%s, %s) con forma de píldora', (status, text, bg) => {
    render(<StatusPill status={status} label="X" />);
    const pill = screen.getByText('X');
    expect(pill).toHaveClass(text, bg, 'rounded-full', 'font-semibold');
    expect(pill).toHaveAttribute('data-status', status);
  });

  it('un estado desconocido cae a pending', () => {
    render(<StatusPill status="raro" label="?" />);
    expect(screen.getByText('?')).toHaveClass('text-ink-muted', 'bg-surface-card');
  });

  it('todos los estados definen su variante chip, solo con tokens', () => {
    Object.entries(STATUS).forEach(([key, def]) => {
      expect(def.chip, key).toBeTruthy();
      expect(def.chip, key).not.toMatch(/\b(slate|amber|emerald|rose|red|blue|yellow|green|gray)-\d|white\/|#[0-9a-f]{6}/i);
    });
    expect(getStatus('planning').text).toBe('text-brand');
  });
});

describe('RoleChip (rol como píldora con borde)', () => {
  it.each([
    ['admin', 'text-brand', 'bg-brand/10', 'border-brand/30'],
    ['technician', 'text-info', 'bg-info/10', 'border-info/30'],
    ['client', 'text-status-done', 'bg-status-done/10', 'border-status-done/30'],
  ])('rol %s con su color', (role, text, bg, border) => {
    render(<RoleChip role={role} />);
    expect(screen.getByText(role)).toHaveClass(text, bg, border, 'border', 'rounded-full');
    expect(screen.getByText(role)).toHaveAttribute('data-role', role);
  });

  it('un rol desconocido usa el estilo neutro y se puede cambiar el texto', () => {
    render(<RoleChip role="auditor" label="Auditor" />);
    expect(screen.getByText('Auditor')).toHaveClass('text-ink-muted', 'bg-surface-card', 'border-line-subtle');
  });

  it('getRoleChip no distingue mayúsculas y es seguro con valores vacíos', () => {
    expect(getRoleChip('ADMIN')).toBe(getRoleChip('admin'));
    expect(getRoleChip(undefined)).toContain('text-ink-muted');
    expect(getRoleChip(null)).toContain('text-ink-muted');
  });
});

describe('toChipStatusKey (estado de proyecto → píldora)', () => {
  it('Completado verde, En progreso celeste y el resto "amarillo" (dorado), como se mostraba antes', () => {
    expect(toChipStatusKey('Completado')).toBe('done');
    expect(toChipStatusKey('En progreso')).toBe('progress');
    expect(toChipStatusKey('Planeación')).toBe('planning');
    expect(toChipStatusKey('Pausado')).toBe('planning');
    expect(toChipStatusKey(undefined)).toBe('planning');
  });
});
