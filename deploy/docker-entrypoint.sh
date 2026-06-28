#!/bin/sh
set -e

# 1. Config runtime del frontend (permite cambiar estas variables desde
#    EasyPanel sin tener que reconstruir la imagen).
cat <<EOF > /usr/share/nginx/html/env-config.js
window.__ENV__ = {
  VITE_API_BASE_URL: "${VITE_API_BASE_URL:-}",
  VITE_S3_BASE_URL: "${VITE_S3_BASE_URL:-https://encuentrove-bucket.s3.us-east-1.amazonaws.com}"
};
EOF

# 2. Arrancar el api-server (Express) en segundo plano, puerto interno fijo
#    (no expuesto fuera del contenedor). JAVA_BACKEND_URL (default
#    https://heart.encuentrove.online) controla a donde reenvia /api/v1/*;
#    configurable desde las variables de entorno de EasyPanel.
PORT=8080 node --enable-source-maps /app/api-server/dist/index.mjs &

# 3. Arrancar nginx en primer plano — proceso principal del contenedor.
exec nginx -g "daemon off;"
