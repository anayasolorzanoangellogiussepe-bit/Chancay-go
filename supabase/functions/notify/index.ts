// Edge Function "notify": envía notificaciones push (Expo) según eventos de la base de datos.
// Despliegue:  supabase functions deploy notify --no-verify-jwt
// Secreto:     supabase secrets set WEBHOOK_SECRET=<clave-larga-aleatoria>
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya están disponibles dentro de las funciones.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RADIUS_KM = 6;          // mismo radio que ve el chofer en la app
const FRESH_MIN = 5;          // solo choferes con ubicación de los últimos 5 minutos
const EXPO_URL = 'https://exp.host/--/api/v2/push/send';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

type Msg = { to: string; title: string; body: string; data?: Record<string, unknown> };

function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

async function tokensFor(userIds: string[]): Promise<string[]> {
  if (!userIds.length) return [];
  const { data } = await sb.from('push_tokens').select('token').in('user_id', userIds);
  return (data ?? []).map((r) => r.token as string);
}

async function send(messages: Msg[]) {
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100).map((m) => ({
      ...m, sound: 'default', channelId: 'viajes', priority: 'high',
    }));
    const res = await fetch(EXPO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(chunk),
    });
    const json = await res.json().catch(() => ({ data: [] }));
    // Limpia tokens que ya no existen (app desinstalada)
    const dead: string[] = [];
    (json.data ?? []).forEach((t: { status: string; details?: { error?: string } }, idx: number) => {
      if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered') dead.push(chunk[idx].to);
    });
    if (dead.length) await sb.from('push_tokens').delete().in('token', dead);
  }
}

const toAll = (tokens: string[], title: string, body: string, data?: Record<string, unknown>): Msg[] =>
  tokens.map((to) => ({ to, title, body, data }));

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('unauthorized', { status: 401 });
  }
  const { type, table, record, old_record } = await req.json();
  const out: Msg[] = [];

  if (table === 'trips' && type === 'INSERT' && record.status === 'requested') {
    const since = new Date(Date.now() - FRESH_MIN * 60_000).toISOString();
    const { data: drivers } = await sb.from('drivers').select('id, lat, lng')
      .eq('status', 'approved').eq('is_online', true).gte('location_at', since);
    const near = (drivers ?? []).filter((d) =>
      d.lat != null && d.lng != null && km(d.lat, d.lng, record.origin_lat, record.origin_lng) <= RADIUS_KM);
    const tokens = await tokensFor(near.map((d) => d.id));
    out.push(...toAll(tokens, '🚗 Nuevo viaje cerca',
      `${record.origin_text} → ${record.dest_text} · S/ ${Number(record.fare).toFixed(2)}`, { tripId: record.id }));
  }

  if (table === 'trips' && type === 'UPDATE' && old_record?.status !== record.status) {
    const passenger = await tokensFor([record.passenger_id]);
    const driver = record.driver_id ? await tokensFor([record.driver_id]) : [];
    switch (record.status) {
      case 'accepted': out.push(...toAll(passenger, 'Tu chofer va en camino', 'Revisa los datos del vehículo y la placa.', { tripId: record.id })); break;
      case 'arrived': out.push(...toAll(passenger, 'Tu chofer llegó', 'Verifica la placa antes de subir.', { tripId: record.id })); break;
      case 'in_progress': out.push(...toAll(passenger, 'Viaje iniciado', 'Puedes compartir tu viaje en vivo con un familiar.', { tripId: record.id })); break;
      case 'completed': out.push(...toAll(passenger, 'Viaje finalizado', 'Califica a tu chofer para mantener segura la comunidad.', { tripId: record.id })); break;
      case 'cancelled': out.push(...toAll(driver, 'Viaje cancelado', 'El pasajero canceló el viaje.', { tripId: record.id })); break;
    }
  }

  if (table === 'drivers' && type === 'UPDATE' && old_record?.status !== record.status) {
    const t = await tokensFor([record.id]);
    if (record.status === 'approved') out.push(...toAll(t, '✅ Cuenta aprobada', 'Ya puedes conectarte y recibir viajes.'));
    if (record.status === 'rejected') out.push(...toAll(t, 'Solicitud rechazada', record.rejection_reason ?? 'Revisa tus documentos y vuelve a intentarlo.'));
  }

  if (table === 'sos_alerts' && type === 'INSERT') {
    const { data: admins } = await sb.from('profiles').select('id').eq('role', 'admin');
    const t = await tokensFor((admins ?? []).map((a) => a.id));
    out.push(...toAll(t, '🆘 ALERTA SOS', 'Un usuario activó el botón de emergencia. Revisa el panel.', { sosId: record.id }));
  }

  await send(out);
  return new Response(JSON.stringify({ sent: out.length }), { headers: { 'Content-Type': 'application/json' } });
});
