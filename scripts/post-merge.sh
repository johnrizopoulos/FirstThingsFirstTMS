#!/bin/bash
# Runs after a project task is merged into main.
# Must be idempotent and non-interactive (stdin is closed).
set -e

echo "[post-merge] installing dependencies..."
npm install --no-audit --no-fund --prefer-offline

if [ -n "$DATABASE_URL" ]; then
  echo "[post-merge] syncing Drizzle schema to database..."
  npx --yes drizzle-kit push --force
else
  echo "[post-merge] DATABASE_URL not set, skipping drizzle push"
fi

echo "[post-merge] done"
