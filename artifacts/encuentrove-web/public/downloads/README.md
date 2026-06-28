# Descarga de la app movil (APK)

Esta carpeta sirve el instalador de Android mientras la app no esta publicada en las tiendas oficiales (Google Play / App Store). La seccion "Lleva EncuentroVE en tu telefono" del Home y su QR apuntan a `/downloads/app-release.apk`.

- Nombre de archivo fijo: `app-release.apk` (sin importar el numero de version real del build — no se debe cambiar, o el link y el QR del Home dejan de funcionar).
- No se commitea a git (ver `.gitignore` en la raiz del repo) por su tamano — cada entorno (local, servidor) lo coloca por separado.

## Como reemplazarlo por una nueva version

1. Renombra el nuevo APK a `app-release.apk`.
2. Copialo a esta carpeta, sobrescribiendo el anterior: `artifacts/encuentrove-web/public/downloads/app-release.apk`.
3. **Importante:** Vite copia el contenido de `public/` tal cual dentro de `dist/public/` al hacer build. Si se despliega con Docker, el reemplazo solo toma efecto despues de volver a correr `pnpm --filter @workspace/encuentrove-web run build` y reconstruir/redeployar la imagen — sobrescribir el archivo en un contenedor que ya esta corriendo no alcanza.
