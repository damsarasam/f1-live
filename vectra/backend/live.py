"""Latest-session board from OpenF1: weather, timing tower, car positions, circuit outline."""
from datetime import datetime, timezone

import pandas as pd

from . import openf1

LIVE_TTL = 20  # seconds; keeps a steady ~15 requests/minute inside OpenF1's 30/minute


def _latest(rows, order_col):
    """Last record per driver."""
    df = pd.DataFrame(rows)
    if df.empty or "driver_number" not in df or order_col not in df:
        return df
    return df.sort_values(order_col).drop_duplicates(subset=["driver_number"], keep="last")


def _session():
    rows = openf1.get("sessions", "session_key=latest", ttl=60)
    return rows[-1] if rows else None


def _is_live(session):
    now = datetime.now(timezone.utc)
    start = pd.Timestamp(session["date_start"]).to_pydatetime()
    end = pd.Timestamp(session["date_end"]).to_pydatetime()
    return start <= now <= end


def _outline(key, laps):
    """Circuit shape from one complete lap's location samples; cached forever per session."""
    if laps.empty:
        return []
    lap = laps.loc[laps["lap_duration"].idxmin()]
    start = lap["date_start"]
    end = start + pd.Timedelta(seconds=float(lap["lap_duration"]))
    fmt = "%Y-%m-%dT%H:%M:%S.%f"
    rows = openf1.get("location", f"session_key={key}&driver_number={int(lap['driver_number'])}"
                                  f"&date>{start.strftime(fmt)}&date<{end.strftime(fmt)}", persist=True)
    return [[r["x"], r["y"]] for r in rows if r.get("x") is not None][::2]


def board():
    session = _session()
    if not session:
        return {"session": None}
    key = session["session_key"]
    live = _is_live(session)
    ttl = LIVE_TTL if live else 600
    # A finished session never changes, so keep it on disk
    persist = not live

    drivers = {int(d["driver_number"]): d for d in openf1.get("drivers", f"session_key={key}", ttl=300, persist=persist)}
    positions = _latest(openf1.get("position", f"session_key={key}", ttl=ttl, persist=persist), "date")
    stints = _latest(openf1.get("stints", f"session_key={key}", ttl=ttl, persist=persist), "stint_number")
    laps_all = pd.DataFrame(openf1.get("laps", f"session_key={key}", ttl=ttl, persist=persist))
    weather = openf1.get("weather", f"session_key={key}", ttl=ttl, persist=persist)

    laps = pd.DataFrame()
    if not laps_all.empty:
        laps_all = laps_all.dropna(subset=["lap_duration", "date_start"])
        laps_all["date_start"] = pd.to_datetime(laps_all["date_start"], utc=True, format="ISO8601")
        laps = laps_all.sort_values("date_start").drop_duplicates(subset=["driver_number"], keep="last")

    # Car positions: a short window from the latest completed lap, or now when live
    cars = []
    if not laps.empty:
        anchor = pd.Timestamp.now(tz="UTC") - pd.Timedelta(seconds=8) if live else laps["date_start"].max()
        fmt = "%Y-%m-%dT%H:%M:%S"
        window = f"date>{anchor.strftime(fmt)}&date<{(anchor + pd.Timedelta(seconds=6)).strftime(fmt)}"
        loc = _latest(openf1.get("location", f"session_key={key}&{window}", ttl=ttl, persist=persist), "date")
        for _, r in loc.iterrows():
            d = drivers.get(int(r["driver_number"]), {})
            cars.append({"number": int(r["driver_number"]), "code": d.get("name_acronym"),
                         "colour": d.get("team_colour"), "x": r["x"], "y": r["y"]})

    tower = []
    if not positions.empty:
        stint_by = {int(r["driver_number"]): r for _, r in stints.iterrows()} if not stints.empty else {}
        lap_by = {int(r["driver_number"]): r for _, r in laps.iterrows()} if not laps.empty else {}
        for _, p in positions.sort_values("position").iterrows():
            n = int(p["driver_number"])
            d = drivers.get(n, {})
            s = stint_by.get(n)
            lap = lap_by.get(n)
            tower.append({
                "position": int(p["position"]),
                "number": n,
                "code": d.get("name_acronym"),
                "first": d.get("first_name"),
                "last": d.get("last_name"),
                "team": d.get("team_name"),
                "colour": d.get("team_colour"),
                "compound": (s["compound"].upper() if s is not None and isinstance(s.get("compound"), str) else None),
                "tyre_age": (int(s["tyre_age_at_start"] + lap["lap_number"] - s["lap_start"])
                             if s is not None and lap is not None and pd.notna(s.get("tyre_age_at_start")) else None),
                "last_lap": float(lap["lap_duration"]) if lap is not None else None,
                "lap": int(lap["lap_number"]) if lap is not None else None,
            })

    w = weather[-1] if weather else {}
    return {
        "session": {
            "key": key, "name": session.get("session_name"), "type": session.get("session_type"),
            "country": session.get("country_name"), "location": session.get("location"),
            "circuit": session.get("circuit_short_name"), "year": session.get("year"),
            "start": session.get("date_start"), "end": session.get("date_end"), "live": live,
        },
        "weather": {k: w.get(k) for k in ("air_temperature", "track_temperature", "humidity", "wind_speed", "rainfall")} if w else None,
        "tower": tower,
        "cars": cars,
        "outline": _outline(key, laps_all) if not laps_all.empty else [],
        "updated": datetime.now(timezone.utc).isoformat(),
        "refresh": ttl if live else None,
    }
