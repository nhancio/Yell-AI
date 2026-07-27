/**
 * Generates cloud-init user data for an Ubuntu EC2 instance.
 * The instance will install NanoClaw, fetch config from Yell AI API, and start the agent with WhatsApp.
 */
export function buildUserData(configToken: string, appUrl: string): string {
  const configUrl = `${appUrl.replace(/\/$/, "")}/api/deploy/config?token=${encodeURIComponent(configToken)}`;
  return `#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get upgrade -y

# Install Docker (required for NanoClaw container isolation)
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
usermod -aG docker ubuntu

# Install NVM and Node 22 for ubuntu user
sudo -u ubuntu bash << 'UBUNTU_INSTALL'
set -e
export HOME=/home/ubuntu
cd ~
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 22
nvm use 22
nvm alias default 22
npm install -g nanoclaw@latest
if ! grep -q 'NVM_DIR' ~/.bashrc; then
  echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.bashrc
  echo '[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"' >> ~/.bashrc
fi
UBUNTU_INSTALL

loginctl enable-linger ubuntu
systemctl start user@1000.service || true

# Fetch config from Yell AI API
CONFIG_URL="${configUrl}"
mkdir -p /home/ubuntu/.nanoclaw
RESP=$(curl -sf "$CONFIG_URL" || echo '{}')
if [ "$RESP" = "{}" ]; then
  echo "Failed to fetch config from Yell AI"
  exit 1
fi

# Write nanoclaw.json and .env (API keys)
echo "$RESP" | python3 -c "
import json, sys
data = json.load(sys.stdin)
nc = data.get('nanoclawJson', {})
with open('/home/ubuntu/.nanoclaw/nanoclaw.json', 'w') as f:
  json.dump(nc, f, indent=2)
env = data.get('env', {})
with open('/home/ubuntu/.nanoclaw/.env', 'w') as f:
  for k, v in env.items():
    f.write('%s=%s\n' % (k, v))
" || exit 1
chown -R ubuntu:ubuntu /home/ubuntu/.nanoclaw

# Run onboarding non-interactively (creates agent, etc.)
sudo -H -u ubuntu bash << 'ONBOARD'
export HOME=/home/ubuntu
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
set -a
[ -f /home/ubuntu/.nanoclaw/.env ] && . /home/ubuntu/.nanoclaw/.env
set +a
nanoclaw onboard --non-interactive --accept-risk --mode local --auth-choice apiKey --gateway-port 18789 --gateway-bind 0.0.0.0 --skip-daemon --skip-skills || true
ONBOARD

# Merge our nanoclaw.json (WhatsApp config) again after onboard may have overwritten
curl -sf "$CONFIG_URL" | python3 -c "
import json, sys
data = json.load(sys.stdin)
nc = data.get('nanoclawJson', {})
path = '/home/ubuntu/.nanoclaw/nanoclaw.json'
try:
  with open(path) as f:
    existing = json.load(f)
except: existing = {}
for k, v in nc.items():
  existing[k] = v
with open(path, 'w') as f:
  json.dump(existing, f, indent=2)
" || true
chown -R ubuntu:ubuntu /home/ubuntu/.nanoclaw

# Install and start daemon with WhatsApp channel enabled
sudo -H -u ubuntu XDG_RUNTIME_DIR=/run/user/1000 bash -c '
export HOME=/home/ubuntu
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
set -a
[ -f /home/ubuntu/.nanoclaw/.env ] && . /home/ubuntu/.nanoclaw/.env
set +a
nanoclaw daemon install || true
'
sudo -H -u ubuntu XDG_RUNTIME_DIR=/run/user/1000 bash -c '
export HOME=/home/ubuntu
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
set -a
[ -f /home/ubuntu/.nanoclaw/.env ] && . /home/ubuntu/.nanoclaw/.env
set +a
nanoclaw daemon start
' || true

echo "NanoClaw setup complete — user can pair WhatsApp via gateway"
`;
}
