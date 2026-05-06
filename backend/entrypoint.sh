#!/bin/sh
set -e

echo "Waiting for database..."
until python /app/wait_for_db.py >/dev/null 2>&1; do
  sleep 2
done

echo "Running migrations..."
alembic upgrade head

echo "Seeding roles..."
python app/db/seed.py

echo "Starting API..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
