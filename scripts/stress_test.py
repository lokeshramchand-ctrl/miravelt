"""Concurrent load test against the running Velar backend.

Usage:
    .venv/Scripts/python.exe scripts/stress_test.py

Two phases:
  1. Raw throughput/latency against /live and /health - these carry no
     @limiter.limit decorator (see core/rate_limiter.py, routers/*), so
     this measures actual server capacity under concurrency.
  2. A burst against POST /auth/login (10/minute, routers/auth.py:90) to
     confirm the rate limiter actually rejects excess traffic with 429 -
     that's correct enforcement, not a failure.
"""

import asyncio
import os
import time

import httpx

BASE_URL = "http://localhost:8000"
API_KEY = os.environ.get("VELAR_API_KEY", "")
TOTAL_REQUESTS = 500
CONCURRENCY = 50


async def fire_get(client: httpx.AsyncClient, url: str, headers: dict, results: list, sem: asyncio.Semaphore):
    async with sem:
        start = time.perf_counter()
        try:
            resp = await client.get(url, headers=headers)
            results.append((resp.status_code, time.perf_counter() - start))
        except Exception as exc:
            results.append((f"error:{exc.__class__.__name__}", time.perf_counter() - start))


async def fire_login(client: httpx.AsyncClient, results: list, sem: asyncio.Semaphore):
    async with sem:
        start = time.perf_counter()
        try:
            resp = await client.post(
                f"{BASE_URL}/auth/login",
                headers={"X-Velar-API-Key": API_KEY, "Content-Type": "application/json"},
                json={"email": "stress-test@example.com", "password": "wrong-password"},
            )
            results.append((resp.status_code, time.perf_counter() - start))
        except Exception as exc:
            results.append((f"error:{exc.__class__.__name__}", time.perf_counter() - start))


def summarize(name: str, url: str, total: int, concurrency: int, wall: float, results: list):
    latencies = sorted(r[1] for r in results)
    statuses: dict[object, int] = {}
    for status, _ in results:
        statuses[status] = statuses.get(status, 0) + 1

    def pct(p):
        idx = min(len(latencies) - 1, int(len(latencies) * p))
        return latencies[idx] * 1000

    print(f"\n=== {name} ===")
    print(f"target: {url}")
    print(f"requests: {total}, concurrency: {concurrency}, wall time: {wall:.2f}s")
    print(f"throughput: {total / wall:.1f} req/s")
    print(f"latency ms: min={latencies[0]*1000:.1f} p50={pct(0.50):.1f} p95={pct(0.95):.1f} p99={pct(0.99):.1f} max={latencies[-1]*1000:.1f}")
    print(f"status breakdown: {statuses}")


async def run_get_batch(name: str, url: str, headers: dict, total: int, concurrency: int):
    sem = asyncio.Semaphore(concurrency)
    results: list[tuple[object, float]] = []
    async with httpx.AsyncClient(timeout=10.0) as client:
        start = time.perf_counter()
        await asyncio.gather(*[fire_get(client, url, headers, results, sem) for _ in range(total)])
        wall = time.perf_counter() - start
    summarize(name, url, total, concurrency, wall, results)


async def run_login_burst(total: int, concurrency: int):
    sem = asyncio.Semaphore(concurrency)
    results: list[tuple[object, float]] = []
    async with httpx.AsyncClient(timeout=10.0) as client:
        start = time.perf_counter()
        await asyncio.gather(*[fire_login(client, results, sem) for _ in range(total)])
        wall = time.perf_counter() - start
    summarize("Rate-limiter enforcement - POST /auth/login (limit: 10/minute)", f"{BASE_URL}/auth/login", total, concurrency, wall, results)

    statuses: dict[object, int] = {}
    for status, _ in results:
        statuses[status] = statuses.get(status, 0) + 1
    got_429 = statuses.get(429, 0)
    print(f"-> {got_429} of {total} requests correctly rejected with 429 once the 10/minute limit was exceeded" if got_429 else "-> WARNING: no 429s seen - rate limiter may not be enforcing")


async def main():
    await run_get_batch("Raw throughput - GET /live (unauthenticated)", f"{BASE_URL}/live", {}, TOTAL_REQUESTS, CONCURRENCY)
    await run_get_batch(
        "Raw throughput - GET /health (dependency checks, unauthenticated)",
        f"{BASE_URL}/health",
        {},
        TOTAL_REQUESTS,
        CONCURRENCY,
    )
    await run_login_burst(total=40, concurrency=10)


if __name__ == "__main__":
    asyncio.run(main())
