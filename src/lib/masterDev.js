// Master Dev: único usuario que puede asignar el rol 'dev' y cuya fila está protegida.
// Debe coincidir con la constante de la función SQL public.update_user_role.
export const MASTER_DEV_EMAIL = 'enrique.hernandez@bo.vindgroup.com.mx';

export const isMasterDevEmail = (email) =>
  (email || '').trim().toLowerCase() === MASTER_DEV_EMAIL;
