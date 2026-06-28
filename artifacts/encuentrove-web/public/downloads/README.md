# Descarga de la app movil (APK)

**Desde 2026-06-28, el APK ya no se sirve desde esta carpeta** — el boton "Descargar APK" y el QR del Home apuntan directo a una URL de S3 (constante `APK_URL` en `src/components/DescargaApp.tsx`). Esta carpeta y su contenido quedaron sin uso; se deja el `.gitkeep` por si se vuelve a necesitar servir el archivo localmente en el futuro.

## Como actualizar el link cuando haya una nueva version del APK

1. Sube el nuevo `.apk` al bucket S3 (`encuentrove-bucket`).
2. Copia la URL resultante y reemplaza el valor de `APK_URL` en `artifacts/encuentrove-web/src/components/DescargaApp.tsx`.
3. Cuando la app este publicada en Google Play, reemplazar `APK_URL` por el link de la Play Store (y quitar el bloque de "descarga directa mientras se aprueba").
