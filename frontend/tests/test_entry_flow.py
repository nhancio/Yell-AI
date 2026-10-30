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


if __name__ == "__main__":
    unittest.main()
