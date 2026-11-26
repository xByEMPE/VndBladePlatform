-- Permite a authenticated actualizar estas columnas de user_profiles.
-- El trigger user_profiles_guard_update sigue bloqueando is_active y allowed_modules a quien no sea dev.
GRANT UPDATE (updated_at, is_active, allowed_modules) ON public.user_profiles TO authenticated;
