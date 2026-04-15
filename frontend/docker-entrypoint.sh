#!/bin/sh
set -e

# Generate runtime env.js from environment variables
# This allows the frontend to read API URLs after container start
API_URL="${VITE_API_URL:-http://localhost:8000}"
WS_URL="${VITE_WS_URL:-ws://localhost:8000}"

cat > /usr/share/nginx/html/env.js << EOF
window.__MIROFISH_ENV__ = {
  VITE_API_URL: "${API_URL}",
  VITE_WS_URL: "${WS_URL}"
};
EOF

echo "[entrypoint] env.js generated: API_URL=${API_URL}, WS_URL=${WS_URL}"

exec "$@"
