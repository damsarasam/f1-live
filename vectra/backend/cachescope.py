"""Keep the strategy pages' cache small: everything fetched while analysing one
race belongs to that race, and opening a different race deletes it.

A strategy request runs inside `scope((year, round))`. While it runs,
openf1.get() and historical._session() report what they load here. When a
request for a different race arrives, the previous race's OpenF1 responses
(memory and disk), FastF1 sessions (memory and their on-disk folders) and
derived results are dropped before the new race is analysed. Ownership is
saved to cache/strategy-scope.json so a restart doesn't leave files orphaned.
"""
import contextvars
import json
import shutil
import threading
from contextlib import contextmanager
from pathlib import Path

LEDGER = Path(__file__).resolve().parent.parent / "cache" / "strategy-scope.json"

_current_race = contextvars.ContextVar("strategy_race", default=None)
_lock = threading.Lock()
_owned = {}          # race -> {"openf1": set(keys), "sessions": set((year, round, code))}
_active = None       # the race the strategy pages are showing now


def _load():
    global _active
    try:
        raw = json.loads(LEDGER.read_text())
    except Exception:
        return
    for race, o in raw.get("owned", {}).items():
        y, r = (int(x) for x in race.split("-"))
        _owned[(y, r)] = {"openf1": set(o["openf1"]), "sessions": {tuple(s) for s in o["sessions"]}}
    if raw.get("active"):
        _active = tuple(raw["active"])


def _save():
    try:
        LEDGER.parent.mkdir(parents=True, exist_ok=True)
        LEDGER.write_text(json.dumps({
            "active": list(_active) if _active else None,
            "owned": {f"{y}-{r}": {"openf1": sorted(o["openf1"]), "sessions": sorted(list(s) for s in o["sessions"])}
                      for (y, r), o in _owned.items()},
        }))
    except Exception:
        pass


_load()


def active():
    """True while a strategy analysis is running in this request."""
    return _current_race.get() is not None


def _note(kind, value):
    race = _current_race.get()
    if race is None:
        return
    with _lock:
        bucket = _owned.setdefault(race, {"openf1": set(), "sessions": set()})[kind]
        if value not in bucket:
            bucket.add(value)
            _save()


def note_openf1(key):
    _note("openf1", key)


def note_session(session_key):
    _note("sessions", tuple(session_key))


def _purge(race):
    from . import historical, openf1
    with _lock:
        owned = _owned.pop(race, None)
        keep = {k for o in _owned.values() for k in o["openf1"]}
        keep_sessions = {k for o in _owned.values() for k in o["sessions"]}
        _save()
    if not owned:
        return
    for key in owned["openf1"] - keep:
        openf1.forget(key)
    for sk in owned["sessions"] - keep_sessions:
        folder = historical.forget_session(*sk)
        if folder is not None and folder.exists():
            shutil.rmtree(folder, ignore_errors=True)
    _shrink_fastf1_http_log()


def _shrink_fastf1_http_log():
    """FastF1 logs every raw download in a SQLite file that only grows; the parsed race files are what it reuses."""
    try:
        from fastf1.req import Cache
        session = Cache._requests_session_cached
        if session is None:
            return
        session.cache.clear()
        conn = getattr(session.cache.responses, "connection", None)
        if conn:
            with conn() as c:
                c.execute("VACUUM")
    except Exception:
        pass


@contextmanager
def scope(race):
    """Run a strategy analysis for `race`, clearing every other race's cache first."""
    global _active
    with _lock:
        _active = race
        others = [r for r in _owned if r != race]
        _save()
    for r in others:
        _purge(r)
    token = _current_race.set(race)
    try:
        yield
    finally:
        _current_race.reset(token)
