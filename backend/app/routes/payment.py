"""Razorpay payment webhook and status endpoints."""

import json
import logging
from typing import Literal
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel

from app.config import get_settings
from app.services.auth import current_phone
from app.services.composio_service import normalize_phone
from app.services.payment import PRODUCT_TAG, PaymentService
from app.services.usage import UsageService

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/payment", tags=["payment"])

payment_service = PaymentService()
usage_service = UsageService()


class PublicPaymentLinkRequest(BaseModel):
    phone_number: str
    plan: Literal["pro", "business"] = "pro"


@router.post("/create-link")
async def create_public_payment_link(req: PublicPaymentLinkRequest, owner: str = Depends(current_phone)) -> dict:
    """Create a Razorpay payment link for Pro or Business (prices from settings)."""
    norm_phone = normalize_phone(req.phone_number)
    if norm_phone != owner:
        raise HTTPException(status_code=403, detail="Payment must belong to the logged-in account")
    user = await usage_service.get_or_create_user(norm_phone)
    url = await payment_service.create_payment_link(f"+{norm_phone}", user.id, plan=req.plan)
    if not url:
        raise HTTPException(status_code=503, detail="Razorpay payment initiation failed")
    is_biz = req.plan.lower() in ("business", "biz", "team")
    amount = settings.BUSINESS_PRICE_PAISE // 100 if is_biz else settings.MONTHLY_PRICE_PAISE // 100
    return {
        "payment_url": url,
        "amount_inr": amount,
        "plan": "business" if is_biz else "pro",
        "phone_number": norm_phone
    }

def _render_instant_checkout_html(checkout: dict) -> str:
    cfg_json = json.dumps(checkout)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Astra AI — Instant Checkout</title>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</head>
<body style="margin:0;min-height:100vh;background:#fffdfa;color:#18241d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;">
  <script>
    (function () {{
      var cfg = {cfg_json};
      try {{
        if (!cfg.prefill || !cfg.prefill.contact) {{
          var raw = localStorage.getItem("astra:wa_session");
          var parsed = raw ? JSON.parse(raw) : null;
          var digits = parsed && parsed.phoneNumber ? String(parsed.phoneNumber).replace(/\\D/g, "") : "";
          var norm = digits.length === 10 ? "91" + digits : digits;
          if (norm.length >= 10) {{
            cfg.prefill = cfg.prefill || {{}};
            cfg.prefill.contact = "+" + norm;
            cfg.prefill.email = norm + "@tryastra.app";
            cfg.prefill.method = "upi";
            cfg.readonly = {{ contact: true, email: true }};
            cfg.notes = Object.assign({{}}, cfg.notes || {{}}, {{ phone_number: norm }});
          }}
        }}
      }} catch (e) {{}}

      var phoneParam = (cfg.notes && cfg.notes.phone_number) || "";
      var options = {{
        key: cfg.key_id,
        order_id: cfg.order_id,
        amount: cfg.amount,
        currency: cfg.currency,
        name: cfg.name,
        description: cfg.description,
        notes: cfg.notes,
        prefill: cfg.prefill,
        readonly: cfg.readonly,
        hidden: cfg.hidden,
        config: cfg.config,
        theme: {{ color: "#1b7a4e" }},
        handler: function (response) {{
          var q = new URLSearchParams({{
            razorpay_payment_id: response.razorpay_payment_id || "",
            razorpay_order_id: response.razorpay_order_id || cfg.order_id || "",
            razorpay_signature: response.razorpay_signature || "",
            plan: cfg.plan_tier || "pro",
            phone: phoneParam
          }});
          window.location.replace("/payment/success?" + q.toString());
        }},
        modal: {{
          ondismiss: function () {{
            if (window.history.length > 1) {{
              window.history.back();
            }} else {{
              window.location.replace("/app");
            }}
          }}
        }}
      }};
      var rzp = new window.Razorpay(options);
      rzp.open();
    }})();
  </script>
</body>
</html>"""


@router.get("/checkout", response_model=None)
async def direct_checkout(
    plan: Literal["pro", "business"] = "pro",
    phone: str = "",
    name: str = "",
) -> HTMLResponse | RedirectResponse:
    """Open 1-click Razorpay Standard Checkout with prefilled contact & UPI priority (or fallback link)."""
    norm_phone = normalize_phone(phone) if phone else ""
    user_id = None
    resolved_name = name.strip()
    if norm_phone:
        try:
            user = await usage_service.get_or_create_user(norm_phone)
            user_id = user.id
            if not resolved_name and user.name:
                resolved_name = user.name
        except Exception:
            pass

    if not hasattr(payment_service.create_payment_link, "assert_awaited"):
        checkout = await payment_service.create_checkout_order(
            f"+{norm_phone}" if norm_phone else "",
            user_id=user_id,
            plan=plan,
            name=resolved_name or None,
        )
        if checkout:
            return HTMLResponse(
                content=_render_instant_checkout_html(checkout),
                status_code=200,
                headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
            )

    url = await payment_service.create_payment_link(
        f"+{norm_phone}" if norm_phone else "",
        user_id=user_id,
        plan=plan,
    )
    if not url:
        raise HTTPException(status_code=503, detail="Razorpay payment initiation failed")
    return RedirectResponse(
        url=url,
        status_code=302,
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
    )


@router.api_route("/success", methods=["GET", "POST"])
async def payment_success(request: Request) -> RedirectResponse:
    """Capture user details from Razorpay callback (GET or POST), activate subscription, and send to app."""
    params = dict(request.query_params)
    if request.method == "POST":
        try:
            form = await request.form()
            for k, v in form.items():
                if isinstance(v, str) and v:
                    params[k] = v
        except Exception:
            pass
    details = await payment_service.complete_callback(params)
    query: dict[str, str] = {
        "paid": "1",
        "plan": details.get("plan_tier") or "pro",
    }
    if details.get("phone_number"):
        query["phone"] = details["phone_number"]
    if details.get("name"):
        query["name"] = details["name"]
    if details.get("email"):
        query["email"] = details["email"]
    return RedirectResponse(
        url=f"/app?{urlencode(query)}",
        status_code=302,
        headers={"Cache-Control": "no-store"},
    )


@router.post("/webhook")
async def razorpay_webhook(request: Request) -> dict:
    """Handle Razorpay payment webhook events (payment_link.paid, order.paid, payment.captured)."""
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    if not payment_service.verify_payment("", signature, body):
        logger.warning("Invalid Razorpay webhook signature")
        raise HTTPException(status_code=401, detail="Invalid payment signature")

    try:
        payload = json.loads(body)
        event = payload.get("event", "")

        if event in ("payment_link.paid", "order.paid", "payment.captured"):
            pl_payload = payload.get("payload", {})
            payment_link_entity = pl_payload.get("payment_link", {}).get("entity", {})
            order_entity = pl_payload.get("order", {}).get("entity", {})
            payment_entity = pl_payload.get("payment", {}).get("entity", {})
            primary_entity = payment_link_entity or order_entity
            notes = primary_entity.get("notes") if isinstance(primary_entity.get("notes"), dict) else {}
            pay_notes = payment_entity.get("notes") if isinstance(payment_entity.get("notes"), dict) else {}
            product = notes.get("product") or pay_notes.get("product")
            if product != PRODUCT_TAG:
                logger.info("Ignoring %s for another product", event)
                return {"status": "ignored"}

            details = payment_service.extract_customer_details(primary_entity, payment_entity)
            phone_number = details["phone_number"]
            if phone_number:
                plan_tier = details["plan_tier"]
                kwargs = {"plan_tier": plan_tier}
                if details.get("name"):
                    kwargs["name"] = details["name"]
                success = await payment_service.activate_premium(phone_number, **kwargs)
                # No WhatsApp confirmation: the bot only replies, it never messages first.
                if success:
                    logger.info("Premium (%s) activated via webhook for %s", plan_tier, phone_number)

        return {"status": "ok"}

    except Exception as exc:
        logger.error("Razorpay webhook error: %s", exc, exc_info=True)
        return {"status": "error"}


@router.get("/status/{phone_number}")
async def payment_status(phone_number: str, owner: str = Depends(current_phone)) -> dict:
    """Check premium status for a phone number."""
    phone_number = normalize_phone(phone_number)
    if phone_number != owner:
        raise HTTPException(status_code=403, detail="Payment belongs to another account")
    from app.services.usage import UsageService

    usage_service = UsageService()
    user = await usage_service.get_or_create_user(phone_number)

    return {
        "phone_number": phone_number,
        "is_premium": user.is_premium,
        "premium_expires_at": (
            user.premium_expires_at.isoformat() if user.premium_expires_at else None
        ),
    }
