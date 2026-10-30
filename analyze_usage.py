
import sqlite3
import json
from datetime import datetime
from collections import defaultdict

con = sqlite3.connect("/Users/nithi/.openclaw/agents/main/agent/openclaw-agent.sqlite")
cur = con.cursor()

daily_user_turns = defaultdict(int)
hourly_distribution = defaultdict(int)

query = 'SELECT created_at, event_json FROM transcript_events WHERE event_json LIKE "%\"role\":\"user\"%" OR event_json LIKE "%\"type\":\"user\"%"'

for row in cur.execute(query):
    try:
        created_at = row[0]
        dt = created_at[:10]
        data = json.loads(row[1])
        # Check if actual user message
        role = data.get("role") or data.get("message", {}).get("role") or data.get("type")
        if role in ("user", "user_message"):
            daily_user_turns[dt] += 1
            hr = created_at[11:13]
            hourly_distribution[hr] += 1
    except:
        pass

print("=== REAL DATA: NITHIN DAILY USER TURNS TO AI ===")
counts = list(daily_user_turns.values())
if counts:
    print(f"Total Active Days Analyzed: {len(counts)}")
    print(f"Average Messages / Day: {sum(counts) / len(counts):.1f}")
    print(f"Median Messages / Day: {sorted(counts)[len(counts)//2]}")
    print(f"Min Messages / Day: {min(counts)}")
    print(f"Max Messages / Day (Sprint day): {max(counts)}")
    print("\nRecent Daily Breakdown:")
    for d in sorted(daily_user_turns.keys())[-14:]:
        print(f"  {d}: {daily_user_turns[d]} user prompts")
else:
    print("No direct counts found.")

# Also check Claude / Codex projects activity
