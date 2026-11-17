-- Usuarios de PRUEBA para ChancayGo. Ejecutar en Supabase > SQL Editor DESPUÉS de schema.sql.
-- Contraseña de los tres: Prueba2026!   (cámbiala o borra estos usuarios antes de operar al público)
--   pasajero@chancaygo.test  -> pasajero
--   chofer@chancaygo.test    -> chofer ya aprobado (listo para recibir viajes)
--   admin@chancaygo.test     -> administrador

do $$
declare
  u record;
begin
  for u in select * from (values
    ('00000000-0000-4000-8000-000000000001'::uuid, 'pasajero@chancaygo.test', 'passenger', 'Pasajero de Prueba', '900000001', '10000001'),
    ('00000000-0000-4000-8000-000000000002'::uuid, 'chofer@chancaygo.test',   'driver',    'Chofer de Prueba',   '900000002', '10000002'),
    ('00000000-0000-4000-8000-000000000003'::uuid, 'admin@chancaygo.test',    'passenger', 'Admin de Prueba',    '900000003', '10000003')
  ) as t(id, email, role, full_name, phone, dni)
  loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      crypt('Prueba2026!', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('role', u.role, 'full_name', u.full_name, 'phone', u.phone, 'dni', u.dni,
                         'emergency_name', 'Contacto de Prueba', 'emergency_phone', '900000099'),
      now(), now(), '', '', '', '')
    on conflict (id) do nothing;

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text,
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      'email', now(), now(), now())
    on conflict do nothing;
  end loop;
end $$;

-- Chofer ya validado
insert into drivers (id, license_no, plate, vehicle_model, vehicle_color, soat_expiry, municipal_permit, status)
values ('00000000-0000-4000-8000-000000000002', 'Q12345678', 'ABC123', 'Toyota Yaris', 'Blanco',
        current_date + interval '1 year', 'MPH-0001', 'approved')
on conflict (id) do nothing;

-- Administrador
update profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000003';
