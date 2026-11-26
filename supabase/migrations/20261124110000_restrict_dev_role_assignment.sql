-- Solo enrique.hernandez@bo.vindgroup.com.mx puede asignar el rol 'dev' vía update_user_role.
CREATE OR REPLACE FUNCTION public.update_user_role(target_user_id uuid, new_role text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT (SELECT private.is_dev()) THEN
    RAISE EXCEPTION 'Access denied: only active dev users can update roles'
      USING ERRCODE = '42501';
  END IF;

  IF new_role IS NULL
     OR new_role NOT IN ('dev', 'admin', 'technician', 'client')
  THEN
    RAISE EXCEPTION 'Invalid role: %', new_role
      USING ERRCODE = '22023';
  END IF;

  IF new_role = 'dev'
     AND lower(coalesce((SELECT auth.jwt() ->> 'email'), '')) <> 'enrique.hernandez@bo.vindgroup.com.mx'
  THEN
    RAISE EXCEPTION 'Solo enrique.hernandez@bo.vindgroup.com.mx puede asignar el rol dev'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.user_profiles
  SET role = new_role::public.access_role_enum,
      updated_at = pg_catalog.now()
  WHERE id = target_user_id;

  RETURN FOUND;
END;
$function$;
