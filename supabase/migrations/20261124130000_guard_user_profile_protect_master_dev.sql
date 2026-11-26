-- Protege la fila del Master Dev a nivel de trigger: solo él (por correo del JWT) puede modificarla
-- desde una sesión autenticada. auth.uid() IS NULL (SQL Editor / Dashboard) queda libre.
CREATE OR REPLACE FUNCTION private.guard_user_profile_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL
     AND lower(coalesce(OLD.email, '')) = 'enrique.hernandez@bo.vindgroup.com.mx'
     AND lower(coalesce((SELECT auth.jwt() ->> 'email'), '')) <> 'enrique.hernandez@bo.vindgroup.com.mx'
  THEN
    RAISE EXCEPTION 'No tienes permisos para modificar el perfil del Master Dev'
      USING ERRCODE = '42501';
  END IF;

  IF (SELECT auth.uid()) IS NOT NULL
     AND NOT (SELECT private.is_dev())
     AND (
       (to_jsonb(NEW) - ARRAY['full_name', 'email', 'avatar_url', 'updated_at']::text[])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['full_name', 'email', 'avatar_url', 'updated_at']::text[])
     )
  THEN
    RAISE EXCEPTION 'Only active dev users may change protected profile fields'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;
