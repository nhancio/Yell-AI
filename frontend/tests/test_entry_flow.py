"""Run after npm run build: verify the actual exported public landing page."""

from html.parser import HTMLParser
from pathlib import Path
import unittest


class Links(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.links = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.links.append(dict(attrs))


class PublicEntryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = (Path(__file__).resolve().parents[1] / "out/index.html").read_text()
        cls.links = Links(cls.html).links

    def test_public_landing_does_not_offer_direct_agent_contact(self):
        output = Path(__file__).resolve().parents[1] / "out"
        for page in ("index.html", "brands.html", "ads.html"):
            with self.subTest(page=page):
                html = (output / page).read_text()
                for link in Links(html).links:
                    self.assertNotIn("wa.me", link.get("href", ""))
                    self.assertNotIn("api.whatsapp.com", link.get("href", ""))
                self.assertNotIn("918790968218", html)

    def test_trial_login_and_recipe_links_use_the_account_entry(self):
        entries = [link for link in self.links if link.get("href", "").startswith("/app")]
        self.assertGreaterEqual(len(entries), 15)
        self.assertTrue(any("prompt=" in link["href"] for link in entries))
        self.assertTrue(all(link.get("target") != "_blank" for link in entries))

    def test_both_paid_plans_begin_at_authenticated_account(self):
        paths = {link.get("href") for link in self.links}
        self.assertIn("/app?plan=pro", paths)
        self.assertIn("/app?plan=business", paths)
        self.assertNotIn("checkout.razorpay.com/v1/checkout.js", self.html)

    def test_brands_portal_is_mobile_responsive_and_unlocked_for_inquiries(self):
        brands_html = (Path(__file__).resolve().parents[1] / "out/brands.html").read_text()
        css = "\n".join(
            p.read_text()
            for p in (Path(__file__).resolve().parents[1] / "out/_next/static/css").glob("*.css")
        )
        self.assertNotIn('<button type="submit" disabled=""', brands_html)
        self.assertIn("brandsHeaderInner", brands_html)
        self.assertIn("brandsMainGrid", brands_html)
        self.assertIn("brandsFormRow", brands_html)
        self.assertIn("Admin API Key", brands_html)
        self.assertIn("brandsHeaderInner", css)

    def test_app_entry_html_does_not_render_onboarding_progress_bar_on_initial_load(self):
        app_html = (Path(__file__).resolve().parents[1] / "out/app.html").read_text()
        self.assertNotIn('aria-label="Onboarding"', app_html)
        self.assertNotIn("Making room for you", app_html)




if __name__ == "__main__":
    unittest.main()
