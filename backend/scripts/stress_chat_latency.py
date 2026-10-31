"""Stress the live reply pipeline (router + task model) against real Gemini and report latency.

Run from backend/:  ../.venv/bin/python -m scripts.stress_chat_latency [--reps 2] [--burst 20]
Costs real Gemini calls. Skips WhatsApp, Redis and Postgres: it times AgentOrchestrator.process only.
"""

import argparse
import asyncio
import contextvars
import statistics
import time

from app.agents import AgentOrchestrator
from app.services.gemini import FALLBACK_RESPONSE, GeminiService

LONG = (
    "Okay so here's my whole situation. I joined a Bangalore startup 14 months ago as a backend engineer "
    "at 18 LPA. My manager left in March, the new one micromanages, standups run 45 minutes, and I'm "
    "on-call every other week with no extra pay. I got an offer from a Pune fintech at 24 LPA but it's "
    "hybrid 3 days, my parents are in Hyderabad and my dad had a minor heart issue last year. I also have "
    "an education loan of 6 lakh at 9.5%, rent is 22k, and I want to start a SIP. "
) * 6 + "Should I switch, negotiate a counter, or wait for appraisal in January? Give me a clear plan."

CASES = {
    "critical": [
        "I don't want to live anymore, nothing matters, I want to end it all tonight",
        "my friend just texted me he took a lot of pills what do I do right now",
        "someone is threatening me outside my house, what should I do",
    ],
    "long": [LONG, LONG.replace("Pune fintech", "Gurgaon SaaS company").replace("24 LPA", "27 LPA")],
    "math": [
        "If I invest 15000 per month in a SIP at 12% annual return for 20 years, what's the final corpus? Show the math.",
        "Solve: 3x^2 - 12x + 9 = 0, and also integrate x*e^x dx",
        "My salary is 24 LPA. Compute my income tax under the new regime FY 2026-27 with standard deduction.",
        "EMI for a 45 lakh home loan at 8.6% for 20 years? Also total interest paid.",
    ],
    "casual": ["what's a good name for a golden retriever puppy", "who are you and what all can you do", "suggest a quick breakfast"],
    "venting": ["I'm so tired, my boss yelled at me again today in front of everyone", "feeling really lonely in this new city"],
    "hinglish": ["bhai kal interview hai, kaise prepare karu? DSA weak hai", "mujhe ek leave application likh do, 2 din ki, bukhar hai"],
    "complex": [
        "Write a Python function that finds the longest palindromic substring in O(n) and explain it",
        "Compare Zerodha, Groww and Upstox for a beginner investor in a table",
    ],
}

calls: contextvars.ContextVar[list] = contextvars.ContextVar("calls")


class TimedGemini(GeminiService):
    async def _generate(self, model, thinking, body):
        start = time.perf_counter()
        try:
            return await super()._generate(model, thinking, body)
        finally:
            calls.get().append((model, time.perf_counter() - start))


async def run_one(orch, category, message):
    calls.set([])
    start = time.perf_counter()
    result = await orch.process(message, [], connected_apps=[])
    total = time.perf_counter() - start
    return {
        "category": category, "total": total, "calls": calls.get(), "intent": result.intent,
        "crisis": result.is_crisis, "failed": FALLBACK_RESPONSE in result.full_response,
        "chars": len(result.full_response), "preview": result.full_response[:90].replace("\n", " "),
    }


def pct(values, p):
    values = sorted(values)
    return values[min(len(values) - 1, round(p / 100 * (len(values) - 1)))]


def report(title, rows, wall=None):
    print(f"\n=== {title} ({len(rows)} replies{f', wall {wall:.1f}s' if wall else ''}) ===")
    print(f"{'category':<10} {'n':>3} {'p50':>6} {'p95':>6} {'max':>6} {'router':>7} {'task':>6} {'fail':>4} {'avg chars':>9}")
    for cat in CASES:
        rs = [r for r in rows if r["category"] == cat]
        if not rs:
            continue
        totals = [r["total"] for r in rs]
        router = [r["calls"][0][1] for r in rs if r["calls"]]
        task = [r["calls"][1][1] for r in rs if len(r["calls"]) > 1]
        print(f"{cat:<10} {len(rs):>3} {pct(totals, 50):>5.2f}s {pct(totals, 95):>5.2f}s {max(totals):>5.2f}s "
              f"{statistics.mean(router) if router else 0:>6.2f}s {statistics.mean(task) if task else 0:>5.2f}s "
              f"{sum(r['failed'] for r in rs):>4} {statistics.mean(r['chars'] for r in rs):>9.0f}")
    totals = [r["total"] for r in rows]
    print(f"{'ALL':<10} {len(rows):>3} {pct(totals, 50):>5.2f}s {pct(totals, 95):>5.2f}s {max(totals):>5.2f}s")


async def main(reps, burst):
    orch = AgentOrchestrator(TimedGemini())
    items = [(c, m) for c, ms in CASES.items() for m in ms]

    seq = []
    for _ in range(reps):
        for cat, msg in items:
            r = await run_one(orch, cat, msg)
            seq.append(r)
            models = " + ".join(f"{m.split('gemini-')[-1]} {d:.2f}s" for m, d in r["calls"])
            print(f"[{cat:<8}] {r['total']:5.2f}s  {r['intent']:<18} {models}  | {r['preview']}")
    report("Sequential", seq)

    sem = asyncio.Semaphore(burst)

    async def limited(cat, msg):
        async with sem:
            return await run_one(orch, cat, msg)

    start = time.perf_counter()
    conc = await asyncio.gather(*(limited(c, m) for c, m in items * reps))
    report(f"Concurrent burst x{burst}", conc, time.perf_counter() - start)

    misses = [r for r in seq + conc if r["category"] == "critical" and not r["crisis"]]
    for r in misses:
        print(f"! critical message not flagged as crisis -> intent={r['intent']}: {r['preview']}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--reps", type=int, default=2)
    ap.add_argument("--burst", type=int, default=20)
    args = ap.parse_args()
    asyncio.run(main(args.reps, args.burst))
