
import sqlite3
import os
import glob
import json
from collections import defaultdict
from datetime import datetime

# 1. Check openclaw transcripts / sessions
session_files = glob.glob(os.path.expanduser("~/.openclaw/**/sessions/**/*.jsonl"), recursive=True)
if not session_files:
    session_files = glob.glob(os.path.expanduser("~/.openclaw/**/*.jsonl"), recursive=True)

daily_counts = defaultdict(int)
total_user_msgs = 0

for sf in session_files[:30]:
    try:
        with open(sf, "r") as f:
            for line in f:
                data = json.loads(line)
                # check if message is from user
                role = data.get("role") or data.get("sender", {}).get("name")
                if role in ("user", "Didigam Nithin", "gateway-owner") or data.get("type") == "user_message":
                    ts = data.get("timestamp") or data.get("createdAt")
                    if ts:
                        try:
                            if isinstance(ts, (int, float)):
                                dt = datetime.fromtimestamp(ts / 1000 if ts > 1e11 else ts).strftime("%Y-%m-%d")
                            else:
                                dt = str(ts)[:10]
                            daily_counts[dt] += 1
                            total_user_msgs += 1
                        except Exception:
                            pass
    except Exception:
        pass

print("OpenClaw Daily User Messages:")
for d in sorted(daily_counts.keys())[-10:]:
    print(f"  {d}: {daily_counts[d]} messages")
print(f"Total counted: {total_user_msgs}")

# 2. Check WhatsApp Testing Chat log (_chat.txt)
chat_file = "/Users/nithi/Downloads/_chat_temp.txt"
os.system("unzip -p '/Users/nithi/Downloads/WhatsApp Chat - Yell AI Testing Test Number.zip' '_chat.txt' > " + chat_file)

if os.path.exists(chat_file):
    wa_user_msgs = defaultdict(int)
    with open(chat_file, "r") as f:
        for line in f:
            if "NhancioTechnologies:" in line:
                # [30/10/26, 12:10:19 PM]
                date_part = line.split(",")[0].replace("[", "").strip()
                wa_user_msgs[date_part] += 1
    print("\nWhatsApp Chat User Messages:")
    for d, c in wa_user_msgs.items():
        print(f"  {d}: {c} messages")
    os.remove(chat_file)
