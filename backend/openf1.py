"""Shared OpenF1 client.

Every visitor's request funnels through here, so the free tier's limits
(3 requests/second, 30/minute) are enforced once for the whole server rather
than per browser. Responses are cached in memory with a TTL; finished sessions
never change, so those are also kept on disk and survive restarts.
"""
import gzip
import hashlib
import json
import threading
import time
from collections import deque
from pathlib import Path

import requests

BASE_URL = "https://api.openf1.org/v1"
DISK_CACHE = Path(__file__).resolve().parent.parent / "cache" / "openf1"


class RateLimited(Exception):
    pass


class _Budget:
    """Sliding-window limiter for both OpenF1 windows."""

    def __init__(self, per_second=3, per_minute=30):
        self.per_second = per_second
        self.per_minute = per_minute
        self.stamps = deque()
        self.lock = threading.Lock()

    def acquire(self, max_wait):
        deadline = time.monotonic() + max_wait
        while True:
            with self.lock:
                now = time.monotonic()
                while self.stamps and now - self.stamps[0] > 60:
                    self.stamps.popleft()
                last_second = sum(1 for t in self.stamps if now - t < 1)
                if last_second < self.per_second and len(self.stamps) < self.per_minute:
                    self.stamps.append(now)
                    return
                # Time until the oldest stamp blocking us leaves its window
                if len(self.stamps) >= self.per_minute:
                    wait = 60 - (now - self.stamps[0])
                else:
                    wait = 1 - (now - self.stamps[-self.per_second])
            if time.monotonic() + wait > deadline:
                raise RateLimited("OpenF1 request budget exhausted")
            time.sleep(max(wait, 0.05))


_budget = _Budget()
_memory = {}
_memory_lock = threading.Lock()
_inflight = {}


def _key(endpoint, query):
    return f"{endpoint}?{query}"


def _disk_path(key):
    return DISK_CACHE / f"{hashlib.sha1(key.encode()).hexdigest()}.json.gz"


def get(endpoint, query, ttl=15, persist=False, max_wait=20):
    """Fetch `endpoint?query` as parsed JSON (a list).

    ttl: seconds a cached copy stays fresh. persist: also cache on disk forever,
    for data that can no longer change. On failure a stale copy is returned
    when one exists, so a busy minute degrades to slightly old data, not errors.
    """
    key = _key(endpoint, query)
    now = time.time()
    with _memory_lock:
        hit = _memory.get(key)
        if hit and (persist or now - hit[0] < ttl):
            return hit[1]
        # Collapse identical concurrent requests into one upstream call
        event = _inflight.get(key)
        owner = event is None
        if owner:
            event = _inflight[key] = threading.Event()
    if not owner:
        event.wait(timeout=max_wait + 30)
        with _memory_lock:
            hit = _memory.get(key)
        if hit:
            return hit[1]
        raise RateLimited("OpenF1 request did not complete")

    try:
        if persist:
            path = _disk_path(key)
            if path.exists():
                data = json.loads(gzip.decompress(path.read_bytes()))
                with _memory_lock:
                    _memory[key] = (now, data)
                return data
        try:
            data = _fetch(endpoint, query, max_wait)
        except Exception:
            if hit:
                return hit[1]
            raise
        with _memory_lock:
            _memory[key] = (time.time(), data)
        if persist and data:
            DISK_CACHE.mkdir(parents=True, exist_ok=True)
            _disk_path(key).write_bytes(gzip.compress(json.dumps(data).encode()))
        return data
    finally:
        with _memory_lock:
            _inflight.pop(key, None)
        event.set()


def _fetch(endpoint, query, max_wait):
    url = f"{BASE_URL}/{endpoint}?{query}" if query else f"{BASE_URL}/{endpoint}"
    for attempt in range(3):
        _budget.acquire(max_wait)
        r = requests.get(url, timeout=30)
        if r.status_code == 429:
            time.sleep(1 + attempt)
            continue
        if r.status_code == 404:
            return []
        if r.status_code in (401, 403):
            detail = r.json().get("detail") if r.headers.get("content-type", "").startswith("application/json") else None
            raise PermissionError(detail or f"OpenF1 refused access (HTTP {r.status_code})")
        r.raise_for_status()
        return r.json()
    raise RateLimited("OpenF1 kept rate limiting")
