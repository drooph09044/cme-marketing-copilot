from __future__ import annotations

import os
import copy
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import contextmanager
from typing import Callable, Mapping, TypeVar

T = TypeVar("T")
_CACHE_LOCK = threading.RLock()
_CACHE: dict[tuple[str, object], tuple[float, object]] = {}
_IN_FLIGHT: dict[tuple[str, object], threading.Event] = {}
_CACHE_EPOCH = 0


def env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name: str, default: int, minimum: int = 1, maximum: int | None = None) -> int:
    try:
        value = int(str(os.getenv(name, default)).strip())
    except (TypeError, ValueError):
        value = default
    value = max(minimum, value)
    if maximum is not None:
        value = min(maximum, value)
    return value


@contextmanager
def timed_section(name: str, enabled_env: str = "CODEX_ENABLE_ROUTE_TIMING"):
    enabled = env_flag(enabled_env)
    start = time.perf_counter() if enabled else None
    try:
        yield
    finally:
        if start is not None:
            elapsed_ms = int((time.perf_counter() - start) * 1000)
            print(f"[PERF] {name} elapsed_ms={elapsed_ms}")


def run_named_tasks(
    tasks: Mapping[str, Callable[[], T]],
    *,
    enabled: bool,
    max_workers: int,
    fail_fast: bool = True,
) -> dict[str, T]:
    if not tasks:
        return {}

    if not enabled or len(tasks) == 1 or max_workers <= 1:
        results: dict[str, T] = {}
        for name, task in tasks.items():
            results[name] = task()
        return results

    workers = min(max_workers, len(tasks))
    results: dict[str, T] = {}
    with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="codex-api-io") as executor:
        future_to_name = {executor.submit(task): name for name, task in tasks.items()}
        for future in as_completed(future_to_name):
            name = future_to_name[future]
            try:
                results[name] = future.result()
            except Exception as exc:
                print(f"[WARN] Parallel task failed name={name}: {exc}")
                if fail_fast:
                    raise
    return results


def cached_result(
    namespace: str,
    key: object,
    ttl_seconds: int,
    loader: Callable[[], T],
    *,
    enabled: bool = True,
    force_refresh: bool = False,
) -> T:
    if not enabled or ttl_seconds <= 0:
        return loader()

    cache_key = (namespace, key)
    now = time.monotonic()
    owns_load = False
    with _CACHE_LOCK:
        load_epoch = _CACHE_EPOCH
        if not force_refresh:
            cached = _CACHE.get(cache_key)
            if cached is not None:
                expires_at, value = cached
                if expires_at > now:
                    return copy.deepcopy(value)
                _CACHE.pop(cache_key, None)

        event = _IN_FLIGHT.get(cache_key)
        if event is None:
            event = threading.Event()
            _IN_FLIGHT[cache_key] = event
            owns_load = True

    if not owns_load:
        event.wait()
        with _CACHE_LOCK:
            cached = _CACHE.get(cache_key)
            if cached is not None:
                _expires_at, value = cached
                return copy.deepcopy(value)
        return cached_result(
            namespace,
            key,
            ttl_seconds,
            loader,
            enabled=enabled,
            force_refresh=force_refresh,
        )

    try:
        value = loader()
        with _CACHE_LOCK:
            if _CACHE_EPOCH == load_epoch:
                _CACHE[cache_key] = (
                    time.monotonic() + ttl_seconds,
                    copy.deepcopy(value),
                )
        return value
    finally:
        with _CACHE_LOCK:
            completed = _IN_FLIGHT.pop(cache_key, None)
            if completed is not None:
                completed.set()


def clear_cached_results(namespace: str | None = None) -> None:
    global _CACHE_EPOCH
    with _CACHE_LOCK:
        _CACHE_EPOCH += 1
        if namespace is None:
            _CACHE.clear()
            return
        for cache_key in list(_CACHE):
            if cache_key[0] == namespace:
                _CACHE.pop(cache_key, None)

