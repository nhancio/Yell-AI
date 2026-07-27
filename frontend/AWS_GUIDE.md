# AWS setup guide for Yell AI

This guide walks you through getting every AWS value you need and filling it into your `.env` so Yell AI can provision real EC2 instances.

---

## Overview: what you need

| Env variable | Where you get it |
|--------------|-------------------|
| `AWS_ACCESS_KEY_ID` | IAM → Create access key |
| `AWS_SECRET_ACCESS_KEY` | Same (shown once when you create the key) |
| `AWS_REGION` | Pick one, e.g. `us-east-1` |
| `YELLAI_SUBNET_ID` | VPC → Subnets → your public subnet |
| `YELLAI_SECURITY_GROUP_ID` | VPC → Security groups → create one |
| `YELLAI_KEY_NAME` | EC2 → Key Pairs → create one |
| `YELLAI_APP_URL` | Your app’s URL (ngrok or production) |

Optional: `YELLAI_VPC_ID` (only if you want to restrict to a specific VPC later), `YELLAI_IAM_INSTANCE_PROFILE` (for an IAM role on the instance).

---

## 1. IAM user and access keys

Yell AI needs an IAM user with permission to create and describe EC2 instances.

### 1.1 Create an IAM user (if you don’t have one)

1. In the AWS Console, go to **IAM** → **Users** → **Create user**.
2. User name: e.g. `yellai-deploy`.
3. **Next** → Attach policies directly → search and select **AmazonEC2FullAccess** (or a custom policy that allows `ec2:RunInstances`, `ec2:DescribeInstances`, `ec2:DescribeImages`, `ec2:DescribeSubnets`, `ec2:DescribeSecurityGroups`, `ec2:DescribeKeyPairs`).
4. **Next** → **Create user**.

### 1.2 Create access key for that user

1. Open the user → **Security credentials** tab.
2. **Access keys** → **Create access key**.
3. Use case: **Command Line Interface (CLI)** (or “Application running outside AWS”).
4. **Next** → **Create access key**.
5. Copy the **Access key ID** → put in `.env` as `AWS_ACCESS_KEY_ID`.
6. Copy the **Secret access key** → put in `.env` as `AWS_SECRET_ACCESS_KEY`.  
   You won’t see the secret again, so save it now.

---

## 2. Region

Pick the region where you want EC2 instances (e.g. `us-east-1`, `ap-south-1`).

In `.env`:

```env
AWS_REGION=us-east-1
```

Make sure all following steps (VPC, subnet, security group, key pair) are done in the **same region** (check the region selector in the top-right of the AWS Console).

---

## 3. VPC and subnet

EC2 instances must run in a subnet. Use the **default VPC** (and its default public subnet) for the simplest setup.

### 3.1 Get subnet ID (easiest: default VPC)

1. Go to **VPC** → **Subnets** (in the same region as step 2).
2. Find a subnet that has **“Default”** in the VPC column and **“Yes”** for “Auto-assign public IP” (or create a new subnet in the default VPC with public IP).
3. Copy the **Subnet ID** (e.g. `subnet-0abc123def456`).

In `.env`:

```env
YELLAI_SUBNET_ID=subnet-0abc123def456
```

### 3.2 (Optional) Note your VPC ID

If you use the default VPC, you can leave `YELLAI_VPC_ID` unset. If you use a custom VPC, copy its **VPC ID** (e.g. `vpc-0xyz789`) and set:

```env
YELLAI_VPC_ID=vpc-0xyz789
```

---

## 4. Security group

Create a security group that allows the instance to be reached (SSH for debugging, optional gateway port) and to reach the internet (for install and config fetch).

### 4.1 Create security group

1. Go to **VPC** → **Security groups** → **Create security group**.
2. Name: e.g. `yellai-ec2-sg`.
3. VPC: select the same VPC as your subnet (e.g. default VPC).
4. **Inbound rules** — add:

   | Type   | Port  | Source     | Description        |
   |--------|-------|------------|--------------------|
   | SSH    | 22    | My IP      | Optional, for SSH  |
   | Custom TCP | 18789 | 0.0.0.0/0 | Optional, NanoClaw gateway |

   For maximum lock-down, use **My IP** for SSH and omit 18789 (you can use SSH tunnel or Tailscale to reach the gateway).

5. **Outbound rules** — leave the default rule: **All traffic**, **0.0.0.0/0** (so the instance can install packages and call your Yell AI API).

6. **Create security group**.

### 4.2 Copy security group ID

From the security group list, copy the **Security group ID** (e.g. `sg-0123456789abcdef0`).

In `.env`:

```env
YELLAI_SECURITY_GROUP_ID=sg-0123456789abcdef0
```

---

## 5. EC2 key pair (for SSH)

You need a key pair so you can SSH into the instance if needed.

### 5.1 Create key pair

1. Go to **EC2** → **Key Pairs** (under “Network & Security”) → **Create key pair**.
2. Name: e.g. `yellai-key`.
3. Key pair type: **RSA**.
4. Private key format: **.pem** (for SSH on Mac/Linux).
5. **Create key pair** — a `.pem` file will download. Store it somewhere safe and never commit it.

### 5.2 Use the key pair name in .env

Use the **name** you gave the key (e.g. `yellai-key`), not the file path.

In `.env`:

```env
YELLAI_KEY_NAME=yellai-key
```

---

## 6. App URL (`YELLAI_APP_URL`)

The EC2 instance must be able to call your Yell AI app to fetch config (`GET /api/deploy/config?token=...`).

- **Local dev:** Use a tunnel so the instance can reach your machine, e.g. [ngrok](https://ngrok.com/):
  ```bash
  ngrok http 3000
  ```
  Then set in `.env`:
  ```env
  YELLAI_APP_URL=https://your-subdomain.ngrok.io
  ```
- **Production:** Use your real app URL, e.g.:
  ```env
  YELLAI_APP_URL=https://yellai.yourdomain.com
  ```

Restart your Yell AI app after changing `.env` so the new value is used when new instances are launched.

---

## 7. Optional: instance type and AMI

- **Instance type** (default `t3.medium`):
  ```env
  YELLAI_EC2_INSTANCE_TYPE=t3.medium
  ```
  Don’t use `t3.micro` (too little memory for NanoClaw). `t3.small` is minimum; `t3.medium` is recommended.

- **AMI owner** (default is Ubuntu/Canonical):
  ```env
  YELLAI_EC2_AMI_OWNER=099720109477
  ```
  Usually leave this as-is.

- **AMI ID** (optional, use if auto-detect fails):
  If you see *"The image id 'ami-...' does not exist"* or *"No Ubuntu 24.04 AMI found"*, set a valid Ubuntu 24.04 AMI for your region:
  ```env
  YELLAI_EC2_AMI_ID=ami-0xxxxxxxx
  ```
  To find one: **EC2** → **AMIs** (left menu) → **Create image** is not needed; instead go to **Launch instance** → pick **Ubuntu Server 24.04 LTS** and note the **AMI ID** shown (e.g. `ami-0abcd1234...`), then cancel. Put that ID in `YELLAI_EC2_AMI_ID`.

---

## 8. Example `.env` (AWS section)

After following the guide, your `.env` AWS section might look like:

```env
# AWS (for EC2 provisioning)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
YELLAI_SUBNET_ID=subnet-0abc123def456
YELLAI_SECURITY_GROUP_ID=sg-0123456789abcdef0
YELLAI_KEY_NAME=yellai-key
YELLAI_APP_URL=https://abc123.ngrok.io
```

Leave `YELLAI_VPC_ID` and `YELLAI_IAM_INSTANCE_PROFILE` empty unless you need them.

---

## 9. Debug: what’s happening during deploy

When you click **Deploy NanoClaw**, watch the **terminal** where `npm run dev` is running. You’ll see lines like:

- `[Yell AI deploy] Starting deployment cmlul678...`
- `[Yell AI deploy] Status set to provisioning`
- `[Yell AI deploy] Calling launchInstance (AMI lookup + RunInstances)...`
- `[Yell AI EC2] EC2 config` — shows region, subnet, security group, key name (or "(not set)")
- `[Yell AI EC2] Fetching Ubuntu AMI...` → `Using AMI { imageId }`
- `[Yell AI EC2] Calling RunInstances...` → `RunInstances success { instanceId, publicIp }`
- `[Yell AI deploy] launchInstance returned` → then `Updating deployment: configuring` → `ready`

If it **stops** after “Calling launchInstance” or “Fetching Ubuntu AMI”, the hang or failure is in AWS (network, permissions, or invalid subnet/sg/key). Any error is logged as `[Yell AI deploy] Deployment failed` and saved in **Your deployments** as the red error message.

To turn off these logs, set `YELLAI_DEBUG=false` in `.env`.

---

## 10. Test a deployment

1. Restart your Yell AI app (`npm run dev` or your production process).
2. In the dashboard, enter your AI API key and WhatsApp credentials, then click **Deploy NanoClaw**.
3. In **Your deployments**, the status should move from **provisioning** to **configuring** to **ready** (no more “AWS not configured” message).
4. In AWS **EC2** → **Instances**, you should see a new instance with name like `yellai-xxxxxxxx`. You can use the key pair and its public IP to SSH in if needed.

---

## 11. Troubleshooting

| Issue | What to check |
|-------|----------------|
| **The image id 'ami-...' does not exist** or **No Ubuntu 24.04 AMI found** | Your region may use different AMI names. Set `YELLAI_EC2_AMI_ID` in `.env` to a valid Ubuntu 24.04 AMI: in AWS Console → EC2 → Launch instance → choose **Ubuntu Server 24.04 LTS** → copy the AMI ID shown → put it in `.env`, then redeploy. |
| Stuck at “provisioning” | Watch the terminal for `[Yell AI deploy]` and `[Yell AI EC2]` logs. If it stops after “Calling launchInstance” or “Fetching Ubuntu AMI”, check AWS credentials, subnet/security group/key in the same region, and IAM EC2 permissions. Refresh the dashboard; if the backend failed, status may show “failed” with an error message. |
| “AWS not configured” still shown | Ensure `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are set and the app was restarted. |
| Instance fails to launch | IAM user has EC2 permissions; subnet and security group are in the same region; key pair name matches exactly. |
| Instance starts but never becomes “ready” | Instance needs to reach `YELLAI_APP_URL`. If you’re on localhost, use ngrok and set `YELLAI_APP_URL` to the ngrok URL. Check security group outbound allows HTTPS. |
| Can’t SSH | Security group allows SSH (port 22) from your IP; you’re using the correct `.pem` and key name. |

---

## Summary checklist

- [ ] IAM user created with EC2 permissions; access key and secret in `.env`
- [ ] `AWS_REGION` set (e.g. `us-east-1`)
- [ ] `YELLAI_SUBNET_ID` = a public subnet in that region
- [ ] Security group created with outbound allowed, inbound SSH (and optionally 18789); `YELLAI_SECURITY_GROUP_ID` set
- [ ] Key pair created; `YELLAI_KEY_NAME` = key pair name
- [ ] `YELLAI_APP_URL` = URL the instance can reach (ngrok or production)
- [ ] App restarted, then deploy from the dashboard
