#!/bin/sh
# Generate runtime env config (allows changing env vars without rebuilding the image).
cat <<EOF > /usr/share/nginx/html/env-config.js
window.__ENV__ = {
  VITE_API_BASE_URL: "${VITE_API_BASE_URL:-}",
  VITE_S3_BASE_URL: "${VITE_S3_BASE_URL:-}"
};
EOF

# Inject the backend URL into the nginx proxy_pass directive.
# Default to the Java backend if BACKEND_URL is not set.
BACKEND_URL="${BACKEND_URL:-https://heart.encuentrove.online}"
sed -i "s|BACKEND_PLACEHOLDER|${BACKEND_URL}|g" /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"
