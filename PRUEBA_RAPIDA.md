# Probar ChancayGo en tu teléfono (≈20 minutos)

## A. Servidor (una sola vez)
1. Crea una cuenta gratis en https://supabase.com → **New project**.
2. **SQL Editor** → pega y ejecuta `supabase/schema.sql`, luego `supabase/seed_demo.sql`.
3. **Authentication → Providers → Email**: desactiva "Confirm email".
4. **Project Settings → API**: copia *Project URL* y *anon public key*.

## B. App en tu computadora
Necesitas Node.js 20+.
```
cd chancay-go
npm install --legacy-peer-deps
copy .env.example .env      (en Mac/Linux: cp .env.example .env)
```
Edita `.env` con tu URL y anon key. Luego:
```
npx expo start
```

## C. En el teléfono
Instala **Expo Go** (Play Store / App Store), escanea el QR (teléfono y PC en la misma Wi-Fi).

## Usuarios de prueba (contraseña `Prueba2026!`)
| Rol | Correo |
|---|---|
| Pasajero | pasajero@chancaygo.test |
| Chofer aprobado | chofer@chancaygo.test |
| Administrador | admin@chancaygo.test |

Para probar un viaje completo usa **dos teléfonos** (o un teléfono y el emulador): uno como pasajero y otro como chofer.

## Qué funciona en Expo Go y qué no
- Sí: registro, login, mapa, pedir y aceptar viajes, calificar, compartir viaje, SOS, panel admin.
- No: notificaciones push y ubicación en segundo plano (requieren *development build*: `eas build --profile development`). En Expo Go el mapa en Android puede verse sin el estilo de Google; es normal.
