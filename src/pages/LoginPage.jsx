import { tx } from "@/i18n/tx";
import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import LanguageSwitcher from '../components/LanguageSwitcher';
import AuthField from '@/components/auth/AuthField';
import AuthAlert from '@/components/auth/AuthAlert';
import AuthButton from '@/components/auth/AuthButton';

// Logo: el fondo blanco es un requisito de marca. Se presenta como una placa premium que flota sobre el panel
// (esquinas amplias, aire alrededor del logo, sombra profunda y aro sutil). El blanco es literal a propósito.
const LOGO_CARD = "mx-auto flex w-full items-center justify-center overflow-hidden bg-white rounded-2xl p-[clamp(0.75rem,2.2dvh,1.5rem)] shadow-2xl shadow-black/60 ring-1 ring-ink/10 mb-[clamp(0.5rem,1.8dvh,1.5rem)]"; // guard-allow-raw
// La red de constelación se ve en los bordes del panel y desaparece detrás de los campos
const CONSTELLATION_FADE = "[mask-image:radial-gradient(ellipse_at_center,transparent_25%,black_95%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,transparent_25%,black_95%)]";

// Campos del Login: etiqueta que se ilumina al enfocar y campo con relleno adaptable a la altura de la pantalla.
// `!py-` (importante) porque INPUT fija `!py-0`.
const LOGIN_LABEL = "text-ink transition-colors group-focus-within:text-brand";
const LOGIN_INPUT = "h-auto sm:h-auto rounded-xl !py-[clamp(0.5rem,1.5dvh,0.875rem)] bg-surface-card/80 shadow-inner duration-300 focus:bg-surface-card focus:ring-4 focus:ring-brand/10 focus:-translate-y-px";

const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: supaError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (supaError) {
      console.error('[Login] signInWithPassword falló:', supaError.status, supaError.code, supaError.message);
      // Solo un rechazo real de Supabase significa "credenciales incorrectas"; el resto es de configuración o de red
      const isBadCredentials =
        supaError.code === 'invalid_credentials' ||
        (supaError.status === 400 && /invalid login credentials/i.test(supaError.message || ''));
      if (!isSupabaseConfigured) {
        setError(tx("Configuración incompleta: el sitio se compiló sin las claves de Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)."));
      } else if (isBadCredentials) {
        setError(t('auth.login.invalidCredentials'));
      } else if (!supaError.status || /fetch|network/i.test(supaError.message || '')) {
        setError(tx("No se pudo conectar con el servidor de autenticación. Revisa tu conexión e inténtalo de nuevo."));
      } else {
        setError(tx("No se pudo iniciar sesión ({{code}}): {{message}}", { code: supaError.code || supaError.status, message: supaError.message }));
      }
    } else {
      if (onLogin) {
        onLogin({ email });
      }
    }
    setLoading(false);
  };

  // Configuración de físicas para la UI
  const springConfig = { type: "spring", bounce: 0, duration: 0.4 };
  
  const staggerContainer = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } }
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: springConfig }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col lg:flex-row bg-background text-ink font-sans selection:bg-brand/30">
      
      {/* ==========================================
          PANEL IZQUIERDO: FONDO EÓLICO ANIMADO (60% DE ANCHO)
          ========================================== */}
      <div className="hidden lg:flex lg:w-[60%] relative overflow-hidden bg-background flex-col justify-end p-16 border-r border-ink/5 shadow-[inset_-20px_0_40px_rgba(0,0,0,0.2)] z-0">
        
        {/* Capa de iluminación atmosférica detrás del SVG */}
        <div className="absolute top-[10%] left-[10%] w-[50vw] h-[50vw] bg-status-progress/20 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[20%] right-[5%] w-[40vw] h-[40vw] bg-info/10 rounded-full blur-[120px] pointer-events-none" />

        {/* --- MOTOR CSS PARA EL NUEVO SVG --- */}
        <style dangerouslySetInnerHTML={{__html: `
          /* Animación de los aerogeneradores */
          .spin-slow { transform-origin: 0px 0px; animation: spin 5s linear infinite; }
          .spin-med { transform-origin: 0px 0px; animation: spin 3.5s linear infinite; }
          .spin-fast { transform-origin: 0px 0px; animation: spin 2.8s linear infinite; }
          @keyframes spin { 100% { transform: rotate(360deg); } }
          
          /* Simulación de ráfagas de viento */
          .wind {
            fill: none; stroke: #64748b; stroke-width: 2.5; stroke-linecap: round;
            opacity: 0.4; stroke-dasharray: 20 120; animation: flow linear infinite;
          }
          .wind-1 { animation-duration: 3s; animation-delay: 0.1s; }
          .wind-2 { animation-duration: 4s; animation-delay: 1.5s; }
          .wind-3 { animation-duration: 5s; animation-delay: 0.8s; }
          .wind-4 { animation-duration: 3.5s; animation-delay: 2.2s; }
          
          @keyframes flow {
            0% { stroke-dashoffset: 140; opacity: 0; }
            20% { opacity: 0.5; }
            80% { opacity: 0.5; }
            100% { stroke-dashoffset: -140; opacity: 0; }
          }
          
          /* Animación de ascenso y descenso de los drones (ELEVADOS) */
          .flight-1 { animation: inspect-1 8s ease-in-out infinite alternate; }
          .flight-2 { animation: inspect-2 11s ease-in-out infinite alternate; }
          .flight-3 { animation: inspect-3 9s ease-in-out infinite alternate; }
          
          @keyframes inspect-1 {
            0% { transform: translate(160px, 340px) scale(0.7) rotate(-3deg); }
            100% { transform: translate(180px, 60px) scale(0.7) rotate(2deg); }
          }
          @keyframes inspect-2 {
            0% { transform: translate(430px, 380px) scale(1) rotate(2deg); }
            100% { transform: translate(410px, 80px) scale(1) rotate(-1deg); }
          }
          @keyframes inspect-3 {
            0% { transform: translate(690px, 320px) scale(0.8) rotate(-2deg); }
            100% { transform: translate(670px, 100px) scale(0.8) rotate(1deg); }
          }

          /* Animación de las hélices usando opacidad */
          .rotor-spin { animation: fast-spin 0.05s linear infinite alternate; }
          @keyframes fast-spin { 
            0% { opacity: 0.8; } 
            100% { opacity: 0.1; } 
          }
        `}} />

        {/* --- SVG EÓLICO INTEGRADO --- */}
        <svg 
          viewBox="0 0 800 500" 
          className="absolute inset-0 w-full h-full object-cover opacity-100 z-0 pointer-events-none"
          preserveAspectRatio="xMidYMax slice"
        >
          <defs>
            {/* Torre del aerogenerador */}
            <g id="turbine">
              <path d="M-6,220 L6,220 L1.5,-20 L-1.5,-20 Z" fill="#334155" />
            </g>

            {/* Aspas del aerogenerador */}
            <g id="blades">
              <g>
                <path d="M-1.5,-4 L-4,-40 L0,-115 L2,-40 L1.5,-4 Z" fill="#475569" />
                <path d="M-1.5,-4 L-4,-40 L0,-115 L2,-40 L1.5,-4 Z" fill="#475569" transform="rotate(120)" />
                <path d="M-1.5,-4 L-4,-40 L0,-115 L2,-40 L1.5,-4 Z" fill="#475569" transform="rotate(240)" />
              </g>
              <circle cx="0" cy="0" r="4.5" fill="#94a3b8" />
            </g>

            {/* Estructura del Dron Rediseñada */}
            <g id="drone">
              {/* Tren de aterrizaje */}
              <path d="M-10,8 L-14,15 L-6,15 M10,8 L14,15 L6,15" stroke="#64748b" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              {/* Brazos estructurales */}
              <path d="M-12,2 L-26,-3 M12,2 L26,-3" stroke="#94a3b8" strokeWidth="3.5" strokeLinecap="round" />
              {/* Motores */}
              <rect x="-28" y="-7" width="5" height="7" fill="#1e293b" rx="1.5" />
              <rect x="23" y="-7" width="5" height="7" fill="#1e293b" rx="1.5" />
              {/* Cuerpo principal y cúpula */}
              <ellipse cx="0" cy="2" rx="15" ry="6" fill="#475569" />
              <path d="M-10,0 Q0,-10 10,0 L12,3 L-12,3 Z" fill="#64748b" />
              {/* Luz frontal del dron / Lente de cámara (Ámbar) */}
              <circle cx="10" cy="3" r="2.5" fill="#f59e0b" className="animate-pulse" />
              {/* Hélices animadas */}
              <ellipse cx="-25.5" cy="-8" rx="14" ry="2" fill="#cbd5e1" className="rotor-spin" />
              <ellipse cx="25.5" cy="-8" rx="14" ry="2" fill="#cbd5e1" className="rotor-spin" />
            </g>
          </defs>

          {/* Colinas en el horizonte oscuro (ELEVADAS) */}
          <path d="M0,500 L0,340 Q200,300 450,360 T800,310 L800,500 Z" fill="#1e293b" />
          <path d="M0,500 L0,380 Q250,330 500,390 T800,360 L800,500 Z" fill="#0f172a" />

          {/* Ráfagas de Viento (ELEVADAS) */}
          <path d="M-50,70 Q200,40 400,80 T850,60" className="wind wind-1" />
          <path d="M-50,200 Q250,240 450,180 T850,220" className="wind wind-2" />
          <path d="M-50,0 Q300,-30 600,40 T900,10" className="wind wind-3" />
          <path d="M100,300 Q350,270 550,320 T850,290" className="wind wind-4" />

          {/* Aerogeneradores Detrás de los drones (ELEVADOS) */}
          <g transform="translate(180, 200) scale(0.65)">
            <use href="#turbine" />
            <g className="spin-slow"><use href="#blades" /></g>
          </g>
          <g transform="translate(420, 230) scale(1.1)">
            <use href="#turbine" />
            <g className="spin-med"><use href="#blades" /></g>
          </g>
          <g transform="translate(680, 160) scale(0.85)">
            <use href="#turbine" />
            <g className="spin-fast"><use href="#blades" /></g>
          </g>

          {/* Drones en movimiento */}
          <g className="flight-1"><use href="#drone" /></g>
          <g className="flight-2"><use href="#drone" /></g>
          <g className="flight-3"><use href="#drone" /></g>
        </svg>

        {/* Gradientes sutiles para fundir el SVG con los bordes */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-background z-10" />

        {/* Texto sobrepuesto */}
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="relative z-20 max-w-xl pb-12">
          <motion.h1 variants={fadeUp} className="text-4xl xl:text-5xl font-bold tracking-tight text-ink mb-6 leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
            {tx("Transformamos ideas en soluciones digitales que impulsan tu negocio.")}
          </motion.h1>
          <motion.p variants={fadeUp} className="text-lg text-ink leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] font-medium">
            {tx("Accede VND Blade Platform y descubre herramientas poderosas que te ayudarán a optimizar tus inspecciones eólicas y alargar el ciclo de vida de tus aerogeneradores.")}
          </motion.p>
        </motion.div>
      </div>

      {/* ==========================================
          PANEL DERECHO: FORMULARIO DE ACCESO (40% DE ANCHO)
          ========================================== */}
      <div className="w-full lg:w-[40%] min-h-[100dvh] flex flex-col items-center justify-center px-6 pb-8 pt-12 sm:px-12 sm:pb-8 sm:pt-12 relative overflow-hidden bg-background z-20">

        {/* Resplandor azul petróleo profundo (#0B1E36 al 40 %) detrás del logo y el formulario: funde el brillo del logo con toda la columna */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_38%,hsl(213_66%_13%/0.4),transparent_75%)]" />

        {/* Red de constelación decorativa (~11 % de opacidad), desvanecida detrás de los campos para no afectar la lectura */}
        <svg
          aria-hidden="true"
          viewBox="0 0 400 800"
          preserveAspectRatio="xMidYMid slice"
          className={`pointer-events-none absolute inset-0 h-full w-full opacity-[0.11] ${CONSTELLATION_FADE}`}
        >
          <g className="text-info" stroke="currentColor" strokeWidth="1" fill="currentColor">
            <path fill="none" d="M20,60 L110,30 L190,95 L120,150 L20,60 M110,30 L240,20 L190,95 M120,150 L60,240 L170,260 L120,150" />
            <path fill="none" d="M20,720 L90,640 L180,700 L110,780 L20,720 M90,640 L60,560 L170,590 L180,700" />
            {[[20, 60], [110, 30], [190, 95], [120, 150], [240, 20], [60, 240], [170, 260], [20, 720], [90, 640], [180, 700], [110, 780], [60, 560], [170, 590]].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="2.5" stroke="none" />
            ))}
          </g>
          <g className="text-brand" stroke="currentColor" strokeWidth="1" fill="currentColor">
            <path fill="none" d="M380,80 L310,150 L390,210 L320,290 L310,150 M380,80 L330,20 L260,60 L310,150" />
            <path fill="none" d="M380,690 L300,640 L330,560 L390,600 L380,690 L290,740 L300,640 M330,560 L270,500" />
            {[[380, 80], [310, 150], [390, 210], [320, 290], [330, 20], [260, 60], [380, 690], [300, 640], [330, 560], [390, 600], [290, 740], [270, 500]].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="2.5" stroke="none" />
            ))}
          </g>
        </svg>

        <div className="absolute top-2.5 right-3 z-20">
          <LanguageSwitcher compact />
        </div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...springConfig, delay: 0.3 }}
          className="w-full max-w-md relative"
        >
          <div className="relative text-center mb-[clamp(0.25rem,1.5dvh,1.25rem)] lg:text-left">
            {/* Resplandor suave detrás de la placa: parece iluminar el panel oscuro */}
            <div aria-hidden="true" className="pointer-events-none absolute -inset-x-12 -top-12 h-64 bg-[radial-gradient(ellipse_at_center,hsl(var(--info)/0.1),transparent_70%)]" />
            <div className={`relative ${LOGO_CARD}`}>
              <img
                src="/icons/vindReport.png"
                alt="VND Blade Platform Logo"
                className="block h-[clamp(5rem,15dvh,8rem)] w-full object-contain"
              />
            </div>
            <p className="relative mx-auto mb-[clamp(0.5rem,2dvh,1.25rem)] max-w-sm text-balance text-center text-sm text-ink-muted">
              {t('auth.login.subtitle', 'Accede a tu panel de control')}
            </p>
          </div>

          <motion.form layout transition={springConfig} onSubmit={handleLogin} className="space-y-[clamp(0.5rem,2dvh,1.5rem)]">
            
            <motion.div layout>
              <AuthField
                id="email"
                className="group"
                label={t('auth.login.email', 'Correo electrónico')}
                labelClassName={LOGIN_LABEL}
                inputClassName={LOGIN_INPUT}
                type="email"
                placeholder={tx("tu@email.com")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </motion.div>

            <motion.div layout>
              <AuthField
                id="password"
                className="group"
                label={t('auth.login.password', 'Contraseña')}
                labelClassName={LOGIN_LABEL}
                inputClassName={LOGIN_INPUT}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                toggle={{ shown: showPassword, onToggle: () => setShowPassword(!showPassword), size: 18 }}
              />
            </motion.div>

            <motion.div layout className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input type="checkbox" className="peer sr-only" />
                  <div className="w-4 h-4 border border-ink/40 rounded bg-surface-panel peer-checked:bg-brand peer-checked:border-brand transition-colors"></div>
                  <svg className="absolute w-3 h-3 text-ink opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" viewBox="0 0 14 10" fill="none">
                    <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="text-sm text-ink/80 transition-colors">
                  {t('auth.login.rememberMe', 'Mantener sesión iniciada')}
                </span>
              </label>

              <button
                type="button"
                onClick={() => navigate('/password-reset')}
                disabled={loading}
                className="text-sm font-medium text-ink/90 hover:text-brand transition-colors disabled:opacity-50"
              >
                {t('auth.login.forgotPassword', '¿Olvidaste tu contraseña?')}
              </button>
            </motion.div>
            
            <AnimatePresence mode="popLayout">
              {error && (
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.95, height: 0 }} 
                  animate={{ opacity: 1, scale: 1, height: 'auto' }} 
                  exit={{ opacity: 0, scale: 0.95, height: 0 }}
                  transition={springConfig}
                  className="overflow-hidden"
                >
                  <AuthAlert tone="error" className="mt-2 justify-center rounded-xl p-4 text-center font-medium">
                    {error}
                  </AuthAlert>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div layout className="pt-[clamp(0.25rem,1.5dvh,1.5rem)]">
              {/* "Continuar": botón primario dorado del sistema (se elimina el degradado animado) */}
              <AuthButton
                as={motion.button}
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: loading ? 1 : 0.97 }}
                transition={{ duration: 0.2 }}
                className="h-auto rounded-xl border-ink bg-ink py-[clamp(0.625rem,1.8dvh,1rem)] text-base font-semibold text-surface-base shadow-sm hover:bg-ink/90 sm:h-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>{t('auth.login.loggingIn', 'Continuando...')}</span>
                  </>
                ) : (
                  <span>{t('auth.login.loginButton', 'Continuar')}</span>
                )}
              </AuthButton>
            </motion.div>

          </motion.form>
        </motion.div>
      </div>

    </div>
  );
};

export default LoginPage;