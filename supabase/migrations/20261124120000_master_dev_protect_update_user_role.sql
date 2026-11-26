-- Master Dev (enrique.hernandez@bo.vindgroup.com.mx):
--  * solo él puede asignar 'dev'
--  * su fila solo la puede cambiar él mismo
--  * puede operar aunque se haya cambiado temporalmente a otro rol
CREATE OR REPLACE FUNCTION public.update_user_role(target_user_id uuid, new_role text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  master_email constant text := 'enrique.hernandez@bo.vindgroup.com.mx';
  caller_email text := lower(coalesce((SELECT auth.jwt() ->> 'email'), ''));
  caller_is_master boolean := (lower(coalesce((SELECT auth.jwt() ->> 'email'), '')) = 'enrique.hernandez@bo.vindgroup.com.mx');
  target_email text;
BEGIN
  -- El Master Dev puede operar aunque se haya cambiado temporalmente a otro rol
  IF NOT caller_is_master AND NOT (SELECT private.is_dev()) THEN
    RAISE EXCEPTION 'Access denied: only active dev users can update roles'
      USING ERRCODE = '42501';
  END IF;

  IF new_role IS NULL
     OR new_role NOT IN ('dev', 'admin', 'technician', 'client')
  THEN
    RAISE EXCEPTION 'Invalid role: %', new_role
      USING ERRCODE = '22023';
  END IF;

  -- Solo el Master Dev puede asignar 'dev'
  IF new_role = 'dev' AND NOT caller_is_master THEN
    RAISE EXCEPTION 'Solo % puede asignar el rol dev', master_email
      USING ERRCODE = '42501';
  END IF;

  -- La fila del Master Dev solo la puede modificar él mismo
  SELECT lower(email) INTO target_email
  FROM public.user_profiles
  WHERE id = target_user_id;

  IF target_email = master_email AND NOT caller_is_master THEN
    RAISE EXCEPTION 'El rol de % esta protegido', master_email
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.user_profiles
  SET role = new_role::public.access_role_enum,
      updated_at = pg_catalog.now()
  WHERE id = target_user_id;

  RETURN FOUND;
END;
$function$;
