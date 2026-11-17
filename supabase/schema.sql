-- ChancayGo: esquema de base de datos (Supabase / PostgreSQL)
-- Ejecutar completo en Supabase > SQL Editor.

create extension if not exists pgcrypto;

-- ===== Tipos =====
create type user_role as enum ('passenger', 'driver', 'admin');
create type driver_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type trip_status as enum ('requested', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled');

-- ===== Perfiles (todos los usuarios se identifican) =====
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'passenger',
  full_name text not null,
  phone text not null,
  dni text not null unique check (dni ~ '^[0-9]{8}$' or dni like 'DEL-%'),
  emergency_name text,
  emergency_phone text,
  created_at timestamptz not null default now()
);

-- ===== Tokens de notificaciones push (tabla aparte: la contraparte de un viaje no debe verlos) =====
create table push_tokens (
  user_id uuid primary key references profiles(id) on delete cascade,
  token text not null,
  updated_at timestamptz not null default now()
);
alter table push_tokens enable row level security;
create policy push_own on push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ===== Choferes =====
create table drivers (
  id uuid primary key references profiles(id) on delete cascade,
  license_no text not null,
  plate text not null unique,
  vehicle_model text not null,
  vehicle_color text not null,
  soat_expiry date not null,
  municipal_permit text not null,
  photo_url text,
  license_url text,
  soat_url text,
  status driver_status not null default 'pending',
  rejection_reason text,
  is_online boolean not null default false,
  lat double precision,
  lng double precision,
  location_at timestamptz,
  rating_avg numeric(3,2) not null default 0,
  rating_count int not null default 0,
  created_at timestamptz not null default now()
);

-- ===== Viajes =====
create table trips (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references profiles(id),
  driver_id uuid references drivers(id),
  origin_text text not null,
  origin_lat double precision not null,
  origin_lng double precision not null,
  dest_text text not null,
  dest_lat double precision not null,
  dest_lng double precision not null,
  distance_km numeric(6,2) not null,
  fare numeric(7,2) not null,
  status trip_status not null default 'requested',
  share_token text not null unique default encode(gen_random_bytes(12), 'hex'),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz
);
create index on trips (status, created_at desc);
create index on trips (passenger_id);
create index on trips (driver_id);

-- ===== Calificaciones (mutuas) =====
create table ratings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  from_id uuid not null references profiles(id),
  to_id uuid not null references profiles(id),
  stars int not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (trip_id, from_id)
);

-- ===== Reportes e incidencias =====
create table reports (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id),
  reporter_id uuid not null references profiles(id),
  reported_id uuid references profiles(id),
  reason text not null,
  details text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- ===== Alertas SOS =====
create table sos_alerts (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id),
  user_id uuid not null references profiles(id),
  lat double precision,
  lng double precision,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- ===== Funciones auxiliares =====
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- Crea el perfil automáticamente al registrarse (datos en raw_user_meta_data)
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, role, full_name, phone, dni, emergency_name, emergency_phone)
  values (
    new.id,
    case when new.raw_user_meta_data->>'role' = 'driver' then 'driver'::user_role else 'passenger'::user_role end,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'dni', ''),
    new.raw_user_meta_data->>'emergency_name',
    new.raw_user_meta_data->>'emergency_phone'
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function handle_new_user();

-- Un chofer solo recibe viajes si está aprobado y con SOAT vigente
create or replace function accept_trip(p_trip uuid) returns trips
language plpgsql security definer set search_path = public as $$
declare t trips; d drivers;
begin
  select * into d from drivers where id = auth.uid();
  if d.id is null or d.status <> 'approved' then raise exception 'Chofer no aprobado'; end if;
  if d.soat_expiry < current_date then raise exception 'SOAT vencido'; end if;
  if coalesce(d.municipal_permit, '') = '' then raise exception 'Falta autorización municipal'; end if;
  update trips set driver_id = auth.uid(), status = 'accepted', accepted_at = now()
   where id = p_trip and status = 'requested' returning * into t;
  if t.id is null then raise exception 'El viaje ya fue tomado'; end if;
  return t;
end $$;

-- Calcula promedio al calificar a un chofer
create or replace function update_driver_rating() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update drivers d set
    rating_avg = (select round(avg(stars)::numeric, 2) from ratings where to_id = new.to_id),
    rating_count = (select count(*) from ratings where to_id = new.to_id)
  where d.id = new.to_id;
  return new;
end $$;
create trigger on_rating_insert after insert on ratings
for each row execute function update_driver_rating();

-- Eliminación de cuenta (requisito de Apple/Google): anonimiza datos personales y bloquea el acceso.
-- Se conservan viajes, calificaciones y reportes sin datos identificables, por seguridad.
create or replace function delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  update drivers set is_online = false, status = 'suspended', photo_url = null, license_url = null,
         soat_url = null, license_no = 'ELIMINADO', municipal_permit = 'ELIMINADO', lat = null, lng = null
   where id = auth.uid();
  update profiles set full_name = 'Cuenta eliminada', phone = '', dni = 'DEL-' || id::text,
         emergency_name = null, emergency_phone = null where id = auth.uid();
  update auth.users set email = 'eliminado-' || id::text || '@invalid.local', encrypted_password = '',
         banned_until = 'infinity', raw_user_meta_data = '{}'::jsonb where id = auth.uid();
end $$;
revoke all on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;

-- Seguimiento público (para el enlace "Compartir viaje"): solo datos mínimos
create or replace function get_shared_trip(p_token text)
returns table (status trip_status, origin_text text, dest_text text, driver_name text,
               plate text, vehicle text, lat double precision, lng double precision, updated timestamptz)
language sql security definer set search_path = public as $$
  select t.status, t.origin_text, t.dest_text, p.full_name, d.plate,
         d.vehicle_model || ' ' || d.vehicle_color, d.lat, d.lng, d.location_at
  from trips t
  left join drivers d on d.id = t.driver_id
  left join profiles p on p.id = t.driver_id
  where t.share_token = p_token and t.status in ('accepted','arrived','in_progress','completed');
$$;
grant execute on function get_shared_trip(text) to anon, authenticated;

-- ===== Seguridad por filas (RLS) =====
alter table profiles enable row level security;
alter table drivers enable row level security;
alter table trips enable row level security;
alter table ratings enable row level security;
alter table reports enable row level security;
alter table sos_alerts enable row level security;

-- profiles: cada uno ve el suyo; el contraparte de un viaje ve nombre/teléfono; admin ve todo
create policy profiles_self on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_counterpart on profiles for select using (
  exists (select 1 from trips t where t.status in ('accepted','arrived','in_progress','completed')
          and ((t.passenger_id = auth.uid() and t.driver_id = profiles.id)
            or (t.driver_id = auth.uid() and t.passenger_id = profiles.id))));
create policy profiles_update_self on profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));

-- drivers
create policy drivers_self on drivers for select using (id = auth.uid() or is_admin());
create policy drivers_for_passenger on drivers for select using (
  exists (select 1 from trips t where t.driver_id = drivers.id and t.passenger_id = auth.uid()));
create policy drivers_insert_self on drivers for insert with check (id = auth.uid() and status = 'pending');
create policy drivers_update_self on drivers for update using (id = auth.uid())
  with check (id = auth.uid() and status = (select status from drivers where id = auth.uid()));
create policy drivers_admin_update on drivers for update using (is_admin());

-- trips
create policy trips_passenger on trips for select using (passenger_id = auth.uid());
create policy trips_driver on trips for select using (driver_id = auth.uid());
create policy trips_open_for_drivers on trips for select using (
  status = 'requested' and exists (select 1 from drivers where id = auth.uid() and status = 'approved' and is_online));
create policy trips_admin on trips for select using (is_admin());
create policy trips_create on trips for insert with check (passenger_id = auth.uid() and status = 'requested');
create policy trips_update_parts on trips for update using (passenger_id = auth.uid() or driver_id = auth.uid());

-- ratings / reports / sos
create policy ratings_read on ratings for select using (from_id = auth.uid() or to_id = auth.uid() or is_admin());
create policy ratings_insert on ratings for insert with check (
  from_id = auth.uid() and exists (select 1 from trips t where t.id = trip_id and t.status = 'completed'
   and (t.passenger_id = auth.uid() or t.driver_id = auth.uid())));
create policy reports_insert on reports for insert with check (reporter_id = auth.uid());
create policy reports_read on reports for select using (reporter_id = auth.uid() or is_admin());
create policy reports_admin_update on reports for update using (is_admin());
create policy sos_insert on sos_alerts for insert with check (user_id = auth.uid());
create policy sos_read on sos_alerts for select using (user_id = auth.uid() or is_admin());
create policy sos_admin_update on sos_alerts for update using (is_admin());

-- Realtime
alter publication supabase_realtime add table trips, drivers, sos_alerts;

-- ===== Storage: documentos de choferes (bucket privado) =====
insert into storage.buckets (id, name, public) values ('driver-docs', 'driver-docs', false)
on conflict do nothing;
create policy docs_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'driver-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy docs_read on storage.objects for select to authenticated
  using (bucket_id = 'driver-docs' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));

-- Para crear un administrador, tras registrarse esa persona:
-- update profiles set role = 'admin' where dni = 'TU_DNI';
