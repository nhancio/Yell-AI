#!/usr/bin/env bash
# Builds unified Astra AI static export (Landing + in-place App Hub):
#   out/ -> tryastra.web.app & astra.nhancio.com
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf out out-app
npx next build
echo "Built unified out/ (Astra AI Landing + App)"
