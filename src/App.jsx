import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Toaster } from '@/components/ui/toaster';
import { supabase, fetchCurrentUserRole } from '@/lib/supabase';
import { clearImageUrlCache } from '@/lib/storageUrls';
import RoleGuard from '@/components/RoleGuard';
import { useTranslation } from 'react-i18next';
import LoginPage from '@/pages/LoginPage';
import InvitePage from '@/pages/InvitePage';
import PasswordResetPage from '@/pages/PasswordResetPage';
import DashboardPage from '@/pages/DashboardPage';
import ProjectsPage from '@/pages/ProjectsPage';
import GeneralProgressPage from '@/pages/GeneralProgressPage';
import DataCapturePage from '@/pages/DataCapturePage';
import ReportsPortalPage from '@/pages/ReportsPortalPage';
import ReportEditorPage from '@/pages/ReportEditorPage';
import ReportViewerPage from '@/pages/ReportViewerPage';
import DamageEditorPage from '@/pages/DamageEditorPage';
import DamageEditorPageTest from '@/pages/DamageEditorPageTest';
import ImageViewerPage from '@/pages/ImageViewerPage';
import AdminPage from '@/pages/AdminPage';
import ProfilePage from '@/pages/ProfilePage';
import AuditLogsPage from '@/pages/AuditLogsPage';
import WtgGeneratorPage from '@/pages/WtgGeneratorPage';
import ProjectProgressPage from '@/pages/operations/ProjectProgressPage';
import AdminRegistryPage from '@/pages/admin/AdminRegistryPage';
import AppShell from '@/components/layout/AppShell';

import Header from '@/components/Header';
import LoadingSpinner from '@/components/LoadingSpinner';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [menuCollapsed, setMenuCollapsed] = useState(false);
  const knownUserIdRef = useRef(null);
  const roleRef = useRef(null);
  roleRef.current = role;
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation('common');

  useEffect(() => {
    const rawHash = window.location.hash || '';
    if (!rawHash) return;
    const hash = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
    const params = new URLSearchParams(hash);
    const type = params.get('type');
    const errorParam = params.get('error');
    const isInvite = type === 'invite' || type === 'signup';
    const isRecovery = type === 'recovery';
    const isSupabaseError = !!errorParam;
    
    if ((isInvite || isRecovery || isSupabaseError) && location.pathname !== '/invite') {
      navigate('/invite' + rawHash, { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error obteniendo sesión:', error);
        }
        
        if (session?.user) {
          knownUserIdRef.current = session.user.id;
          setUser(session.user);
          setIsAuthenticated(true);
          setTimeout(async () => {
            try {
              const r = await fetchCurrentUserRole();
              setRole(r || 'client');
            } catch (e) {
              console.error('Error obteniendo rol:', e);
              setRole('client');
            }
          }, 1000);
        } else {
          setRole(null);
        }
      } catch (error) {
        console.error('Error verificando sesión:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          if (
            (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') &&
            knownUserIdRef.current === session.user.id &&
            roleRef.current
          ) {
            setLoading(false);
            return;
          }
          if (knownUserIdRef.current && knownUserIdRef.current !== session.user.id) clearImageUrlCache();
          knownUserIdRef.current = session.user.id;
          setUser(session.user);
          setIsAuthenticated(true);
          setTimeout(async () => {
            try {
              const r = await fetchCurrentUserRole();
              const keep = r === 'client' && roleRef.current && roleRef.current !== 'client';
              if (!keep) setRole(r || 'client');
            } catch (e) {
              console.error('Error obteniendo rol (auth change):', e);
              if (!roleRef.current) setRole('client');
            }
          }, 1000);
        } else {
          clearImageUrlCache();
          knownUserIdRef.current = null;
          setUser(null);
          setIsAuthenticated(false);
          setRole(null);
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="text-gray-400 mt-4">{t('app.verifyingSession')}</p>
          <p className="text-gray-500 text-sm mt-2">{t('app.verifyingSessionDesc')}</p>
        </div>
      </div>
    );
  }

  const showHeader = isAuthenticated && location.pathname !== '/login' && location.pathname !== '/invite';
  // Menú lateral en todas las páginas autenticadas (no en login, invitación ni recuperación de contraseña).
  const showShell = showHeader && location.pathname !== '/password-reset';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white">
      <Helmet>
        <title>{t('app.title')}</title>
        <meta name="description" content={t('app.portalDescription')} />
        <meta property="og:title" content={t('app.title')} />
        <meta property="og:description" content={t('app.portalDescription')} />
      </Helmet>

      {showHeader && (
        <Header
          user={user}
          onLogout={handleLogout}
          showMenuToggle={showShell}
          menuCollapsed={menuCollapsed}
          onToggleMenu={() => setMenuCollapsed((v) => !v)}
        />
      )}
      <main>
        <AppShell enabled={showShell} collapsed={menuCollapsed}>
        <Routes>
          {/* Rutas públicas */}
          <Route path="/invite" element={<InvitePage />} />
          <Route path="/password-reset" element={<PasswordResetPage />} />
          <Route 
            path="/login" 
            element={!isAuthenticated ? <LoginPage onLogin={handleLogin} /> : <Navigate to="/" />} 
          />
          
          {/* Perfil: accesible para TODOS los usuarios autenticados */}
          <Route 
            path="/profile" 
            element={isAuthenticated ? (
              <RoleGuard role={role}>
                <ProfilePage />
              </RoleGuard>
            ) : <Navigate to="/login" />} 
          />

          {/* Rutas operativas */}
          <Route
            path="/"
            element={isAuthenticated ? (
              <RoleGuard role={role}>
                <DashboardPage role={role} />
              </RoleGuard>
            ) : <Navigate to="/login" />}
          />
          <Route
            path="/avances"
            element={isAuthenticated ? (
              <RoleGuard role={role}>
                <ProjectProgressPage />
              </RoleGuard>
            ) : <Navigate to="/login" />}
          />
          <Route
            path="/centro-admin/:registryId"
            element={isAuthenticated ? (
              <RoleGuard role={role}>
                <AdminRegistryPage />
              </RoleGuard>
            ) : <Navigate to="/login" />}
          />
          <Route 
            path="/projects" 
            element={isAuthenticated ? (
              <RoleGuard role={role}>
                <ProjectsPage />
              </RoleGuard>
            ) : <Navigate to="/login" />} 
          />
          <Route 
            path="/progress" 
            element={isAuthenticated ? (
              <RoleGuard role={role}>
                <GeneralProgressPage />
              </RoleGuard>
            ) : <Navigate to="/login" />} 
          />
          <Route 
            path="/capture" 
            element={isAuthenticated ? (
              <RoleGuard role={role}>
                <DataCapturePage />
              </RoleGuard>
            ) : <Navigate to="/login" />} 
          />
          <Route 
            path="/reports-portal" 
            element={isAuthenticated ? (
              <RoleGuard role={role}>
                <ReportsPortalPage />
              </RoleGuard>
            ) : <Navigate to="/login" />} 
          />
          <Route 
            path="/report-editor/:projectId/:turbineId" 
            element={isAuthenticated ? (
              <RoleGuard role={role}>
                <ReportEditorPage />
              </RoleGuard>
            ) : <Navigate to="/login" />} 
          />
          <Route
            path="/report-viewer/:projectId/:turbineName"
            element={isAuthenticated ? (
              <RoleGuard role={role}>
                <ReportViewerPage role={role} />
              </RoleGuard>
            ) : <Navigate to="/login" />}
          />
          <Route
            path="/damage-editor"
            element={isAuthenticated ? (
              <RoleGuard role={role}>
                <DamageEditorPage />
              </RoleGuard>
            ) : <Navigate to="/login" />}
          />
          <Route
            path="/wtg-generator"
            element={isAuthenticated ? (
              <RoleGuard role={role} requiredRole="admin">
                <WtgGeneratorPage />
              </RoleGuard>
            ) : <Navigate to="/login" />}
          />
          <Route
            path="/image-viewer"
            element={isAuthenticated ? (
              <RoleGuard role={role}>
                <ImageViewerPage />
              </RoleGuard>
            ) : <Navigate to="/login" />}
          />

          {/* Configuración: admin (solo lectura) y dev (gestión). Auditoría: EXCLUSIVO para rol 'dev' */}
          <Route
            path="/settings"
            element={isAuthenticated ? (
              <RoleGuard role={role} requiredRole="admin">
                <AdminPage />
              </RoleGuard>
            ) : <Navigate to="/login" />}
          />
          <Route
            path="/dev/auditoria"
            element={isAuthenticated ? (
              <RoleGuard role={role} requiredRole="dev">
                <AuditLogsPage />
              </RoleGuard>
            ) : <Navigate to="/login" />}
          />
          {/* Redirección de la ruta legacy /admin hacia /settings (protegida por RoleGuard) */}
          <Route
            path="/admin"
            element={<Navigate to="/settings" replace />}
          />
          
          {/* Ruta por defecto */}
          <Route path="*" element={<Navigate to={isAuthenticated ? "/" : "/login"} />} />
        </Routes>
        </AppShell>
      </main>
      <Toaster />
    </div>
  );
};

export default App;