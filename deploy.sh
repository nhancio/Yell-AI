#!/usr/bin/env bash
# Yell AI — canonical deploy script (git.sh has been folded into this file).
#
# Step 1 (push): commit + push the ROOT repo to GitHub.
# Step 2 (deploy): only run a manual platform deploy if GitHub CI/CD is NOT
#                  confirmed to already auto-deploy this push (see notes below).
#
# Usage:
#   ./deploy.sh ["commit message"] [options]
#
# Options:
#   --remote=URL     Set/fix the root repo's 'origin' remote to URL (also
#                     honors $GIT_REMOTE_URL env var).
#   --skip-push       Skip step 1 (git add/commit/push) and go straight to deploy.
#   --skip-deploy     Do step 1 only; don't run the platform deploy step.
#   --force-manual    Force the manual platform deploy even if CI/CD is marked
#                     as confirmed below (kept for when that flips to true).
#   -h, --help        Show this help.
#
# See the NESTED GIT REPOS and CI/CD STATUS notes further down in this file
# for why step 1 excludes frontend/nanoclaw and why step 2 deploys manually.
#
# --------------------------------------------------------------------------
# NESTED GIT REPOS (read this before assuming "push" covers everything):
#
#   This project root has NO git origin configured. Its
#   frontend/ and nanoclaw/ subfolders each carry their OWN, SEPARATE nested
#   .git repos (frontend/ -> github.com/nhancio/myclaw, nanoclaw/ -> its own
#   origin/upstream/whatsapp remotes). A single push from the root CANNOT
#   and does NOT cover them — this script deliberately excludes frontend/
#   and nanoclaw/ from `git add` at the root (so they are never turned into
#   broken gitlink entries) and pushes ONLY the root repo's own tracked
#   files. If you changed anything inside frontend/ or nanoclaw/, commit and
#   push those from inside each folder separately, e.g.:
#     (cd frontend && git add -A && git commit -m "..." && git push)
#     (cd nanoclaw  && git add -A && git commit -m "..." && git push)
#   See context.md for the full writeup of this quirk.
# --------------------------------------------------------------------------
# CI/CD STATUS (why step 2 does what it does):
#
#   Checked for this project: no .github/workflows anywhere under the root
#   or backend/ or frontend/ that build+deploy on push (the only workflows
#   in the whole tree live in nanoclaw/.github/workflows/ and are PR-only
#   CI/lint/test jobs for that vendored upstream fork — irrelevant to
#   deploying Yell AI itself). No netlify.toml or firebase.json exist
#   anywhere. backend/ has vercel.json + a Dockerfile but no workflow wires
#   it to auto-deploy. frontend/ and backend/ each have a .vercel/project.json
#   (just a local CLI project link, not proof of a GitHub-integration
#   auto-deploy). None of that is "confirmed git-linked CI/CD" — so
#   CI_CD_CONFIRMED below is false, and step 2 runs the real manual Vercel
#   deploy. If you later confirm in the Vercel dashboard that GitHub pushes
#   auto-deploy these projects, flip CI_CD_CONFIRMED to true below.
# --------------------------------------------------------------------------

set -euo pipefail

CI_CD_CONFIRMED=false

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

usage() {
    sed -n '1,21p' "${BASH_SOURCE[0]}" | grep -E '^(# |#$)' | sed 's/^# \{0,1\}//'
}

COMMIT_MESSAGE=""
REMOTE_URL="${GIT_REMOTE_URL:-}"
FORCE_MANUAL=false
SKIP_PUSH=false
SKIP_DEPLOY=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help)
            usage
            exit 0
            ;;
        --remote=*)
            REMOTE_URL="${1#*=}"
            ;;
        --force-manual)
            FORCE_MANUAL=true
            ;;
        --skip-push)
            SKIP_PUSH=true
            ;;
        --skip-deploy)
            SKIP_DEPLOY=true
            ;;
        -*)
            echo "Unknown option: $1" >&2
            usage
            exit 1
            ;;
        *)
            COMMIT_MESSAGE="$1"
            ;;
    esac
    shift
done

COMMIT_MESSAGE="${COMMIT_MESSAGE:-Update Yell AI}"

# ---------------------------------------------------------------------------
# Step 1: push (root repo only — see NESTED GIT REPOS note above)
# ---------------------------------------------------------------------------
push_to_git() {
    echo "==> Step 1/2: push (repo root) to GitHub"

    for nested in frontend nanoclaw; do
        if [[ -d "$nested/.git" ]]; then
            echo "NOTE: '$nested/' is its own separate git repo with its own remote(s)."
            echo "      This script only pushes the ROOT repo and will NOT touch $nested/'s history."
            echo "      To push $nested/ changes: (cd $nested && git add -A && git commit -m '...' && git push)"
        fi
    done

    if git remote get-url origin &>/dev/null; then
        local current_remote
        current_remote="$(git remote get-url origin)"
        if [[ -n "$REMOTE_URL" && "$REMOTE_URL" != "$current_remote" ]]; then
            echo "Updating 'origin' remote: $current_remote -> $REMOTE_URL"
            git remote set-url origin "$REMOTE_URL"
        fi
    else
        if [[ -n "$REMOTE_URL" ]]; then
            echo "No 'origin' remote found at repo root. Adding: $REMOTE_URL"
            git remote add origin "$REMOTE_URL"
        else
            echo ""
            echo "No 'origin' remote configured for the ROOT repo."
            echo "Run one of:"
            echo "  ./deploy.sh --remote=https://github.com/<you>/<repo>.git \"commit message\""
            echo "  git remote add origin https://github.com/<you>/<repo>.git"
            echo "then re-run this script."
            return 1
        fi
    fi

    # Stage everything at root EXCEPT the nested repos, so frontend/ and
    # nanoclaw/ are never added as (broken, unregistered) gitlink entries.
    git add -A -- . ':!frontend' ':!nanoclaw'

    git commit -m "$COMMIT_MESSAGE" || echo "Nothing new to commit at repo root."

    local branch
    branch="$(git branch --show-current)"
    if [[ -z "$branch" ]]; then
        echo "Could not determine current branch (detached HEAD?)." >&2
        return 1
    fi

    echo "Pushing branch '$branch' to origin..."
    git push -u origin "$branch"

    echo ""
    echo "Pushed to GitHub: $(git remote get-url origin) ($branch)"
}

# ---------------------------------------------------------------------------
# Step 2: deploy (manual Vercel deploy — CI/CD is not confirmed, see notes above)
# ---------------------------------------------------------------------------
manual_deploy() {
    echo "==> Step 2/2: manual deploy (Vercel: frontend + backend)"

    if [ -z "${DATABASE_URL:-}" ]; then
        echo "DATABASE_URL environment variable is not set."
        echo "Please paste your Cloud SQL PostgreSQL connection string."
        echo "Format: postgresql://<USER>:<PASSWORD>@<IP>:5432/<DB_NAME>"
        read -r -s -p "Enter DATABASE_URL: " USER_INPUT_URL
        echo ""
        if [ -n "$USER_INPUT_URL" ]; then
            export DATABASE_URL="$USER_INPUT_URL"
        else
            echo "Deployment aborted. DATABASE_URL is required."
            exit 1
        fi
    fi

    echo "Running Prisma DB migration..."
    (cd frontend && npx prisma db push --accept-data-loss)

    echo "Deploying Frontend to Vercel..."
    (cd frontend && vercel deploy --prod)

    echo "Deploying Backend API to Vercel..."
    (cd backend && vercel deploy --prod)

    echo ""
    echo "Full manual deployment complete."
}

deploy_step() {
    if [[ "$CI_CD_CONFIRMED" == true && "$FORCE_MANUAL" != true ]]; then
        echo "==> Step 2/2: skipped — GitHub CI/CD is configured to auto-deploy this push."
        echo "    (Re-run with --force-manual to run the manual Vercel deploy anyway.)"
        return 0
    fi

    if [[ "$CI_CD_CONFIRMED" != true ]]; then
        echo "No confirmed auto-deploy CI/CD found for this push (see CI/CD STATUS note"
        echo "at the top of this script), so running the real manual deploy instead."
    fi

    manual_deploy
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if [[ "$SKIP_PUSH" != true ]]; then
    push_to_git
else
    echo "==> Step 1/2: push skipped (--skip-push)"
fi

if [[ "$SKIP_DEPLOY" != true ]]; then
    deploy_step
else
    echo "==> Step 2/2: deploy skipped (--skip-deploy)"
fi
