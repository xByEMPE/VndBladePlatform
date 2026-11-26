import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import LanguageSwitcher from './LanguageSwitcher';
import UserProfile from '@/components/layout/UserProfile';
import { getCurrentUserRole } from '@/utils/userManagement';
import { getRoleLabel } from '@/lib/roleLabel';
import { ALERT_DESTRUCTIVE } from '@/lib/classes';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const Header = ({ user, onLogout }) => {
    const navigate = useNavigate();
    const { t } = useTranslation('common');
    const [showLogoutDialog, setShowLogoutDialog] = useState(false);
    const [userRole, setUserRole] = useState(null);

    const handleLogout = () => {
        onLogout();
        navigate('/login');
    };

    const handleLogoutClick = () => {
        setShowLogoutDialog(true);
    };

    const roleLabel = getRoleLabel(userRole);

    useEffect(() => {
        const fetchUserRole = async () => {
            if (user) {
                try {
                    const role = await getCurrentUserRole();
                    setUserRole(role);
                } catch (error) {
                    console.error('Error fetching user role:', error);
                }
            }
        };

        fetchUserRole();
    }, [user]);

    return (
        <>
            <motion.header
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="sticky top-0 z-40 border-b border-line-subtle bg-surface-panel"
            >
                <div className="w-full flex items-center justify-between h-16 pl-4 sm:pl-6 lg:pl-8 pr-2 sm:pr-3">
                    <div 
                        className="flex items-center gap-3 cursor-pointer"
                        onClick={() => navigate('/')}
                    >
                        <img src="/icons/ia.png" alt="VINDGROUP Icon" className="w-16 h-16"/>
                        <span className="text-2xl font-bold text-white hidden sm:block">VINDGROUP</span>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-4">
                        <UserProfile
                            email={user?.email || 'admin@vindgroup.com'}
                            role={roleLabel}
                            isDev={String(userRole || '').trim().toLowerCase() === 'dev'}
                            canConfigure={['admin', 'dev'].includes(String(userRole || '').trim().toLowerCase())}
                        />

                        <LanguageSwitcher compact />
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleLogoutClick}
                            className="h-8 rounded-lg border border-error-border bg-error-bg px-3 py-1.5 text-sm text-error-text transition-colors hover:bg-error-border/40 hover:text-error-text"
                        >
                            <LogOut className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">{t('navigation.logout')}</span>
                        </Button>
                        
                        <div className="flex items-center">
                            <img
                                src="/icons/Logo_Bancos.png"
                                alt="Bancos Logo"
                                className="h-16 max-h-16 object-contain opacity-80 hover:opacity-100 transition-opacity"
                            />
                        </div>
                    </div>
                </div>
            </motion.header>

            <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('navigation.logoutConfirm')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('navigation.logoutConfirmDescription')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setShowLogoutDialog(false)}>
                            {t('common.cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={() => {
                                setShowLogoutDialog(false);
                                handleLogout();
                            }}
                            className={ALERT_DESTRUCTIVE}
                        >
                            {t('navigation.logout')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default Header;