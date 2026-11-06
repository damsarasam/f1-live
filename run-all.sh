#!/bin/sh
# Start the three AeroLabs AI apps locally. Ctrl+C stops all of them.
cd "$(dirname "$0")"
trap 'kill 0' INT TERM EXIT
(cd vectra && ../venv/bin/uvicorn backend.main:app --port 8001) &
(cd web && python3 serve.py 8000) &
(cd astraeus && python3 serve.py 8002) &
echo "AeroLabs AI  http://localhost:8000"
echo "VECTRA       http://localhost:8001"
echo "ASTRAEUS     http://localhost:8002"
wait
