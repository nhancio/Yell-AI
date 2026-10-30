# Astra AI — India's WhatsApp AI Super-Agent (Instinct + Poke + Backdoor Clone)

## Working Directory & Project Context
- **Repo Path:** `/Users/nithi/Desktop/Claude-Projects/Nhancio-Projects/Astra AI`
- **Production URL:** `https://astra.nhancio.com`
- **Backend URL:** `https://api.astra.nhancio.com` (FastAPI on `:8000` locally)
- **WhatsApp Provider:** Meta WhatsApp Cloud API, direct (`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET` in `.env`)
- **Payments:** Razorpay Live (`₹199/mo` Pro Plan via UPI / Razorpay + Free Ad-Supported Tier)

## Architecture (v2.0 — India Super-Agent)
1. **Connect Once via Composio (`backend/app/services/composio_service.py`):**
   - Maps each user's WhatsApp phone number (`91XXXXXXXXXX`) to deterministic Composio entity `astra_wa_91XXXXXXXXXX`.
   - Supported 1-tap OAuth toolkits: `gmail`, `googlecalendar`, `googledrive`, `googlesheets`, `notion`, `github`, `linkedin`, `slack`.
   - REST endpoints in `backend/app/routes/connectors.py`:
     - `GET /api/connectors/toolkits`
     - `GET /api/connectors/status?phone=...`
     - `POST /api/connectors/link`
     - `POST /api/connectors/confirm`
     - `POST /api/connectors/execute`
2. **India Life-OS + Backdoor Hiring Orchestrator (`backend/app/agents/`):**
   - `IntentAgent` classifies messages into `gmail_action`, `calendar_action`, `notion_action`, `founder_outreach` (Backdoor cold emails to Indian/YC startup founders), `travel_irctc` (IRCTC PNR/trains/flights), `food_commerce` (Swiggy/Zomato/Blinkit/Zepto), `budget_planning` (UPI/SIP/finance), etc.
   - Automatically detects if a required Composio toolkit is unlinked and appends a 1-tap OAuth magic link right inside the WhatsApp reply.
3. **India Native Ad Engine (`backend/app/services/ads_service.py`):**
   - `SponsoredCampaign` model pre-seeded with high-intent Indian brand campaigns (Ixigo Trains, Swiggy Instamart, CRED, Instahyre, Zepto Pass).
   - Appends a 1-line contextual sponsor card to free-tier WhatsApp replies (disabled automatically for Pro users and mental-health crisis/venting messages).
4. **Next.js Frontend (`frontend/src/app/`):**
   - `/` (`page.tsx`): Instinct-style India landing page with `+91` phone input, interactive WhatsApp chat showcase, Composio connector grid, ₹0 vs ₹199 UPI pricing, and Astra Ads Network sponsor callout.
   - `/connect` (`connect/page.tsx`): 1-Tap Connect Hub where users link their WhatsApp number to Gmail, Calendar, Notion, GitHub, LinkedIn, Drive, Sheets, and Slack.
