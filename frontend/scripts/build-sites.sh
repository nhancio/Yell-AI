#!/usr/bin/env bash
# Builds two static sites from one Next.js export:
#   out/      -> yell.nhancio.com     (landing)
#   out-app/  -> yellapp.nhancio.com  (Yell App, phone login)
set -euo pipefail
cd "$(dirname "$0")/.."

npx next build

# Landing: send old Connect Hub links to the app
cat >> out/_redirects <<'EOF'
/connect  https://yellapp.nhancio.com/  301!
/app      https://yellapp.nhancio.com/  301!
EOF

# App site: same assets, app page as the homepage
rm -rf out-app
cp -R out out-app
cp out/app.html out-app/index.html
cat > out-app/_redirects <<'EOF'
/api/*      https://yell-ai-nhancio.web.app/api/:splat  200!
/health     https://yell-ai-nhancio.web.app/health      200!
/connect    /   301!
/app        /   301!
/*          /index.html  200
EOF
echo "Built out/ (landing) and out-app/ (app)"
