import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from './LoginPage';
import PasswordResetPage from './PasswordResetPage';
import SetupPasswordPage from './InvitePage';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  setSession: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
      setSession: mocks.setSession,
      getSession: mocks.getSession,
      getUser: mocks.getUser,
      updateUser: mocks.updateUser,
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { role: 'client' } }) }) }), insert: vi.fn() }),
  },
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/components/LanguageSwitcher', () => ({ default: () => <div data-testid="lang" /> }));
vi.mock('@/i18n/tx', () => ({ tx: (s, o) => (o ? s.replace(/\{\{(\w+)\}\}/g, (_, k) => o[k]) : s) }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k, d) => (typeof d === 'string' ? d : k) }),
}));

const goldClasses = ['border-brand/40', 'bg-brand/10', 'text-brand', 'hover:bg-brand/25'];

beforeEach(() => {
  vi.clearAllMocks();
  window.location.hash = '';
});
afterEach(() => {
  window.location.hash = '';
});

describe('LoginPage', () => {
it('el logo vindReport.png va en su placa blanca de marca, con acabado premium', () => {
    render(<LoginPage />);
    const logo = screen.getByAltText('VND Blade Platform Logo');
    expect(logo).toHaveAttribute('src', '/icons/vindReport.png');
    const card = logo.parentElement;
    expect(card).toHaveClass('bg-white', 'rounded-2xl', 'shadow-2xl', 'shadow-black/60', 'ring-1', 'ring-ink/10', 'mx-auto', 'w-full');
    expect(card.className).toMatch(/\bp-\[clamp/);
  });

  it('conserva la ilustración eólica con sus colores literales', () => {
    const { container } = render(<LoginPage />);
    const svg = container.querySelector('svg[viewBox="0 0 800 500"]');
    expect(svg).not.toBeNull();
    expect(svg.querySelector('path[fill="#334155"]')).not.toBeNull(); // torre
    expect(svg.querySelector('circle[fill="#f59e0b"]')).not.toBeNull(); // luz del dron
  });

  it('"Continuar" es un botón blanco sólido con texto oscuro, sin degradado', () => {
    render(<LoginPage />);
    const cta = screen.getByRole('button', { name: 'Continuar' });
    expect(cta).toHaveClass('bg-ink', 'text-surface-base', 'font-semibold', 'hover:bg-ink/90', 'rounded-xl');
    expect(cta).not.toHaveClass('text-brand', 'bg-brand/10');
    expect(cta).toHaveAttribute('type', 'submit');
    expect(cta.className).not.toMatch(/gradient|from-blue|to-amber|shimmer/);
  });

  it('campos con el estilo del sistema y la etiqueta que se ilumina al enfocar', () => {
    render(<LoginPage />);
    const email = screen.getByLabelText('Correo electrónico');
    expect(email).toHaveClass('rounded-xl', 'bg-surface-card/80', 'focus:ring-brand/10');
    expect(email).toHaveAttribute('type', 'email');
    expect(screen.getByText('Correo electrónico')).toHaveClass('group-focus-within:text-brand', 'text-ink');
  });

  it('mostrar/ocultar contraseña alterna el tipo del campo', () => {
    render(<LoginPage />);
    const pass = screen.getByLabelText('Contraseña');
    expect(pass).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { pressed: false }));
    expect(pass).toHaveAttribute('type', 'text');
  });

  it('el envío llama a signInWithPassword con las credenciales y notifica onLogin (lógica intacta)', async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    const onLogin = vi.fn();
    render(<LoginPage onLogin={onLogin} />);
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'demo@vindgroup.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secreto' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: 'demo@vindgroup.com', password: 'secreto' }));
    await waitFor(() => expect(onLogin).toHaveBeenCalledWith({ email: 'demo@vindgroup.com' }));
  });

  it('credenciales inválidas muestran el error en vino sobrio con rol alert', async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: null, error: { code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' } });
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('auth.login.invalidCredentials');
    expect(alert).toHaveClass('bg-error-bg', 'border-error-border', 'text-error-text');
  });

  it('"¿Olvidaste tu contraseña?" navega a /password-reset', () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/password-reset');
  });
});

describe('PasswordResetPage', () => {
  it('formulario: icono en círculo, campo de correo y botón primario dorado', () => {
    render(<PasswordResetPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('auth.passwordReset.title');
    expect(screen.getByLabelText('auth.passwordReset.email')).toHaveAttribute('type', 'email');
    const send = screen.getByRole('button', { name: /auth.passwordReset.sendButton/ });
    expect(send).toHaveClass(...goldClasses);
    expect(send).toBeDisabled(); // sin correo
  });

  it('el envío llama a resetPasswordForEmail con la redirección a /invite y muestra el éxito', async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    render(<PasswordResetPage />);
    fireEvent.change(screen.getByLabelText('auth.passwordReset.email'), { target: { value: 'me@x.com' } });
    fireEvent.click(screen.getByRole('button', { name: /auth.passwordReset.sendButton/ }));
    await waitFor(() =>
      expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith('me@x.com', { redirectTo: `${window.location.origin}/invite` }),
    );
    expect(await screen.findByText('auth.passwordReset.emailSent')).toBeInTheDocument();
    expect(screen.getByText('me@x.com').tagName).toBe('STRONG');
    // aviso informativo en celeste y botones: primario dorado + secundario gris
    expect(screen.getByText(/auth.passwordReset.tipTitle/).closest('[data-tone]')).toHaveAttribute('data-tone', 'info');
    expect(screen.getByRole('button', { name: /auth.passwordReset.backToLogin/ })).toHaveClass(...goldClasses);
    const another = screen.getByRole('button', { name: 'auth.passwordReset.sendToAnother' });
    expect(another).toHaveClass('border-line-subtle', 'bg-surface-card');
  });

  it('un error de límite de envíos muestra el aviso de error', async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: { message: 'email rate limit exceeded' } });
    render(<PasswordResetPage />);
    fireEvent.change(screen.getByLabelText('auth.passwordReset.email'), { target: { value: 'me@x.com' } });
    fireEvent.click(screen.getByRole('button', { name: /auth.passwordReset.sendButton/ }));
    // (el mensaje incluye "email", así que la lógica original lo clasifica como correo no encontrado)
    expect(await screen.findByRole('alert')).toHaveClass('text-error-text');
  });

  it('volver al inicio de sesión navega a /login', () => {
    render(<PasswordResetPage />);
    fireEvent.click(screen.getByRole('button', { name: /auth.passwordReset.backToLogin/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/login');
  });
});

describe('InvitePage (SetupPasswordPage)', () => {
  const withInviteHash = (type = 'invite') => {
    window.location.hash = `#access_token=at&refresh_token=rt&type=${type}`;
    mocks.setSession.mockResolvedValue({ data: {}, error: null });
    mocks.getUser.mockResolvedValue({ data: { user: { email: 'nuevo@x.com' } }, error: null });
  };

  it('invitación: carga la sesión del enlace, muestra el correo en un aviso celeste y el título de configuración', async () => {
    withInviteHash('invite');
    render(<SetupPasswordPage />);
    expect(await screen.findByText('nuevo@x.com')).toBeInTheDocument();
    expect(mocks.setSession).toHaveBeenCalledWith({ access_token: 'at', refresh_token: 'rt' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('auth.passwordSetup.setupTitle');
    expect(screen.getByText('nuevo@x.com').closest('[data-tone]')).toHaveAttribute('data-tone', 'info');
  });

  it('recuperación (type=recovery): usa el flujo de restablecimiento', async () => {
    withInviteHash('recovery');
    render(<SetupPasswordPage />);
    expect(await screen.findByText('nuevo@x.com')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('auth.passwordSetup.resetTitle');
  });

  it('enlace caducado: muestra el error en vino sobrio', async () => {
    window.location.hash = '#error=access_denied&error_code=otp_expired';
    render(<SetupPasswordPage />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('auth.passwordSetup.errors.expiredInvite');
    expect(alert).toHaveClass('bg-error-bg', 'text-error-text');
  });

  it('los requisitos de contraseña se marcan en verde al cumplirse y el botón se habilita solo con todo válido', async () => {
    withInviteHash();
    render(<SetupPasswordPage />);
    await screen.findByText('nuevo@x.com');
    const submit = screen.getByRole('button', { name: /auth.passwordSetup.setupButton/ });
    expect(submit).toHaveClass(...goldClasses);
    expect(submit).toBeDisabled();

    const rule = (key) => screen.getByText(`auth.passwordSetup.requirements.${key}`);
    expect(rule('minLength')).toHaveAttribute('data-ok', 'false');

    fireEvent.change(screen.getByLabelText('auth.passwordSetup.newPassword'), { target: { value: 'Abcdef1!' } });
    expect(rule('minLength')).toHaveAttribute('data-ok', 'true');
    expect(rule('minLength')).toHaveClass('text-status-done');
    expect(rule('uppercase')).toHaveAttribute('data-ok', 'true');
    expect(rule('lowercase')).toHaveAttribute('data-ok', 'true');
    expect(rule('specialChar')).toHaveAttribute('data-ok', 'true');
    expect(rule('match')).toHaveAttribute('data-ok', 'false');
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText('auth.passwordSetup.confirmPassword'), { target: { value: 'Abcdef1!' } });
    expect(rule('match')).toHaveAttribute('data-ok', 'true');
    expect(submit).toBeEnabled();
  });

  it('mostrar/ocultar cada contraseña es independiente', async () => {
    withInviteHash();
    render(<SetupPasswordPage />);
    await screen.findByText('nuevo@x.com');
    const [t1, t2] = screen.getAllByRole('button', { pressed: false });
    const pass = screen.getByLabelText('auth.passwordSetup.newPassword');
    const confirm = screen.getByLabelText('auth.passwordSetup.confirmPassword');
    fireEvent.click(t1);
    expect(pass).toHaveAttribute('type', 'text');
    expect(confirm).toHaveAttribute('type', 'password');
    fireEvent.click(t2);
    expect(confirm).toHaveAttribute('type', 'text');
  });

  it('el envío válido llama a updateUser con la nueva contraseña (lógica intacta)', async () => {
    withInviteHash();
    mocks.updateUser.mockResolvedValue({ data: {}, error: null });
    render(<SetupPasswordPage />);
    await screen.findByText('nuevo@x.com');
    fireEvent.change(screen.getByLabelText('auth.passwordSetup.newPassword'), { target: { value: 'Abcdef1!' } });
    fireEvent.change(screen.getByLabelText('auth.passwordSetup.confirmPassword'), { target: { value: 'Abcdef1!' } });
    fireEvent.click(screen.getByRole('button', { name: /auth.passwordSetup.setupButton/ }));
    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledWith(expect.objectContaining({ password: 'Abcdef1!' })));
  });
});
