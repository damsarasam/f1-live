"""F1 Data Hub API and static frontend.

Run: uvicorn backend.main:app --port 8000
"""
from datetime import date
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import historical, live, openf1, strategy

FRONTEND = Path(__file__).resolve().parent.parent / "frontend"
# "sessions", "live" and "strategy" are the pre-/f1 paths; the router redirects them
PAGES = ("", "f1", "sessions", "live", "strategy")

app = FastAPI(title="F1 Data Hub", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(GZipMiddleware, minimum_size=1024)


@app.middleware("http")
async def revalidate_assets(request, call_next):
    # Unversioned ES modules: make browsers revalidate (cheap 304) so deploys reach visitors
    response = await call_next(request)
    if request.url.path.startswith("/assets/") and "cache-control" not in response.headers:
        response.headers["Cache-Control"] = "no-cache"
    return response


def _cached(payload, seconds):
    return JSONResponse(payload, headers={"Cache-Control": f"public, max-age={seconds}"})


def _past(year):
    return year < date.today().year


@app.exception_handler(historical.NoLapData)
def _no_lap_data(_, exc):
    return JSONResponse({"error": "no_lap_data", "detail": str(exc)}, status_code=404)


@app.exception_handler(openf1.RateLimited)
def _rate_limited(_, exc):
    return JSONResponse({"error": "busy", "detail": "The data provider is busy. Try again in a minute."},
                        status_code=503, headers={"Retry-After": "30"})


@app.exception_handler(PermissionError)
def _restricted(_, exc):
    return JSONResponse({"error": "restricted", "detail": str(exc)}, status_code=503)


def _check(year, code=None, ahead=0):
    # Schedules and strategy look one season ahead; sessions only exist up to now
    if not 2018 <= year <= date.today().year + ahead:
        raise HTTPException(404, "Season out of range")
    if code is not None and code not in historical.SESSION_CODES:
        raise HTTPException(404, "Unknown session")


@app.get("/api/schedule/{year}")
def schedule(year: int):
    _check(year, ahead=1)
    try:
        events = historical.schedule(year)
    except Exception:
        raise HTTPException(404, "Schedule not published yet")
    if not events:
        raise HTTPException(404, "Schedule not published yet")
    return _cached({"year": year, "events": events}, 86400 if _past(year) else 3600)


@app.get("/api/sessions/{year}/{round_number}/{code}")
def session_results(year: int, round_number: int, code: str):
    _check(year, code)
    return _cached(historical.results(year, round_number, code), 86400)


@app.get("/api/sessions/{year}/{round_number}/{code}/fastest-lap")
def fastest_lap(year: int, round_number: int, code: str):
    _check(year, code)
    return _cached(historical.fastest_lap(year, round_number, code), 86400)


@app.get("/api/sessions/{year}/{round_number}/{code}/stints")
def stints(year: int, round_number: int, code: str):
    _check(year, code)
    return _cached(historical.stints(year, round_number, code), 86400)


@app.get("/api/sessions/{year}/{round_number}/{code}/compare")
def compare(year: int, round_number: int, code: str, drivers: str = Query(..., description="Comma-separated driver numbers")):
    _check(year, code)
    numbers = [int(n) for n in drivers.split(",") if n.strip().isdigit()][:2]
    if len(numbers) != 2:
        raise HTTPException(422, "Pass exactly two driver numbers")
    return _cached(historical.compare(year, round_number, code, numbers), 86400)


@app.get("/api/live")
def live_board():
    data = live.board()
    return _cached(data, data.get("refresh") or 300)


@app.get("/api/strategy/{year}/{round_number}")
def strategy_history(year: int, round_number: int):
    _check(year, ahead=1)
    return _cached(strategy.predictions(year, round_number), 86400)


app.mount("/assets", StaticFiles(directory=FRONTEND / "assets"), name="assets")


@app.get("/{page:path}", include_in_schema=False)
def spa(page: str):
    # Client-side routes all serve the same shell
    if page.split("/")[0] in PAGES:
        return FileResponse(FRONTEND / "index.html")
    raise HTTPException(404)
