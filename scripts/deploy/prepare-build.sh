#!/bin/bash

set -e

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
if [ "${name:-}" != "red-cliff-deploy" ] || ! [ "${pm_exec_path:-}" -ef "$REPO_DIR/scripts/deploy/auto-deploy.sh" ]; then
    exit 0
fi

cd "$REPO_DIR"
command -v curl >/dev/null

commit=$(git rev-parse HEAD)
pending_file="$REPO_DIR/.zero-cache/pending-deploy-commit"
pending_commit=$(cat "$pending_file" 2>/dev/null || true)
zero_port=$(NODE_ENV=production bun -e 'process.stdout.write(process.env.ZERO_PORT ?? "4848")')

if [ "$pending_commit" = "$commit" ]; then
    zero_pid=$(pm2 pid red-cliff-zero-cache)
    if [ "$zero_pid" = "0" ] || ! kill -0 "$zero_pid" 2>/dev/null; then
        pending_commit=""
    fi
fi

if [ "$pending_commit" != "$commit" ]; then
    mkdir -p "$REPO_DIR/.zero-cache"
    echo "Restarting Zero sync engine..."
    if ! pm2 restart red-cliff-zero-cache && ! pm2 reload red-cliff-zero-cache; then
        echo "ERROR: Zero restart failed, aborting build" >&2
        exit 1
    fi
    echo "$commit" > "$pending_file"
fi

echo "Waiting for Zero readiness..."
for ((attempt = 0; attempt < 60; attempt++)); do
    if curl --fail --silent --output /dev/null --max-time 2 "http://127.0.0.1:$zero_port/"; then
        rm -f "$pending_file"
        echo "Zero is ready"
        exit 0
    fi
    sleep 1
done

echo "ERROR: Zero readiness check failed, aborting build" >&2
exit 1
