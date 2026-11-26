import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AuthShell from './AuthShell';
import AuthHeader from './AuthHeader';
import AuthField from './AuthField';
import AuthAlert from './AuthAlert';
import AuthButton from './AuthButton';
import AuthLinkButton from './AuthLinkButton';
import PasswordRules from './PasswordRules';

vi.mock('@/components/LanguageSwitcher', () => ({ default: () => <div data-testid="lang" /> }));

describe('AuthShell', () => {
  it('fondo y tarjeta con las clases compartidas, selector de idioma y contenido', () => {
    const { container } = render(<AuthShell><p>hola</p></AuthShell>);
    expect(container.firstChild).toHaveClass('auth-bg', 'min-h-screen');
    expect(screen.getByTestId('lang')).toBeInTheDocument();
    expect(screen.getByText('hola').parentElement).toHaveClass('auth-card', 'auth-card-enter', 'rounded-2xl');
  });
});

describe('AuthHeader', () => {
  it('círculo de icono (marca), h1 blanco y subtítulo tenue', () => {
    render(<AuthHeader icon={<i data-testid="ic" />} title="Título" subtitle="Sub" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Título' })).toHaveClass('text-ink');
    expect(screen.getByTestId('ic').parentElement).toHaveClass('bg-brand/20', 'text-brand', 'rounded-full');
    expect(screen.getByText('Sub')).toHaveClass('text-ink-muted');
  });

  it('tono success usa el verde salvia y admite nodos en el subtítulo y children', () => {
    render(
      <AuthHeader tone="success" icon={<i data-testid="ic" />} title="OK" subtitle={<>a <strong>b</strong></>}>
        <span>extra</span>
      </AuthHeader>,
    );
    expect(screen.getByTestId('ic').parentElement).toHaveClass('bg-status-done/20', 'text-status-done');
    expect(screen.getByText('b').tagName).toBe('STRONG');
    expect(screen.getByText('extra')).toBeInTheDocument();
  });
});

describe('AuthField', () => {
  it('etiqueta dorada asociada al input, con el estilo INPUT del sistema y foco dorado', () => {
    render(<AuthField id="email" label="Correo" type="email" value="" onChange={() => {}} />);
    const input = screen.getByLabelText('Correo');
    expect(screen.getByText('Correo')).toHaveClass('text-brand');
    expect(input).toHaveClass('bg-surface-card', 'border-line-subtle', 'text-ink', 'focus:border-brand/60', 'focus:ring-brand/30', 'h-12', 'rounded-lg');
  });

  it('el botón de mostrar/ocultar alterna y expone aria-pressed', () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <AuthField id="p" label="Pass" type="password" value="" onChange={() => {}} toggle={{ shown: false, onToggle }} />,
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('Pass')).toHaveClass('pr-12');
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(<AuthField id="p" label="Pass" type="text" value="" onChange={() => {}} toggle={{ shown: true, onToggle }} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('disabled deshabilita el input y el botón; sin toggle no hay botón', () => {
    const { rerender } = render(<AuthField id="p" label="P" value="" onChange={() => {}} disabled toggle={{ shown: false, onToggle: () => {} }} />);
    expect(screen.getByLabelText('P')).toBeDisabled();
    expect(screen.getByRole('button')).toBeDisabled();
    rerender(<AuthField id="p" label="P" value="" onChange={() => {}} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('inputClassName sobrescribe el tamaño por defecto (twMerge)', () => {
    render(<AuthField id="x" label="X" value="" onChange={() => {}} inputClassName="h-auto rounded-xl" />);
    const input = screen.getByLabelText('X');
    expect(input).toHaveClass('h-auto', 'rounded-xl');
    expect(input).not.toHaveClass('h-12');
  });
});

describe('AuthAlert', () => {
  it.each([
    ['error', ['border-error-border', 'bg-error-bg', 'text-error-text'], 'alert'],
    ['success', ['border-status-done/30', 'bg-status-done/10', 'text-status-done'], 'status'],
    ['info', ['border-info/30', 'bg-info/10', 'text-info'], 'status'],
  ])('tono %s con sus tokens y rol accesible %s', (tone, classes, role) => {
    render(<AuthAlert tone={tone} icon={<i />}>Mensaje</AuthAlert>);
    const el = screen.getByRole(role);
    expect(el).toHaveClass(...classes, 'rounded-lg', 'border');
    expect(el).toHaveTextContent('Mensaje');
  });
});

describe('PasswordRules', () => {
  it('las reglas cumplidas van en verde salvia y las demás en gris', () => {
    render(<PasswordRules title="Requisitos" rules={[{ key: 'a', ok: true, label: 'Larga' }, { key: 'b', ok: false, label: 'Mayúscula' }]} />);
    expect(screen.getByText('Requisitos')).toBeInTheDocument();
    expect(screen.getByText('Larga')).toHaveClass('text-status-done');
    expect(screen.getByText('Larga')).toHaveAttribute('data-ok', 'true');
    expect(screen.getByText('Larga').querySelector('span')).toHaveClass('bg-status-done');
    expect(screen.getByText('Mayúscula')).not.toHaveClass('text-status-done');
    expect(screen.getByText('Mayúscula')).toHaveAttribute('data-ok', 'false');
    expect(screen.getByText('Mayúscula').querySelector('span')).toHaveClass('bg-ink-muted');
  });
});

describe('AuthButton / AuthLinkButton', () => {
  it('primario: BTN_PRIMARY (dorado) de ancho completo y grande', () => {
    render(<AuthButton>Entrar</AuthButton>);
    const b = screen.getByRole('button', { name: 'Entrar' });
    expect(b).toHaveClass('border-brand/40', 'bg-brand/10', 'text-brand', 'hover:bg-brand/25', 'w-full', 'h-14');
    expect(b).toHaveAttribute('type', 'button');
  });

  it('secundario: BTN_SECONDARY (gris original), no dorado', () => {
    render(<AuthButton variant="secondary">Otro</AuthButton>);
    const b = screen.getByRole('button', { name: 'Otro' });
    expect(b).toHaveClass('border-line-subtle', 'bg-surface-card', 'text-ink', 'h-12');
    expect(b.className.split(/\s+/).filter((c) => !/ring/.test(c)).join(' ')).not.toMatch(/brand/);
  });

  it('loading muestra el indicador en lugar del icono y respeta type=submit', () => {
    const { rerender } = render(<AuthButton type="submit" icon={<i data-testid="ic" />}>Ir</AuthButton>);
    expect(screen.getByTestId('ic')).toBeInTheDocument();
    expect(screen.queryByTestId('auth-spinner')).toBeNull();
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
    rerender(<AuthButton type="submit" loading icon={<i data-testid="ic" />}>Ir</AuthButton>);
    expect(screen.getByTestId('auth-spinner')).toHaveClass('animate-spin', 'border-t-ink');
    expect(screen.getByTestId('auth-spinner').className).not.toMatch(/brand/);
    expect(screen.queryByTestId('ic')).toBeNull();
  });

  it('className puede sobrescribir el tamaño y se dispara onClick', () => {
    const onClick = vi.fn();
    render(<AuthButton className="h-auto py-2" onClick={onClick}>X</AuthButton>);
    const b = screen.getByRole('button', { name: 'X' });
    expect(b).toHaveClass('h-auto');
    expect(b).not.toHaveClass('h-14');
    fireEvent.click(b);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('AuthLinkButton: enlace tenue con hover dorado', () => {
    render(<AuthLinkButton icon={<i data-testid="i" />}>Volver</AuthLinkButton>);
    expect(screen.getByRole('button', { name: 'Volver' })).toHaveClass('text-ink-muted', 'hover:text-brand');
  });
});
