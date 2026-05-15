#!/bin/sh
set -e

export PYTHONPATH=/app
export DEEPFACE_HOME="${DEEPFACE_HOME:-/var/data/deepface}"

seed_dir="/opt/deepface_seed/weights"
weights_dir="$DEEPFACE_HOME/.deepface/weights"

if [ -d "$seed_dir" ]; then
  mkdir -p "$weights_dir"
  for weight_file in "$seed_dir"/*; do
    [ -f "$weight_file" ] || continue
    target_file="$weights_dir/$(basename "$weight_file")"
    if [ ! -f "$target_file" ]; then
      echo "Seeding DeepFace weight $(basename "$weight_file")..."
      cp "$weight_file" "$target_file"
    fi
  done
fi

echo "Waiting for database..."
until python /app/wait_for_db.py >/dev/null 2>&1; do
  sleep 2
done

echo "Running migrations..."
alembic upgrade head

echo "Seeding roles..."
python -m app.db.seed

echo "Starting API..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
