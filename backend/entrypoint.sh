#!/bin/sh
set -e

export PYTHONPATH=/app

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
