import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest

source = Path(__file__).resolve().parents[1] / "scripts/publish_history.py"
spec = importlib.util.spec_from_file_location("release_publisher", source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FakeClient:
    def __init__(self, fail_upload=False, reported_digest=None):
        self.calls = []
        self.fail_upload = fail_upload
        self.reported_digest = reported_digest

    def request(self, method, url, payload=None, data=None, content_type=None):
        self.calls.append((method, url, payload, data))
        if method == "POST" and url.endswith("/releases"):
            return {"id": 1, "draft": True, "body": payload["body"], "assets": [],
                    "upload_url": "https://uploads.github.com/repos/RexJohnson679/navega-livre/releases/1/assets{?name,label}",
                    "html_url": "https://github.com/RexJohnson679/navega-livre/releases/tag/v0.3.1"}
        if method == "POST":
            if self.fail_upload:
                raise module.ApiError(500, "simulated upload failure")
            return {"size": len(data), "digest": self.reported_digest or "sha256:" + hashlib.sha256(data).hexdigest()}
        if method == "PATCH":
            return {"draft": False, "html_url": "https://github.com/RexJohnson679/navega-livre/releases/tag/v0.3.1"}
        raise AssertionError((method, url))


class PublisherTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / ".github/release-notes").mkdir(parents=True)
        (self.root / "packages").mkdir()
        (self.root / ".github/release-notes/v0.3.1.md").write_text("Checked release notes\n")
        (self.root / "packages/test.zip").write_bytes(b"fixture bytes")
        self.digest = hashlib.sha256(b"fixture bytes").hexdigest()
        self.item = {"tag": "v0.3.1", "name": "fixture", "target": "current", "latest": True,
                     "notes": ".github/release-notes/v0.3.1.md",
                     "assets": [{"path": "packages/test.zip", "sha256": self.digest}]}
        self.commit = "a" * 40

    def release(self, draft=False, digest=None):
        return {"id": 1, "draft": draft, "body": "Existing human notes", "assets": [
            {"name": "test.zip", "size": 13, "digest": digest or "sha256:" + self.digest}],
            "upload_url": "https://uploads.github.com/repos/RexJohnson679/navega-livre/releases/1/assets{?name,label}",
            "html_url": "https://github.com/RexJohnson679/navega-livre/releases/tag/v0.3.1"}

    def test_draft_is_published_only_after_verified_upload(self):
        client = FakeClient()
        module.publish_one(client, self.root, self.item, self.commit)
        self.assertEqual([c[0] for c in client.calls], ["POST", "POST", "PATCH"])
        self.assertTrue(client.calls[0][2]["draft"])
        self.assertEqual(client.calls[0][2]["target_commitish"], self.commit)
        self.assertEqual(client.calls[-1][2], {"draft": False, "make_latest": "true"})

    def test_upload_error_keeps_draft_unpublished(self):
        client = FakeClient(fail_upload=True)
        with self.assertRaises(module.ApiError):
            module.publish_one(client, self.root, self.item, self.commit)
        self.assertNotIn("PATCH", [c[0] for c in client.calls])

    def test_wrong_uploaded_digest_prevents_publication(self):
        client = FakeClient(reported_digest="sha256:" + "b" * 64)
        with self.assertRaises(ValueError):
            module.publish_one(client, self.root, self.item, self.commit)
        self.assertNotIn("PATCH", [c[0] for c in client.calls])

    def test_existing_public_notes_and_assets_are_not_replaced(self):
        client = FakeClient()
        module.publish_one(client, self.root, self.item, self.commit, self.release())
        self.assertEqual(client.calls, [])

    def test_conflicting_existing_asset_is_not_deleted_or_replaced(self):
        client = FakeClient()
        with self.assertRaises(ValueError):
            module.publish_one(client, self.root, self.item, self.commit, self.release(digest="sha256:" + "c" * 64))
        self.assertEqual(client.calls, [])

    def test_edited_package_fails_preflight(self):
        (self.root / "packages/test.zip").write_bytes(b"modified")
        with self.assertRaises(ValueError):
            module.validate_catalog(self.root, [self.item], self.commit)

    def test_traversal_and_symlink_outside_packages_are_rejected(self):
        with self.assertRaises(ValueError):
            module.checked_path(self.root, "packages/../secret.txt", "packages")
        (self.root / "secret.txt").write_text("fixture")
        (self.root / "packages/link.txt").symlink_to(self.root / "secret.txt")
        with self.assertRaises(ValueError):
            module.checked_path(self.root, "packages/link.txt", "packages")

    def test_catalog_requires_exactly_one_highest_latest_version(self):
        module.validate_catalog(self.root, [self.item], self.commit)
        with self.assertRaises(ValueError):
            module.validate_catalog(self.root, [{**self.item, "latest": False}], self.commit)
        with self.assertRaises(ValueError):
            module.validate_catalog(self.root, [self.item, self.item], self.commit)

    def test_credential_is_not_sent_to_an_unapproved_host(self):
        client = module.Client("fixture-token")
        with self.assertRaises(ValueError):
            client.request("GET", "https://example.test/releases")
        self.assertIsNone(module.NoRedirect().redirect_request(None, None, 302, "redirect", {}, "https://example.test"))


if __name__ == "__main__":
    unittest.main()
