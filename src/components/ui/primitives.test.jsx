import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from './alert-dialog';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './dialog';
import { Toast, ToastClose, ToastTitle, ToastProvider, ToastViewport } from './toast';
import { ALERT_DESTRUCTIVE, BTN_PRIMARY, BTN_SECONDARY } from '@/lib/classes';
import { cn } from '@/lib/utils';

const renderAlert = (actionClass) =>
  render(
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Seguro?</AlertDialogTitle>
          <AlertDialogDescription>Descripción</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction className={actionClass}>Confirmar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>,
  );

describe('AlertDialog con tokens', () => {
  it('contenido, título y descripción usan tokens', () => {
    renderAlert();
    expect(screen.getByRole('alertdialog')).toHaveClass('bg-surface-panel', 'border-line-subtle', 'text-ink');
    expect(screen.getByText('¿Seguro?')).toHaveClass('text-ink');
    expect(screen.getByText('Descripción')).toHaveClass('text-ink-muted');
  });

  it('Aceptar (era amarillo) usa el dorado nuevo; Cancelar (no lo era) conserva su aspecto neutro original', () => {
    renderAlert();
    expect(screen.getByRole('button', { name: 'Confirmar' })).toHaveClass('border-brand/40', 'bg-brand/10', 'text-brand', 'hover:bg-brand/25');
    expect(screen.getByRole('button', { name: 'Confirmar' })).not.toHaveClass('bg-primary');
    const cancel = screen.getByRole('button', { name: 'Cancelar' });
    expect(cancel).toHaveClass('border-input', 'bg-background', 'hover:bg-background/80');
    expect(cancel.className).not.toMatch(/brand/);
  });

  it('la variante destructiva (ALERT_DESTRUCTIVE) anula el dorado: error sobrio, sin clases doradas', () => {
    renderAlert(ALERT_DESTRUCTIVE);
    const btn = screen.getByRole('button', { name: 'Confirmar' });
    expect(btn).toHaveClass('bg-error-bg', 'border-error-border', 'text-error-text', 'hover:bg-error-border/40');
    expect(btn).not.toHaveClass('text-brand');
    expect(btn).not.toHaveClass('border-brand/40');
    expect(btn).not.toHaveClass('bg-brand/10');
    expect(btn).not.toHaveClass('hover:bg-brand/25');
  });

  it('cn(BTN_PRIMARY, ALERT_DESTRUCTIVE) no deja conflictos de color', () => {
    const merged = cn(BTN_PRIMARY, ALERT_DESTRUCTIVE);
    expect(merged).not.toMatch(/(?<![:\w-])text-brand/);
    expect(merged).not.toMatch(/(?<![:\w-])bg-brand\/10/);
    expect(merged).not.toMatch(/hover:bg-brand\/25/);
    expect(cn(BTN_SECONDARY)).toContain('border-line-subtle'); // el secundario es gris, no dorado
  });

  it('Confirmar dispara su handler', () => {
    const onClick = vi.fn();
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>t</AlertDialogTitle>
          <AlertDialogDescription>d</AlertDialogDescription>
          <AlertDialogAction onClick={onClick}>OK</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('Dialog con tokens', () => {
  it('contenido, título y descripción usan tokens (sin slate/gray/white)', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Título</DialogTitle>
          <DialogDescription>Texto</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toHaveClass('bg-surface-panel', 'border-line-subtle', 'text-ink');
    expect(screen.getByText('Título')).toHaveClass('text-ink');
    expect(screen.getByText('Texto')).toHaveClass('text-ink-muted');
    expect(document.body.innerHTML).not.toMatch(/\b(slate|gray)-\d{2,3}|bg-black|text-white/);
  });
});

describe('Toast con tokens', () => {
  const renderToast = (variant) =>
    render(
      <ToastProvider>
        <Toast open variant={variant}>
          <ToastTitle>Aviso</ToastTitle>
          <ToastClose />
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    );

  it('default: panel con borde sutil', () => {
    renderToast('default');
    expect(screen.getByText('Aviso').closest('li')).toHaveClass('bg-surface-panel', 'border-line-subtle', 'text-ink');
  });

  it('destructive: error sobrio (#1E1215 / #4C1D24 / #E06C75), sin rojos crudos', () => {
    renderToast('destructive');
    const toast = screen.getByText('Aviso').closest('li');
    expect(toast).toHaveClass('bg-error-bg', 'border-error-border', 'text-error-text');
    expect(document.body.innerHTML).not.toMatch(/\bred-\d{2,3}/);
  });
});
