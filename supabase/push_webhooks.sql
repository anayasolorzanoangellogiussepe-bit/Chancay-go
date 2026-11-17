-- Conecta los eventos de la base de datos con la Edge Function "notify".
-- 1) Despliega la función:  supabase functions deploy notify --no-verify-jwt
-- 2) Define el secreto:     supabase secrets set WEBHOOK_SECRET=TU_CLAVE_LARGA
-- 3) Reemplaza TU-PROYECTO y TU_CLAVE_LARGA abajo y ejecuta este archivo en el SQL Editor.

create trigger push_trips_insert after insert on trips
for each row execute function supabase_functions.http_request(
  'https://TU-PROYECTO.supabase.co/functions/v1/notify', 'POST',
  '{"Content-Type":"application/json","x-webhook-secret":"TU_CLAVE_LARGA"}', '{}', '5000');

create trigger push_trips_update after update on trips
for each row execute function supabase_functions.http_request(
  'https://TU-PROYECTO.supabase.co/functions/v1/notify', 'POST',
  '{"Content-Type":"application/json","x-webhook-secret":"TU_CLAVE_LARGA"}', '{}', '5000');

create trigger push_drivers_update after update on drivers
for each row when (old.status is distinct from new.status)
execute function supabase_functions.http_request(
  'https://TU-PROYECTO.supabase.co/functions/v1/notify', 'POST',
  '{"Content-Type":"application/json","x-webhook-secret":"TU_CLAVE_LARGA"}', '{}', '5000');

create trigger push_sos_insert after insert on sos_alerts
for each row execute function supabase_functions.http_request(
  'https://TU-PROYECTO.supabase.co/functions/v1/notify', 'POST',
  '{"Content-Type":"application/json","x-webhook-secret":"TU_CLAVE_LARGA"}', '{}', '5000');
