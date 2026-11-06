"""Race tactics beyond tyres, from the previous ten editions of a Grand Prix (OpenF1 data, 2023 on).

- Pit window: when stops happened, what the pit lane costs, and places gained or lost across each stop.
- Safety car: how often a safety car or virtual safety car came out, and who stopped under it.
- Energy and attack: where cars are flat out on the fastest lap, where electric deployment visibly runs
  out (speed falls while the throttle is still fully open), and where overtakes happened on the lap.
"""
import numpy as np
import pandas as pd

from . import historical, openf1
from .strategy import EDITIONS, _find_round


def _ts(series):
    return pd.to_datetime(series, utc=True, format="ISO8601")


def _editions(year, round_number):
    target = next((e for e in historical.schedule(year) if e["round"] == round_number), None)
    if not target:
        raise ValueError("Unknown round")
    out = []
    for y in range(year - 1, year - 1 - EDITIONS, -1):
        try:
            r = _find_round(y, target["name"], target["location"])
        except Exception:
            r = None
        if r is None:
            out.append({"year": y, "status": "not held"})
            continue
        # Only OpenF1 (2023 on) has pit stops, race control, positions and overtakes
        if historical.lap_source(y) != "openf1":
            out.append({"year": y, "status": "no lap data"})
            continue
        try:
            session, key = historical._context(y, r, "R")
        except Exception:
            key = None
        if not key:
            out.append({"year": y, "status": "unavailable"})
            continue
        out.append({"year": y, "status": "ok", "round": r, "key": key, "session": session})
    return target, out


def _positions(key):
    """Position over time per driver: {number: DataFrame(date, position)}."""
    df = pd.DataFrame(openf1.get("position", f"session_key={key}", persist=True))
    if df.empty:
        return {}
    df["date"] = _ts(df["date"])
    return {int(n): g.sort_values("date")[["date", "position"]] for n, g in df.groupby("driver_number")}


def _position_at(track, when):
    if track is None or track.empty:
        return None
    before = track[track["date"] <= when]
    return int(before["position"].iloc[-1]) if len(before) else int(track["position"].iloc[0])


def _codes(session):
    return {int(n): code for n, code in zip(session.results["DriverNumber"], session.results["Abbreviation"])}


# ---------- Pit window and undercut ----------
def _pit(ed, laps):
    key, session = ed["key"], ed["session"]
    pits = [p for p in openf1.get("pit", f"session_key={key}", persist=True) if p.get("lap_number")]
    if not pits:
        return None
    total = int(laps["lap_number"].max())
    pos = _positions(key)
    lap_start = {(int(r.driver_number), int(r.lap_number)): r.date_start for r in laps.itertuples()}
    codes = _codes(session)
    # Racing stops only: not laps 1-2 (damage) and not ones under a long stationary repair
    stops = [{"n": int(p["driver_number"]), "lap": int(p["lap_number"]), "lane": p.get("lane_duration") or p.get("pit_duration")}
             for p in pits if int(p["lap_number"]) > 2 and (p.get("lane_duration") or p.get("pit_duration") or 99) <= 45]
    by_driver = {}
    for st in stops:
        by_driver.setdefault(st["n"], []).append(st["lap"])

    def place(n, lap):
        when = lap_start.get((n, max(1, min(total, lap))))
        return _position_at(pos.get(n), when) if when is not None else None

    # Duels: two cars within two places of each other; one stops first (undercut), the other a few laps later.
    # Compare who is ahead once both have stopped and had two laps to settle.
    duels = []
    seen = set()
    for a in stops:
        pa = place(a["n"], a["lap"] - 1)
        if pa is None:
            continue
        for n, ls in by_driver.items():
            if n == a["n"]:
                continue
            later = [l for l in ls if a["lap"] < l <= a["lap"] + 6]
            if not later:
                continue
            pb = place(n, a["lap"] - 1)
            if pb is None or abs(pa - pb) > 2:
                continue
            pair = (min(a["n"], n), max(a["n"], n), a["lap"])
            if pair in seen:
                continue
            seen.add(pair)
            settle = later[0] + 2
            qa, qb = place(a["n"], settle), place(n, settle)
            if qa is None or qb is None:
                continue
            early_ahead_before, early_ahead_after = pa < pb, qa < qb
            duels.append({
                "first": codes.get(a["n"], str(a["n"])), "second": codes.get(n, str(n)), "lap": a["lap"], "gap_laps": later[0] - a["lap"],
                "result": "undercut" if early_ahead_after and not early_ahead_before
                else "overcut" if not early_ahead_after and early_ahead_before else "held",
            })
    return {"total_laps": total, "stops": [{"lap": s_["lap"], "share": s_["lap"] / total, "lane": s_["lane"]} for s_ in stops], "duels": duels}


def _pit_summary(per_year):
    stops = [s for y in per_year for s in y["stops"]]
    if not stops:
        return None
    lanes = [s["lane"] for s in stops if s["lane"]]
    # Stops by share of race distance, so editions of different lengths line up
    bins = [{"from": i / 10, "to": (i + 1) / 10, "stops": sum(1 for s in stops if i / 10 <= s["share"] < (i + 1) / 10)} for i in range(10)]
    peak = max(bins, key=lambda b: b["stops"])
    duels = [d for y in per_year for d in y["duels"]]
    swaps = [d for d in duels if d["result"] != "held"]
    under = sum(1 for d in swaps if d["result"] == "undercut")
    over = sum(1 for d in swaps if d["result"] == "overcut")
    return {
        "lane_loss": round(float(np.median(lanes)), 1) if lanes else None,
        "stops": len(stops), "bins": bins, "peak": peak,
        "duels": len(duels), "undercuts": under, "overcuts": over, "held": len(duels) - len(swaps),
        "examples": swaps[:6],
    }


# ---------- Safety car ----------
def _safety(ed, laps):
    key = ed["key"]
    rc = openf1.get("race_control", f"session_key={key}", persist=True)
    total = int(laps["lap_number"].max())
    periods, open_ = [], None
    events = sorted([r for r in rc if r.get("category") == "SafetyCar" or (r.get("flag") or "").upper() == "RED"], key=lambda r: r["date"])
    for m in events:
        msg, lap = (m.get("message") or "").upper(), m.get("lap_number") or 0
        if (m.get("flag") or "").upper() == "RED":
            # A red flag ends any neutralisation in progress and is its own event
            if open_:
                open_["end"] = lap; periods.append(open_); open_ = None
            periods.append({"kind": "RED", "start": lap, "end": lap})
            continue
        kind = "VSC" if "VIRTUAL" in msg else "SC"
        if "DEPLOYED" in msg and open_ is None:
            open_ = {"kind": kind, "start": lap}
        elif open_ and ("ENDING" in msg or "IN THIS LAP" in msg) and kind == open_["kind"]:
            open_["end"] = max(lap, open_["start"]); periods.append(open_); open_ = None
    if open_:
        open_["end"] = open_["start"]; periods.append(open_)
    red = any(p["kind"] == "RED" for p in periods)
    codes = _codes(ed["session"])
    pits = openf1.get("pit", f"session_key={key}", persist=True)
    for p in periods:
        p["share"] = p["start"] / total if total else 0
        p["stopped"] = sorted({codes.get(int(x["driver_number"]), str(x["driver_number"])) for x in pits
                               if x.get("lap_number") and p["start"] <= x["lap_number"] <= p["end"]})
    return {"total_laps": total, "periods": periods, "red_flag": red}


# ---------- Energy and attack ----------
def _energy(ed, laps):
    key = ed["key"]
    timed = laps.dropna(subset=["lap_duration"])
    timed = timed[timed["lap_number"] > 1]
    if timed.empty:
        return None
    lap = timed.loc[timed["lap_duration"].idxmin()]
    n, start, dur = int(lap["driver_number"]), lap["date_start"], float(lap["lap_duration"])
    query = f"session_key={key}&driver_number={n}&{historical._window(start, dur)}"
    car = pd.DataFrame(openf1.get("car_data", query, persist=True))
    loc = pd.DataFrame(openf1.get("location", query, persist=True))
    if car.empty or loc.empty:
        return None
    car["date"] = _ts(car["date"]); car = car.sort_values("date")
    loc["date"] = _ts(loc["date"]); loc = loc.sort_values("date")[["date", "x", "y"]]
    tr = pd.merge_asof(car[["date", "speed", "throttle", "brake"]], loc, on="date", direction="nearest")
    tr["t"] = (tr["date"] - tr["date"].iloc[0]).dt.total_seconds()
    tr["frac"] = tr["t"] / dur
    tr["full"] = tr["throttle"] >= 98

    # Full-throttle runs, and inside each whether speed peaks and then falls with the throttle still open
    zones, run = [], None
    rows = list(tr.itertuples())
    for i, r in enumerate(rows + [None]):
        if r is not None and r.full:
            run = run or [i, i]; run[1] = i
            continue
        if run:
            a, b = run; run = None
            seg = tr.iloc[a:b + 1]
            length = float(seg["t"].iloc[-1] - seg["t"].iloc[0])
            if length < 2.5:
                continue
            peak = int(seg["speed"].values.argmax())
            drop = float(seg["speed"].max() - seg["speed"].iloc[-1])
            tail = float(seg["t"].iloc[-1] - seg["t"].iloc[peak])
            clip = drop >= 4 and tail >= 0.6
            zones.append({
                "from": round(float(seg["frac"].iloc[0]), 4), "to": round(float(seg["frac"].iloc[-1]), 4),
                "seconds": round(length, 1), "top_speed": int(seg["speed"].max()),
                "clip": bool(clip), "clip_at": round(float(seg["frac"].iloc[peak]), 4) if clip else None,
                "clip_loss": round(drop, 0) if clip else 0,
            })

    outline = historical._downsample(tr[["x", "y", "frac"]], 500)
    return {
        "driver": _codes(ed["session"]).get(n, str(n)), "lap_seconds": round(dur, 3),
        "outline": [[float(r.x), float(r.y), float(r.frac)] for r in outline.itertuples()],
        "zones": zones,
    }


def _overtake_spots(ed, laps):
    """Where on the lap (0..1) each real pass happened, by the overtaking car's lap timing."""
    key = ed["key"]
    try:
        ov = openf1.get("overtakes", f"session_key={key}", persist=True)
    except Exception:
        ov = []
    pits = openf1.get("pit", f"session_key={key}", persist=True)
    pit_laps = {(int(p["driver_number"]), int(p["lap_number"])) for p in pits if p.get("lap_number")}
    by_driver = {int(d): g.sort_values("date_start") for d, g in laps.groupby("driver_number")}
    spots = []
    for o in ov:
        a, b = int(o["overtaking_driver_number"]), int(o["overtaken_driver_number"])
        when = _ts(pd.Series([o["date"]])).iloc[0]
        g = by_driver.get(a)
        if g is None:
            continue
        cur = g[g["date_start"] <= when]
        if cur.empty:
            continue
        L = cur.iloc[-1]
        lap_no = int(L["lap_number"])
        # Lap 1 shuffles and places swapped in the pit lane are not real passes
        if lap_no <= 1 or any((d, l) in pit_laps for d in (a, b) for l in (lap_no - 1, lap_no, lap_no + 1)):
            continue
        if pd.isna(L["lap_duration"]):
            continue
        f = (when - L["date_start"]).total_seconds() / float(L["lap_duration"])
        if 0 <= f <= 1:
            spots.append(round(f, 4))
    return spots


def _attack_summary(per_year):
    latest = next((y for y in per_year if y.get("energy")), None)
    if not latest:
        return None
    e = latest["energy"]
    spots = [f for y in per_year for f in y.get("spots") or []]
    for z in e["zones"]:
        # Passes completed on this straight or in the braking zone just after it
        z["overtakes"] = sum(1 for f in spots if z["from"] <= f <= min(1.0, z["to"] + 0.03))
    ranked = sorted(e["zones"], key=lambda z: (-z["overtakes"], -z["seconds"]))
    for i, z in enumerate(sorted(e["zones"], key=lambda z: z["from"])):
        z["index"] = i + 1
    years = [y["year"] for y in per_year if y.get("spots") is not None]
    return {"year": latest["year"], **e, "all_overtakes": len(spots), "overtake_years": years, "spots": spots, "attack": ranked[:3]}


def analysis(year, round_number):
    target, editions = _editions(year, round_number)
    seasons = []
    for ed in editions:
        row = {"year": ed["year"], "status": ed["status"]}
        if ed["status"] == "ok":
            try:
                laps = historical._openf1_laps(ed["key"])
                if laps.empty:
                    raise historical.NoLapData("No laps")
                row["pit"] = _pit(ed, laps)
                row["safety"] = _safety(ed, laps)
                row["energy"] = _energy(ed, laps) if not any(s.get("energy") for s in seasons) else None
                row["spots"] = _overtake_spots(ed, laps)
            except openf1.RateLimited:
                raise
            except Exception:
                row["status"] = "unavailable"
        seasons.append(row)
    pit = _pit_summary([s["pit"] for s in seasons if s.get("pit")])
    safety = [{"year": s["year"], **s["safety"]} for s in seasons if s.get("safety")]
    sc = sum(1 for s in safety if any(p["kind"] == "SC" for p in s["periods"]))
    vsc = sum(1 for s in safety if any(p["kind"] == "VSC" for p in s["periods"]))
    return {
        "event": target["name"], "year": year, "round": round_number,
        "seasons": [{"year": s["year"], "status": s["status"]} for s in seasons],
        "pit": pit,
        "safety": {"races": len(safety), "sc_races": sc, "vsc_races": vsc, "editions": safety} if safety else None,
        "attack": _attack_summary(seasons),
    }
