# ChancayGo — App de transporte seguro para Chancay

App móvil nativa (Android/iOS) hecha con **Expo + React Native + TypeScript** y **Supabase** (base de datos, login, tiempo real y almacenamiento).

## Qué incluye
- **Pasajeros**: registro con DNI, celular y contacto de emergencia obligatorio; pedir viaje eligiendo destino en el mapa; tarifa estimada; seguimiento del chofer en vivo.
- **Choferes**: registro con licencia, placa, SOAT y 3 fotos (rostro, licencia, SOAT); quedan "en revisión" hasta que un administrador los apruebe; conectarse, recibir solicitudes cercanas (6 km), aceptar y avanzar el viaje.
- **Administrador**: aprobar/rechazar choferes viendo sus documentos, atender alertas SOS y reportes.
- **Seguridad**: botón SOS (alerta a la central + llamada a la Policía + SMS al contacto), compartir viaje en vivo (enlace web sin datos sensibles), calificación mutua, reportes, identificación obligatoria de todos los usuarios, SOAT vigente exigido para aceptar viajes, documentos en almacenamiento privado, seguridad por filas (RLS).

## Puesta en marcha
1. Crea un proyecto en https://supabase.com y ejecuta `supabase/schema.sql` en el SQL Editor.
2. En Supabase > Authentication desactiva "Confirm email" mientras pruebas.
3. Copia `.env.example` a `.env` y completa URL y anon key.
4. Obtén una API key de Google Maps (Maps SDK Android/iOS) y colócala en `app.json`.
5. `npm install` y luego `npx expo start` (prueba con Expo Go para ubicación y cámara; los mapas de Google requieren un *development build*: `npx expo run:android`).
6. Crea tu usuario administrador: regístrate como pasajero y ejecuta en SQL `update profiles set role='admin' where dni='TU_DNI';`.
7. Sube `web/seguir.html` (con tus datos de Supabase) a cualquier hosting estático y pon su URL en `EXPO_PUBLIC_SHARE_BASE_URL`.

## Publicar en Google Play y App Store
1. `npm i -g eas-cli`, luego `eas login` y `eas build:configure`.
2. Prueba en dispositivos: `eas build --profile preview --platform android` (APK) y `eas build --profile development --platform ios`.
3. Producción: `eas build --profile production --platform all` y `eas submit`.
4. Completa en `lib/legal.ts` y `web/privacidad.html` los datos [RAZÓN SOCIAL], [RUC], [CORREO]; sube `privacidad.html` a un hosting y usa esa URL como política de privacidad en ambas tiendas. Es un borrador: debe revisarlo un abogado.
5. La app ya incluye eliminación de cuenta (`delete_my_account` en el esquema) y aceptación de términos al registrarse, que piden ambas tiendas. Crea una cuenta de demostración para los revisores de Apple.
6. El registro de choferes exige su N.º de autorización municipal.

## Notificaciones push
Avisan a los choferes cercanos de un viaje nuevo (aunque la app esté cerrada), al pasajero de cada cambio de su viaje, al chofer de su aprobación y a los administradores de cada SOS.
1. Ejecuta `eas init` (crea el `projectId` que necesita la app) y haz un *development build*; las notificaciones no funcionan en simuladores ni en Expo Go para Android.
2. Android: crea un proyecto en Firebase, descarga `google-services.json`, súbelo con `eas credentials` y colócalo en `app.json` (`android.googleServicesFile`). iPhone: EAS crea la clave APNs al compilar con tu cuenta de Apple Developer.
3. Servidor: `supabase functions deploy notify --no-verify-jwt`, `supabase secrets set WEBHOOK_SECRET=...` y ejecuta `supabase/push_webhooks.sql` con tus datos.


## Ubicación en segundo plano (chofer)
Mientras el chofer está "En línea", la app comparte su posición con la pantalla bloqueada (servicio en primer plano con notificación fija en Android; indicador azul en iPhone). Antes de pedir el permiso muestra un aviso explicativo, como exige Google Play.
- Requiere *development build* (no funciona en Expo Go).
- **Google Play:** en la consola, completa la "Declaración de permisos" de ubicación en segundo plano y sube un video corto que muestre el aviso y la función. Justificación sugerida: "Los pasajeros ven en vivo la llegada del chofer; el chofer comparte su ubicación solo mientras está En línea".
- **App Store:** en la descripción de revisión explica el uso de ubicación en segundo plano; el texto de permisos ya está en `app.json`.
- Si el chofer rechaza el permiso, la app sigue funcionando pero solo comparte su posición con la app abierta.

## Logo
Carpeta `assets/`: `icon.svg`, `adaptive.svg`, `logo-horizontal.svg` y los PNG de ícono/splash. Diseño original.

## Tarifa
Se configura en `lib/geo.ts` (`FARE`: base S/ 3, S/ 1.20 por km, mínimo S/ 4). Pago en efectivo en esta versión.

## Pendiente antes de operar al público (importante)
- **Permisos y marco legal**: el transporte de pasajeros en Chancay requiere cumplir normas de la municipalidad/ATU/MTC según el tipo de vehículo (mototaxi, taxi). Conviene consultar y definir condiciones con la municipalidad.
- **Verificación más fuerte**: hoy el administrador revisa fotos manualmente. Recomendado añadir validación de antecedentes y consulta oficial del SOAT/licencia.
- **Notificaciones push** (Expo Notifications + Edge Function) para avisar a choferes sin tener la app abierta, y ubicación en segundo plano para el chofer.
- **Autocompletado de direcciones** (Google Places) y rutas reales; hoy el destino se elige tocando el mapa y la distancia es aproximada.
- Política de privacidad y términos (Ley 29733 de Protección de Datos Personales), pues se tratan DNI, ubicación y documentos.
- Pagos digitales (Yape/Plin), si se desea.
- Pruebas en dispositivos reales: el código compila, pero aún no se ha probado en un teléfono.
