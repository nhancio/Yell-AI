"""Exercise deploy.sh against real disposable Git repos; cloud/build tools are fakes."""

import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "deploy.sh"


class DeployWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="astra deploy test ")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.repo, self.remote = self.root / "repo", self.root / "origin.git"
        self.repo.mkdir()
        self.trace = self.root / "trace"
        self.env = {**os.environ, "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": os.devnull,
                    "DEPLOY_TEST_TRACE": str(self.trace), "DEPLOY_TEST_STATE": str(self.root / "state.json"),
                    "DEPLOY_TEST_REPO": str(self.repo)}
        for key in ("GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES"):
            self.env.pop(key, None)
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_GET(self):
                if self.path == "/ready":
                    checks = {"database": "ok" if self.server.database_ok else "unavailable",
                              "memory": "ok" if self.server.redis_ok else "unavailable"}
                    code, body = (200 if all(v == "ok" for v in checks.values()) else 503), {"checks": checks}
                elif self.path == "/api/brands/campaigns":
                    code, body = 403, {}
                else:
                    code, body = 200, {"status": "healthy"}
                self.send_response(code); self.end_headers(); self.wfile.write(json.dumps(body).encode())

            def do_POST(self):
                self.send_response(200 if self.server.login_open else 401)
                self.end_headers(); self.wfile.write(b'{}')

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.server.database_ok = self.server.redis_ok = True
        self.server.login_open = False
        threading.Thread(target=lambda: self.server.serve_forever(poll_interval=0.02), daemon=True).start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)
        self.env["DEPLOY_TEST_PREVIEW_URL"] = f"http://127.0.0.1:{self.server.server_port}"
        self.env["DEPLOY_TEST_PYTHON"] = os.sys.executable
        self.git("init", "--bare", "--initial-branch=main", str(self.remote))
        self.git("init", "--initial-branch=main")
        self.git("config", "user.email", "deploy@example.test")
        self.git("config", "user.name", "Deploy test")
        self.git("config", "commit.gpgsign", "false")
        shutil.copy2(SCRIPT, self.repo / "deploy.sh")
        (self.repo / ".gitignore").write_text("backend/.venv/\n")
        (self.repo / "backend").mkdir()
        (self.repo / "backend/app.py").write_text("base = True\n")
        (self.repo / "frontend/tests").mkdir(parents=True)
        (self.repo / "frontend/package.json").write_text("{}\n")
        self.git("add", ".")
        self.git("commit", "-m", "Initial")
        self.git("remote", "add", "origin", str(self.remote))
        self.git("push", "-u", "origin", "main")
        mock_bin = self.root / "bin"
        mock_bin.mkdir()
        self.env["PATH"] = str(mock_bin) + os.pathsep + os.environ["PATH"]
        self.tool(mock_bin / "npm", '''#!/bin/sh
printf 'npm %s\n' "$*" >> "$DEPLOY_TEST_TRACE"
if [ "${DEPLOY_TEST_FAIL_BUILD:-0}" = 1 ] && [ "$1" = run ]; then exit 1; fi
if [ "${DEPLOY_TEST_CHANGE_CHECKOUT:-0}" = 1 ] && [ "$1" = run ]; then
    git -C "$DEPLOY_TEST_REPO" commit --allow-empty -m 'Concurrent change' >/dev/null
fi
''')
        self.tool(mock_bin / "npx", '''#!/bin/sh
printf 'npx %s\n' "$*" >> "$DEPLOY_TEST_TRACE"
''')
        self.tool(mock_bin / "gcloud", '''#!/usr/bin/env python3
import json,os,sys
from pathlib import Path
a=sys.argv[1:];state=Path(os.environ['DEPLOY_TEST_STATE'])
with open(os.environ['DEPLOY_TEST_TRACE'],'a') as f:f.write('gcloud '+' '.join(a)+'\\n')
if a[:2]==['run','deploy']:
 tag=a[a.index('--tag')+1] if '--tag' in a else 'legacy';state.write_text(json.dumps({'status':{'traffic':[{'tag':tag,'url':os.environ['DEPLOY_TEST_PREVIEW_URL'],'revisionName':'test-revision'}]}}))
elif a[:3]==['run','services','describe']:
 print(state.read_text())
''')
        python = self.repo / "backend/.venv/bin/python"
        python.parent.mkdir(parents=True)
        self.tool(python, '''#!/bin/sh
printf 'backend-python %s\n' "$*" >> "$DEPLOY_TEST_TRACE"
if [ "${DEPLOY_TEST_FAIL_TESTS:-0}" = 1 ]; then exit 1; fi
if [ "$1" = - ]; then exec "$DEPLOY_TEST_PYTHON" "$@"; fi
''')

    @staticmethod
    def tool(path, contents):
        path.write_text(contents)
        path.chmod(0o755)

    def git(self, *args, cwd=None, check=True):
        return subprocess.run(["git", *args], cwd=cwd or self.repo, env=self.env,
                              capture_output=True, text=True, check=check)

    def feature(self, name, path="backend/feature.txt", text="feature\n", push=False):
        self.git("switch", "-c", name, "main")
        (self.repo / path).write_text(text)
        self.git("add", path)
        self.git("commit", "-m", name)
        tip = self.git("rev-parse", "HEAD").stdout.strip()
        if push:
            self.git("push", "-u", "origin", name)
        self.git("switch", "main")
        return tip

    def deploy(self, **overrides):
        return subprocess.run(["bash", "deploy.sh"], cwd=self.repo,
                              env={**self.env, **overrides}, capture_output=True, text=True, timeout=30)

    def branches(self):
        return self.git("for-each-ref", "--format=%(refname:short)", "refs/heads").stdout.splitlines()

    def remote_branches(self):
        return [line.split()[1] for line in self.git("ls-remote", "--heads", "origin").stdout.splitlines()]

    def assert_not_deployed(self):
        log = self.trace.read_text() if self.trace.exists() else ""
        self.assertNotIn("gcloud run deploy", log)
        self.assertNotIn("npx ", log)

    def test_merges_every_local_branch_deletes_only_after_validation_and_pushes_main(self):
        a = self.feature("feature/one", "backend/one.txt", push=True)
        b = self.feature("feature/two", "backend/two.txt")
        self.git("switch", "feature/two")
        result = self.deploy()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.branches(), ["main"])
        self.assertEqual(self.remote_branches(), ["refs/heads/main"])
        for tip in (a, b):
            self.git("merge-base", "--is-ancestor", tip, "main")
        self.assertEqual(self.git("rev-parse", "main").stdout, self.git("rev-parse", "origin/main").stdout)
        self.assertEqual(self.git("status", "--porcelain").stdout, "")
        self.assertIn("gcloud run deploy", self.trace.read_text())

    def test_pending_edits_and_new_files_are_committed_and_deployed(self):
        (self.repo / "backend/app.py").write_text("edited = True\n")
        (self.repo / "backend/new.txt").write_text("new\n")
        result = self.deploy()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.git("status", "--porcelain").stdout, "")
        self.assertEqual(self.git("show", "origin/main:backend/app.py").stdout, "edited = True\n")
        self.assertIn("backend/new.txt", self.git("ls-tree", "-r", "--name-only", "origin/main").stdout)
        self.assertIn("gcloud run deploy", self.trace.read_text())

    def test_failed_validation_keeps_the_auto_commit_local(self):
        (self.repo / "backend/app.py").write_text("broken = True\n")
        before = self.git("rev-parse", "origin/main").stdout
        self.assertNotEqual(self.deploy(DEPLOY_TEST_FAIL_TESTS="1").returncode, 0)
        self.assertEqual(self.git("show", "main:backend/app.py").stdout, "broken = True\n")
        self.assertEqual(self.git("rev-parse", "origin/main").stdout, before)
        self.assert_not_deployed()

    def test_ignored_files_are_never_committed(self):
        (self.repo / "backend/.venv/secret.env").write_text("TOKEN=x\n")
        result = self.deploy()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertNotIn(".venv", self.git("ls-tree", "-r", "--name-only", "origin/main").stdout)

    def test_merge_conflict_preserves_both_branches_and_aborts_the_failed_merge(self):
        self.feature("feature/one", "backend/app.py", "one = True\n")
        self.feature("feature/two", "backend/app.py", "two = True\n")
        self.assertNotEqual(self.deploy().returncode, 0)
        self.assertEqual(self.branches(), ["feature/one", "feature/two", "main"])
        self.assertEqual(self.git("status", "--porcelain").stdout, "")
        self.assert_not_deployed()

    def test_validation_failure_keeps_source_branches_and_remote_main(self):
        self.feature("feature/one")
        before = self.git("rev-parse", "origin/main").stdout
        self.assertNotEqual(self.deploy(DEPLOY_TEST_FAIL_BUILD="1").returncode, 0)
        self.assertIn("feature/one", self.branches())
        self.assertEqual(self.git("rev-parse", "origin/main").stdout, before)
        self.assert_not_deployed()

    def test_main_changed_during_validation_is_not_pushed_or_cleaned_up(self):
        self.feature("feature/one")
        before = self.git("rev-parse", "origin/main").stdout
        self.assertNotEqual(self.deploy(DEPLOY_TEST_CHANGE_CHECKOUT="1").returncode, 0)
        self.assertIn("feature/one", self.branches())
        self.assertEqual(self.git("rev-parse", "origin/main").stdout, before)
        self.assert_not_deployed()

    def test_remote_only_branch_is_merged_deployed_then_deleted(self):
        tip = self.feature("remote-only", "backend/remote.txt", push=True)
        self.git("branch", "-D", "remote-only")
        result = self.deploy()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.git("merge-base", "--is-ancestor", tip, "origin/main")
        self.assertEqual(self.remote_branches(), ["refs/heads/main"])
        self.assertIn("gcloud run deploy", self.trace.read_text())

    def test_remote_only_branch_conflict_stops_before_push_or_deployment(self):
        self.feature("remote-only", "backend/app.py", "remote = True\n", push=True)
        self.git("branch", "-D", "remote-only")
        self.feature("feature/local", "backend/app.py", "local = True\n")
        self.assertNotEqual(self.deploy().returncode, 0)
        self.assertIn("refs/heads/remote-only", self.remote_branches())
        self.assert_not_deployed()

    def test_main_push_rejection_stops_before_deployment(self):
        self.feature("feature/one")
        self.tool(self.remote / "hooks/pre-receive", "#!/bin/sh\nexit 1\n")
        self.assertNotEqual(self.deploy().returncode, 0)
        self.assert_not_deployed()

    def assert_not_promoted(self):
        log = self.trace.read_text()
        self.assertNotIn("update-traffic", log)
        self.assertNotIn("npx ", log)

    def test_database_failure_prevents_promotion_and_website_deployment(self):
        self.server.database_ok = False
        self.assertNotEqual(self.deploy().returncode, 0)
        self.assert_not_promoted()

    def test_broken_login_gate_prevents_promotion_and_website_deployment(self):
        self.server.login_open = True
        self.assertNotEqual(self.deploy().returncode, 0)
        self.assert_not_promoted()

    def test_required_redis_failure_prevents_promotion_and_website_deployment(self):
        self.server.redis_ok = False
        self.assertNotEqual(self.deploy(REQUIRE_REDIS="1").returncode, 0)
        self.assert_not_promoted()

    def test_existing_redis_fallback_is_explicitly_reported_when_allowed(self):
        self.server.redis_ok = False
        result = self.deploy(REQUIRE_REDIS="0")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("shared memory", result.stderr)

    def test_branch_checked_out_elsewhere_is_not_force_deleted(self):
        self.feature("feature/one", push=True)
        self.git("worktree", "add", str(self.root / "other worktree"), "feature/one")
        upstream = self.git("for-each-ref", "--format=%(upstream)", "refs/heads/feature/one").stdout
        self.assertNotEqual(self.deploy().returncode, 0)
        self.assertIn("feature/one", self.branches())
        self.assertEqual(self.git("for-each-ref", "--format=%(upstream)", "refs/heads/feature/one").stdout, upstream)
        self.assert_not_deployed()


if __name__ == "__main__":
    unittest.main()
