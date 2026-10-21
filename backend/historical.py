"""Past sessions: FastF1 for schedule and results, laps/telemetry from wherever still serves them.

Since Oct 2026 the F1 livetiming archive needs an F1 TV login. FastF1's mirror still
holds 2022 and earlier, so those seasons load fully through FastF1. From 2023 on,
FastF1 only loads results and lap data comes from OpenF1.
"""
import threading
from functools import lru_cache
from pathlib import Path

import fastf1
import numpy as np
import pandas as pd

from . import openf1

OPENF1_FIRST_YEAR = 2023
SESSION_CODES = ["FP1", "FP2", "FP3", "SQ", "S", "Q", "R"]
CACHE_DIR = Path(__file__).resolve().parent.parent / "cache" / "fastf1"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
fastf1.Cache.enable_cache(str(CACHE_DIR))

# FastF1 loads are slow and share an on-disk cache, so run one at a time
_load_lock = threading.Lock()
_sessions = {}
_MAX_SESSIONS = 12


class NoLapData(Exception):
    """Raised when no source has lap data for the session."""


def lap_source(year):
    return "openf1" if year >= OPENF1_FIRST_YEAR else "fastf1"


def fmt_time(seconds):
    if seconds is None or pd.isna(seconds):
        return None
    hours, rest = divmod(float(seconds), 3600)
    minutes, secs = divmod(rest, 60)
    if hours:
        return f"{int(hours)}:{int(minutes):02d}:{secs:06.3f}"
    return f"{int(minutes)}:{secs:06.3f}"


def _seconds(td):
    return None if td is None or pd.isna(td) else td.total_seconds()


def _clean(value):
    if value is None:
        return None
    if isinstance(value, float) and np.isnan(value):
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return None if np.isnan(value) else float(value)
    return value


# ---------- schedule ----------

@lru_cache(maxsize=16)
def schedule(year):
    events = fastf1.get_event_schedule(year, include_testing=False)
    out = []
    for _, ev in events.iterrows():
        sessions = []
        for i in range(1, 6):
            name = ev.get(f"Session{i}")
            date = ev.get(f"Session{i}DateUtc")
            if not name or pd.isna(date):
                continue
            code = _code_for(name)
            if code:
                sessions.append({"code": code, "name": name, "date": pd.Timestamp(date).isoformat() + "Z"})
        out.append({
            "round": int(ev["RoundNumber"]),
            "name": ev["EventName"],
            "country": ev["Country"],
            "location": ev["Location"],
            "date": pd.Timestamp(ev["EventDate"]).date().isoformat(),
            "sessions": sessions,
        })
    return out


def _code_for(name):
    return {
        "Practice 1": "FP1", "Practice 2": "FP2", "Practice 3": "FP3",
        "Sprint Qualifying": "SQ", "Sprint Shootout": "SQ", "Sprint": "S",
        "Qualifying": "Q", "Race": "R",
    }.get(name)


# ---------- sessions ----------

def _session(year, round_number, code):
    key = (year, round_number, code)
    if key in _sessions:
        return _sessions[key]
    with _load_lock:
        if key in _sessions:
            return _sessions[key]
        session = fastf1.get_session(year, round_number, code)
        full = lap_source(year) == "fastf1"
        session.load(laps=full, telemetry=full, weather=False, messages=False)
        if len(_sessions) >= _MAX_SESSIONS:
            _sessions.pop(next(iter(_sessions)))
        _sessions[key] = session
        return session


@lru_cache(maxsize=64)
def _openf1_key(session_start_iso):
    start = pd.Timestamp(session_start_iso).tz_localize(None)
    day = start.normalize()
    rows = openf1.get("sessions", f"year={start.year}&date_start>={day:%Y-%m-%d}&date_start<{day + pd.Timedelta(days=1):%Y-%m-%d}",
                      persist=True)
    if not rows:
        return None
    best = min(rows, key=lambda r: abs(pd.Timestamp(r["date_start"]).tz_localize(None) - start))
    return int(best["session_key"])


def _context(year, round_number, code):
    session = _session(year, round_number, code)
    key = _openf1_key(session.date.isoformat()) if lap_source(year) == "openf1" else None
    return session, key


def _colours(session, key):
    """Team colour per driver number; FastF1's results-only load often leaves it blank."""
    colours = {}
    for _, r in session.results.iterrows():
        if r.get("TeamColor") and not pd.isna(r.get("TeamColor")):
            colours[int(r["DriverNumber"])] = r["TeamColor"]
    if key and len(colours) < len(session.results):
        for d in openf1.get("drivers", f"session_key={key}", persist=True):
            if d.get("team_colour"):
                colours.setdefault(int(d["driver_number"]), d["team_colour"])
    return colours


def results(year, round_number, code):
    session, key = _context(year, round_number, code)
    colours = _colours(session, key)
    rows = []
    for _, r in session.results.iterrows():
        number = int(r["DriverNumber"])
        pos = r.get("Position")
        rows.append({
            "position": None if pd.isna(pos) else int(pos),
            "classified": _clean(r.get("ClassifiedPosition")),
            "number": number,
            "code": r["Abbreviation"],
            "first": r["FirstName"],
            "last": r["LastName"],
            "team": r["TeamName"],
            "colour": colours.get(number),
            "grid": None if pd.isna(r.get("GridPosition")) else int(r["GridPosition"]),
            "time": fmt_time(_seconds(r.get("Time"))),
            "status": _clean(r.get("Status")),
            "points": _clean(r.get("Points")),
            "laps": None if pd.isna(r.get("Laps")) else int(r["Laps"]),
            "q": [fmt_time(_seconds(r.get(q))) for q in ("Q1", "Q2", "Q3")],
        })
    rows.sort(key=lambda r: (r["position"] is None, r["position"] or 99))
    return {
        "event": session.event["EventName"],
        "session": session.name,
        "code": code,
        "date": session.date.isoformat() + "Z",
        "location": session.event["Location"],
        "country": session.event["Country"],
        "round": int(session.event["RoundNumber"]),
        "year": year,
        "lap_source": "openf1" if key else ("fastf1" if lap_source(year) == "fastf1" else None),
        "results": rows,
    }


# ---------- laps ----------

def _openf1_laps(key):
    rows = openf1.get("laps", f"session_key={key}", persist=True)
    df = pd.DataFrame(rows)
    if df.empty:
        return df
    df = df.dropna(subset=["lap_duration", "date_start"])
    df["date_start"] = pd.to_datetime(df["date_start"], utc=True, format="ISO8601")
    return df


def _window(start, seconds):
    end = start + pd.Timedelta(seconds=seconds)
    fmt = "%Y-%m-%dT%H:%M:%S.%f"
    return f"date>{start.strftime(fmt)}&date<{end.strftime(fmt)}"


def _openf1_trace(key, number, start, duration):
    query = f"session_key={key}&driver_number={number}&{_window(start, duration)}"
    car = pd.DataFrame(openf1.get("car_data", query, persist=True))
    loc = pd.DataFrame(openf1.get("location", query, persist=True))
    if car.empty:
        raise NoLapData("OpenF1 has no car data for this lap")
    car["date"] = pd.to_datetime(car["date"], utc=True, format="ISO8601")
    car = car.sort_values("date")
    t = (car["date"] - car["date"].iloc[0]).dt.total_seconds()
    trace = pd.DataFrame({"date": car["date"], "t": t, "speed": car["speed"].astype(float)})
    trace["distance"] = (trace["speed"] / 3.6 * trace["t"].diff().fillna(0)).cumsum()
    if not loc.empty:
        loc["date"] = pd.to_datetime(loc["date"], utc=True, format="ISO8601")
        loc = loc.sort_values("date")[["date", "x", "y"]]
        trace = pd.merge_asof(trace, loc, on="date", direction="nearest")
    return trace


def _fastf1_trace(lap):
    tel = lap.get_telemetry()
    return pd.DataFrame({
        "t": tel["Time"].dt.total_seconds(),
        "speed": tel["Speed"].astype(float),
        "distance": tel["Distance"].astype(float),
        "x": tel["X"].astype(float),
        "y": tel["Y"].astype(float),
    })


def _downsample(df, n=700):
    if len(df) <= n:
        return df
    idx = np.linspace(0, len(df) - 1, n).round().astype(int)
    return df.iloc[idx]


def _fastest(year, round_number, code, number=None):
    """(driver number, lap seconds, lap number, trace) for the fastest lap overall or of one driver."""
    session, key = _context(year, round_number, code)
    if key:
        laps = _openf1_laps(key)
        if number is not None and not laps.empty:
            laps = laps[laps["driver_number"] == int(number)]
        if laps.empty:
            raise NoLapData("No timed laps")
        lap = laps.loc[laps["lap_duration"].idxmin()]
        trace = _openf1_trace(key, int(lap["driver_number"]), lap["date_start"], float(lap["lap_duration"]))
        return int(lap["driver_number"]), float(lap["lap_duration"]), int(lap["lap_number"]), trace
    if lap_source(year) != "fastf1":
        raise NoLapData("No lap data source for this session")
    try:
        laps = session.laps
    except Exception as exc:
        raise NoLapData("FastF1 has no lap data for this session") from exc
    if number is not None:
        laps = laps.pick_drivers(str(number))
    lap = laps.pick_fastest()
    if lap is None or pd.isna(lap["LapTime"]):
        raise NoLapData("No timed laps")
    return int(lap["DriverNumber"]), lap["LapTime"].total_seconds(), int(lap["LapNumber"]), _fastf1_trace(lap)


def _driver_meta(session, key, number):
    row = session.results[session.results["DriverNumber"].astype(int) == int(number)]
    colours = _colours(session, key)
    if row.empty:
        return {"number": number, "code": str(number), "name": str(number), "team": None, "colour": colours.get(number)}
    r = row.iloc[0]
    return {"number": number, "code": r["Abbreviation"], "name": r["FullName"], "team": r["TeamName"], "colour": colours.get(number)}


def fastest_lap(year, round_number, code):
    session, key = _context(year, round_number, code)
    number, seconds, lap_number, trace = _fastest(year, round_number, code)
    trace = trace.dropna(subset=["x", "y"]) if "x" in trace else trace
    if trace.empty or "x" not in trace:
        raise NoLapData("No position data for the fastest lap")
    trace = _downsample(trace)
    return {
        "driver": _driver_meta(session, key, number),
        "lap_time": fmt_time(seconds),
        "lap_seconds": seconds,
        "lap_number": lap_number,
        "top_speed": round(float(trace["speed"].max())),
        "points": [[round(float(x)), round(float(y)), round(float(s)), round(float(t), 3)]
                   for x, y, s, t in zip(trace["x"], trace["y"], trace["speed"], trace["t"])],
    }


def compare(year, round_number, code, numbers):
    session, key = _context(year, round_number, code)
    out = []
    for number in numbers:
        try:
            _, seconds, lap_number, trace = _fastest(year, round_number, code, number)
        except NoLapData:
            out.append({**_driver_meta(session, key, number), "lap_time": None, "distance": [], "speed": []})
            continue
        trace = _downsample(trace, 900)
        out.append({
            **_driver_meta(session, key, number),
            "lap_time": fmt_time(seconds),
            "lap_number": lap_number,
            "distance": [round(float(d), 1) for d in trace["distance"]],
            "speed": [round(float(s)) for s in trace["speed"]],
        })
    return {"drivers": out}


def stints(year, round_number, code):
    session, key = _context(year, round_number, code)
    colours = _colours(session, key)
    order = [int(n) for n in session.results["DriverNumber"]]
    by_driver = {}
    if key:
        for s in openf1.get("stints", f"session_key={key}", persist=True):
            if s.get("lap_start") is None or s.get("lap_end") is None:
                continue
            by_driver.setdefault(int(s["driver_number"]), []).append({
                "stint": s["stint_number"], "compound": (s.get("compound") or "UNKNOWN").upper(),
                "start": int(s["lap_start"]), "end": int(s["lap_end"]),
            })
    elif lap_source(year) == "fastf1":
        try:
            laps = session.laps
        except Exception as exc:
            raise NoLapData("FastF1 has no lap data for this session") from exc
        grouped = laps.groupby(["DriverNumber", "Stint"])
        for (number, stint), g in grouped:
            compound = g["Compound"].dropna()
            by_driver.setdefault(int(number), []).append({
                "stint": int(stint), "compound": (compound.iloc[0] if len(compound) else "UNKNOWN").upper(),
                "start": int(g["LapNumber"].min()), "end": int(g["LapNumber"].max()),
            })
    else:
        raise NoLapData("No lap data source for this session")
    if not by_driver:
        raise NoLapData("No stint data")
    drivers = []
    for number in order:
        if number not in by_driver:
            continue
        meta = _driver_meta(session, key, number)
        meta["colour"] = colours.get(number)
        drivers.append({**meta, "stints": sorted(by_driver[number], key=lambda s: s["stint"])})
    total = max(s["end"] for d in drivers for s in d["stints"])
    return {"total_laps": total, "drivers": drivers}
