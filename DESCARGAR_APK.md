# Obtener el APK de ChancayGo para instalarlo en un teléfono Android

Hay dos caminos. Ambos necesitan primero el servidor (pasos A de `PRUEBA_RAPIDA.md`: Supabase + `schema.sql` + `seed_demo.sql`).

## Camino 1: GitHub (gratis, sin cuenta de Expo)
1. Crea una cuenta en https://github.com y un repositorio **privado** nuevo (ej. `chancay-go`).
2. Sube el contenido de la carpeta `chancay-go` (arrastrar y soltar en "uploading an existing file"; incluye la carpeta oculta `.github`).
3. En el repositorio: **Settings → Secrets and variables → Actions → New repository secret**. Crea:
   - `SUPABASE_URL` y `SUPABASE_ANON_KEY` (de Supabase > Project Settings > API)
   - `GOOGLE_MAPS_API_KEY` (Google Cloud > Maps SDK for Android; sin ella el mapa sale en gris)
   - `SHARE_BASE_URL` (puede ser cualquier texto por ahora)
4. Pestaña **Actions → Build Android APK → Run workflow**. Tarda ~15 minutos.
5. Al terminar, entra a la ejecución y descarga **ChancayGo-apk** (zip con `app-release.apk`).
6. En el teléfono: copia el APK, ábrelo y permite "instalar apps de orígenes desconocidos".

## Camino 2: Expo (EAS)
```
npm i -g eas-cli
eas login        (cuenta gratis en expo.dev)
eas init
eas build --profile preview --platform android
```
Al terminar te da un enlace/QR para descargar el APK.

## Notas
- Este APK sirve para pruebas (firmado con clave de depuración). Para Google Play se genera un AAB de producción con `eas build --profile production`.
- Las notificaciones push requieren además `google-services.json` (Firebase); sin él la app funciona pero no recibe avisos push.
- iPhone: no hay APK. Se instala con TestFlight, que requiere cuenta de Apple Developer (`eas build --profile production --platform ios` + `eas submit`).
