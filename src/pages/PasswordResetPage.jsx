import React, { useState } from 'react';
import { Mail, ArrowLeft, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthShell from '@/components/auth/AuthShell';
import AuthHeader from '@/components/auth/AuthHeader';
import AuthField from '@/components/auth/AuthField';
import AuthAlert from '@/components/auth/AuthAlert';
import AuthButton from '@/components/auth/AuthButton';
import AuthLinkButton from '@/components/auth/AuthLinkButton';

const PasswordResetPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {

      // Enviar correo de recuperación de contraseña
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/invite` // Redirigir a la página de configuración de contraseña
      });

      if (resetError) {
        console.error('Error enviando correo:', resetError);

        // Manejar diferentes tipos de errores
        if (resetError.message.includes('not found') || resetError.message.includes('email')) {
          setError(t('auth.passwordReset.errors.emailNotFound'));
        } else if (resetError.message.includes('rate limit')) {
          setError(t('auth.passwordReset.errors.rateLimited'));
        } else {
          setError(t('auth.passwordReset.errors.sendError'));
        }

        return;
      }

      setSuccess(true);

    } catch (error) {
      console.error('Error inesperado:', error);
      setError(t('auth.passwordReset.errors.unexpectedError'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthShell>
        <AuthHeader
          tone="success"
          icon={<Check size={24} />}
          title={t('auth.passwordReset.emailSent')}
          subtitle={
            <>
              {t('auth.passwordReset.emailSentMessage')} <strong className="text-ink">{email}</strong>.
              {" "}
              {t('auth.passwordReset.checkInbox')}
            </>
          }
        >
          <AuthAlert tone="info" className="mb-6">
            <p>
              💡 <strong>{t('auth.passwordReset.tipTitle')}</strong> {t('auth.passwordReset.tipMessage')}
            </p>
          </AuthAlert>
        </AuthHeader>

        <div className="space-y-4">
          <AuthButton onClick={() => navigate('/login')} icon={<ArrowLeft size={20} />}>
            {t('auth.passwordReset.backToLogin')}
          </AuthButton>

          <AuthButton
            variant="secondary"
            onClick={() => {
              setSuccess(false);
              setEmail('');
            }}
          >
            {t('auth.passwordReset.sendToAnother')}
          </AuthButton>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthHeader
        icon={<Mail size={24} />}
        title={t('auth.passwordReset.title')}
        subtitle={t('auth.passwordReset.subtitle')}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Mensajes de error */}
        {error && (
          <AuthAlert tone="error" icon={<AlertCircle size={16} />}>
            <span>{error}</span>
          </AuthAlert>
        )}

        {/* Campo de email */}
        <AuthField
          id="email"
          label={t('auth.passwordReset.email')}
          type="email"
          placeholder={t('auth.passwordReset.emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />

        <AuthButton
          type="submit"
          disabled={loading || !email}
          loading={loading}
          icon={<Mail size={20} />}
        >
          {loading ? t('auth.passwordReset.sending') : t('auth.passwordReset.sendButton')}
        </AuthButton>
      </form>

      <div className="text-center">
        <AuthLinkButton onClick={() => navigate('/login')} icon={<ArrowLeft size={16} />}>
          {t('auth.passwordReset.backToLogin')}
        </AuthLinkButton>
      </div>
    </AuthShell>
  );
};

export default PasswordResetPage;
