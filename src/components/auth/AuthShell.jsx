import React from 'react';
import LanguageSwitcher from '@/components/LanguageSwitcher';

/**
 * Armazón de las pantallas de autenticación centradas (Invite, Password Reset): fondo, selector de
 * idioma y tarjeta con animación de entrada. Los estilos viven en index.css (.auth-bg / .auth-card).
 */
const AuthShell = ({ children }) => (
  <div className="auth-bg flex min-h-screen items-center justify-center">
    <div className="absolute right-4 top-4 z-20">
      <LanguageSwitcher />
    </div>
    <div className="auth-card auth-card-enter w-full max-w-md space-y-8 rounded-2xl p-8">{children}</div>
  </div>
);

export default AuthShell;
