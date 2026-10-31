#!/usr/bin/env bash
set -euo pipefail
set +x # Never trace credential values, even when invoked with bash -x.

# Merge -> validate -> delete merged branches -> push main -> check origin -> deploy.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="${FIREBASE_PROJECT:-yell-ai-nhancio}"
ACCOUNT="${FIREBASE_ACCOUNT:-nithindidigam@nhancio.com}"
REGION="${CLOUD_RUN_REGION:-asia-south1}"
REQUIRE_REDIS="${REQUIRE_REDIS:-0}"
GITHUB_ACCOUNT="${GITHUB_ACCOUNT:-didigamnithin}"
DEPLOY_WAIT_SECONDS="${DEPLOY_WAIT_SECONDS:-1800}"
BACKEND_PYTHON="${BACKEND_PYTHON:-$DIR/backend/.venv/bin/python}"
github_token=""
export -n github_token

die() { printf 'Deployment stopped: %s\n' "$*" >&2; exit 1; }

git_remote() {
    if [[ -n "$github_token" ]]; then
        GH_TOKEN="$github_token" git -c credential.helper= \
            -c 'credential.helper=!gh auth git-credential' "$@"
    else
        git "$@"
    fi
}

merge_ref() {
    if ! git merge --no-edit "$1"; then
        git merge --abort 2>/dev/null || true
        die "Resolve the merge of $1 into main, then rerun. Source branches were retained."
    fi
}

# Uncommitted edits made mid-release are harmless: the release is a frozen git archive.
verify_checkout() {
    [[ "$(git symbolic-ref --short HEAD)" == main && "$(git rev-parse HEAD)" == "$commit" ]] \
        || die "The checkout changed during release. Commit the new work and rerun."
}

# Untracked files never ship (git archive), so only tracked edits block the merge.
# Another session may still be editing: wait for its commit instead of failing.
wait_for_commit() {
    local waited=0
    while [[ -n "$(git status --porcelain --untracked-files=no)" ]]; do
        if (( waited == 0 )); then
            printf 'Waiting for these edits to be committed (Ctrl-C to cancel):\n'
            git status --short --untracked-files=no
        fi
        (( waited < DEPLOY_WAIT_SECONDS )) \
            || die "Tracked edits are still uncommitted after ${DEPLOY_WAIT_SECONDS}s. Commit them and rerun."
        sleep 20
        waited=$((waited + 20))
    done
}

verify_main() {
    local heads
    [[ "$(git for-each-ref --format='%(refname)' refs/heads)" == refs/heads/main ]] \
        || die "Local branches other than main still exist."
    verify_checkout
    heads="$(git_remote ls-remote --heads origin)"
    [[ "$heads" == "$commit"$'\t'refs/heads/main ]] \
        || die "Origin must contain only main, at the exact release commit."
}

main() {
    cd "$DIR"
    [[ $# == 0 ]] || die "Run ./deploy.sh with no arguments."
    for tool in git python3 npm npx gcloud; do
        command -v "$tool" >/dev/null || die "Required command missing: $tool"
    done
    [[ "$BACKEND_PYTHON" == /* ]] || BACKEND_PYTHON="$DIR/$BACKEND_PYTHON"
    [[ -x "$BACKEND_PYTHON" ]] || die "Set up backend/.venv or set BACKEND_PYTHON."
    [[ "$REQUIRE_REDIS" == 0 || "$REQUIRE_REDIS" == 1 ]] || die "REQUIRE_REDIS must be 0 or 1."
    # Python.org builds on macOS ship without CA certs; the smoke check needs them.
    if [[ -z "${SSL_CERT_FILE:-}" ]]; then
        cert_file="$("$BACKEND_PYTHON" -c 'import certifi; print(certifi.where())' 2>/dev/null || true)"
        [[ -z "$cert_file" ]] || export SSL_CERT_FILE="$cert_file"
    fi
    wait_for_commit
    for state in MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD rebase-merge rebase-apply; do
        [[ ! -e "$(git rev-parse --git-path "$state")" ]] || die "Finish the existing Git operation first."
    done
    git show-ref --verify --quiet refs/heads/main || die "Local main does not exist."
    origin_url="$(git remote get-url origin)"
    if [[ "$origin_url" == https://github.com/* ]] && command -v gh >/dev/null; then
        github_token="$(gh auth token --hostname github.com --user "$GITHUB_ACCOUNT")" \
            || die "GitHub credentials unavailable for $GITHUB_ACCOUNT."
    fi

    printf '\n==> 1/5 Merge local branches into main\n'
    git_remote fetch --prune origin
    git checkout main
    if git show-ref --verify --quiet refs/remotes/origin/main; then
        merge_ref refs/remotes/origin/main
    fi
    branches="$(git for-each-ref --format='%(refname)' refs/heads)"
    while IFS= read -r ref; do
        [[ -z "$ref" || "$ref" == refs/heads/main ]] || merge_ref "$ref"
    done <<< "$branches"
    commit="$(git rev-parse HEAD)"

    # Freeze the merged commit. Concurrent edits cannot enter the deployed artifact.
    release_dir="$(mktemp -d "${TMPDIR:-/tmp}/astra-release.XXXXXX")"
    trap 'rm -rf -- "$release_dir"' EXIT
    git archive "$commit" | tar -x -C "$release_dir"
    printf '\n==> Validate the merged release before deleting or pushing anything\n'
    (cd "$release_dir" && "$BACKEND_PYTHON" -m unittest discover -s tests)
    (
        cd "$release_dir/backend"
        ENVIRONMENT=test DATABASE_URL='sqlite+aiosqlite:///:memory:' \
            BACKEND_DATABASE_URL='sqlite+aiosqlite:///:memory:' \
            "$BACKEND_PYTHON" -m unittest discover -s tests
    )
    (
        cd "$release_dir/frontend"
        npm ci
        NEXT_PUBLIC_BACKEND_URL='' npm run build:sites
        "$BACKEND_PYTHON" -m unittest discover -s tests
    )

    printf '\n==> 2/5 Delete local branches only after they are merged and validated\n'
    verify_checkout
    worktrees="$(git worktree list --porcelain)"
    while IFS= read -r ref; do
        [[ -n "$ref" && "$ref" != refs/heads/main ]] || continue
        branch="${ref#refs/heads/}"
        git merge-base --is-ancestor "$ref" refs/heads/main || die "$branch moved and is not merged."
        while IFS= read -r line; do
            [[ "$line" != "branch $ref" ]] || die "$branch is checked out in another worktree; release it there first."
        done <<< "$worktrees"
        if [[ -n "$(git for-each-ref --format='%(upstream)' "$ref")" ]]; then
            git branch --unset-upstream "$branch"
        fi
        git branch -d -- "$branch" || die "Cannot delete $branch; check its other worktrees. No force deletion was used."
    done <<< "$branches"

    printf '\n==> 3/5 Push main to origin\n'
    verify_checkout
    git_remote push origin refs/heads/main:refs/heads/main

    printf '\n==> 4/5 Ensure origin has no branches other than main\n'
    git_remote fetch --prune origin
    heads="$(git_remote ls-remote --heads origin)"
    while read -r oid ref; do
        [[ -n "$ref" && "$ref" != refs/heads/main ]] || continue
        git merge-base --is-ancestor "$oid" refs/heads/main \
            || die "$ref has remote-only unmerged work. Merge it locally and rerun; it was not deleted."
    done <<< "$heads"
    while read -r oid ref; do
        [[ -n "$ref" && "$ref" != refs/heads/main ]] || continue
        # Conditional deletion only: reject a remote branch that changed since inspection.
        git_remote push "--force-with-lease=$ref:$oid" origin ":$ref"
    done <<< "$heads"
    git_remote fetch --prune origin
    verify_main

    printf '\n==> 5/5 Deploy verified main commit %s\n' "$commit"
    tag="release-${commit:0:12}"
    # Keep existing Cloud SQL, environment, IAM and Secret Manager configuration.
    gcloud run deploy yell-ai-api --source "$release_dir/backend" \
        --labels "git-sha=$commit,release-branch=main" --no-traffic --tag "$tag" \
        --region "$REGION" --project "$PROJECT" --account "$ACCOUNT" --quiet
    staged="$(gcloud run services describe yell-ai-api --region "$REGION" \
        --project "$PROJECT" --account "$ACCOUNT" \
        --format='json(status.traffic)' | python3 -c '
import json,sys
entry=next(t for t in json.load(sys.stdin)["status"]["traffic"] if t.get("tag")==sys.argv[1])
print(entry["revisionName"],entry["url"])
' "$tag")"
    read -r revision preview_url <<< "$staged"
    "$BACKEND_PYTHON" - "$preview_url" "$REQUIRE_REDIS" <<'PY'
import json,sys
from urllib.request import Request,urlopen
from urllib.error import HTTPError

def request(path,method="GET"):
    try:
        with urlopen(Request(sys.argv[1]+path,method=method),timeout=30) as response:
            return response.status,json.load(response)
    except HTTPError as error:
        return error.code,json.load(error)

ready_status,ready=request("/ready")
dependencies=ready.get("checks",{})
checks={"health":request("/health")[0],"login_gate":request("/api/me/session","POST")[0],
        "campaign_admin_gate":request("/api/brands/campaigns")[0],"dependencies":dependencies}
print(json.dumps(checks))
healthy=ready_status==200 and dependencies=={"database":"ok","memory":"ok"}
fallback=(sys.argv[2]=="0" and ready_status==503
          and dependencies=={"database":"ok","memory":"unavailable"})
if not (healthy or fallback) or (checks["health"],checks["login_gate"],checks["campaign_admin_gate"])!=(200,401,403):
    raise SystemExit("Backend smoke checks failed; live traffic was not changed.")
if fallback:
    print("Warning: shared memory is unavailable. Set REQUIRE_REDIS=1 to block this release.",file=sys.stderr)
PY
    verify_main
    gcloud run services update-traffic yell-ai-api --to-revisions "$revision=100" \
        --remove-tags "$tag" --region "$REGION" --project "$PROJECT" --account "$ACCOUNT" --quiet
    (
        cd "$release_dir"
        npx -y firebase-tools@latest deploy --only hosting:astra --project "$PROJECT" \
            --account "$ACCOUNT" --non-interactive --message "main-$commit"
    )
    verify_main
    printf '\nDeployed main %s to https://tryastra.web.app\n' "$commit"
    exit 0
}

# Parse the function before any checkout/merge can replace this script on disk.
main "$@"
