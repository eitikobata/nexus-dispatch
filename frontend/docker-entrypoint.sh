#!/bin/sh
set -e

# NEXT_PUBLIC_* values were baked in at build time as placeholder tokens
# (see Dockerfile) because this platform doesn't expose Docker build args
# separately from runtime env vars. This script swaps each placeholder for
# the real value — read from the runtime env vars the platform DOES inject
# correctly — inside the compiled output, right before the server starts.
replace_placeholder() {
  placeholder="$1"
  value="$2"
  if [ -n "$value" ]; then
    find .next -type f \( -name "*.js" -o -name "*.html" \) -exec sed -i "s|$placeholder|$value|g" {} +
  fi
}

replace_placeholder "__RUNTIME_NEXT_PUBLIC_API_URL__" "$NEXT_PUBLIC_API_URL"
replace_placeholder "__RUNTIME_NEXT_PUBLIC_WS_URL__" "$NEXT_PUBLIC_WS_URL"
replace_placeholder "__RUNTIME_NEXT_PUBLIC_GRAFANA_URL__" "$NEXT_PUBLIC_GRAFANA_URL"

exec npm run start
