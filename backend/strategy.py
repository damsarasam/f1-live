"""Strategy history: the tyre plans the top five used at a Grand Prix over the previous three seasons."""
from collections import Counter

from . import historical


def _find_round(year, event_name, location):
    for ev in historical.schedule(year):
        if ev["name"] == event_name or ev["location"] == location:
            return ev["round"]
    return None


def predictions(year, round_number):
    target = next((e for e in historical.schedule(year) if e["round"] == round_number), None)
    if not target:
        raise ValueError("Unknown round")
    races = []
    for y in (year - 1, year - 2, year - 3):
        try:
            past_round = _find_round(y, target["name"], target["location"])
            if past_round is None:
                races.append({"year": y, "status": "not held"})
                continue
            res = historical.results(y, past_round, "R")
            stint_data = historical.stints(y, past_round, "R")
        except historical.NoLapData:
            races.append({"year": y, "status": "no lap data"})
            continue
        except Exception:
            races.append({"year": y, "status": "unavailable"})
            continue
        by_number = {d["number"]: d for d in stint_data["drivers"]}
        finishers = []
        for r in res["results"][:5]:
            d = by_number.get(r["number"])
            if not d:
                continue
            finishers.append({
                "position": r["position"], "code": r["code"], "colour": r["colour"], "team": r["team"],
                "stints": [{"compound": s["compound"], "laps": s["end"] - s["start"] + 1} for s in d["stints"]],
            })
        races.append({"year": y, "status": "ok", "event": res["event"], "total_laps": stint_data["total_laps"], "finishers": finishers})

    counter = Counter()
    examples = {}
    for race in races:
        for f in race.get("finishers", []):
            plan = tuple(s["compound"] for s in f["stints"])
            counter[plan] += 1
            examples.setdefault(plan, []).append({"year": race["year"], "code": f["code"], "position": f["position"],
                                                  "laps": [s["laps"] for s in f["stints"]], "total": race["total_laps"]})
    total = sum(counter.values())
    plans = [{"compounds": list(plan), "count": n, "share": n / total if total else 0, "stops": len(plan) - 1,
              "examples": examples[plan]} for plan, n in counter.most_common()]
    return {"event": target["name"], "year": year, "round": round_number, "plans": plans, "races": races}
