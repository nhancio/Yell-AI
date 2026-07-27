import {
  EC2Client,
  RunInstancesCommand,
  DescribeInstancesCommand,
  DescribeImagesCommand,
} from "@aws-sdk/client-ec2";
import type { RunInstancesCommandInput } from "@aws-sdk/client-ec2";
import { buildUserData } from "./userData";

const region = process.env.AWS_REGION ?? "us-east-1";
const amiOwner = process.env.YELLAI_EC2_AMI_OWNER ?? "099720109477";
const instanceType = process.env.YELLAI_EC2_INSTANCE_TYPE ?? "t3.medium";
const appUrl = process.env.YELLAI_APP_URL ?? "http://localhost:3000";

const DEBUG = process.env.YELLAI_DEBUG !== "false";
const P = "[Yell AI EC2]";

function log(msg: string, data?: object) {
  if (DEBUG) {
    if (data !== undefined) console.log(P, msg, data);
    else console.log(P, msg);
  }
}

function printError(label: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(P, `ERROR [${label}]:`, message);
  if (stack) console.error(P, "Stack:", stack);
}

let _ec2Client: EC2Client | null | undefined;

function getClient(): EC2Client | null {
  if (_ec2Client !== undefined) return _ec2Client;
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    _ec2Client = null;
    return null;
  }
  _ec2Client = new EC2Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  return _ec2Client;
}

export async function launchInstance(
  deploymentId: string,
  configToken: string,
  onLog?: (message: string) => Promise<void>
): Promise<{ instanceId: string; publicIp?: string } | null> {
  const client = getClient();
  if (!client) {
    console.log(P, "No AWS credentials (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY). Skipping EC2.");
    await onLog?.("No AWS credentials. Skipping EC2 launch.");
    return null;
  }
  console.log(P, "EC2 client OK. Proceeding with launch.");

  const vpcId = process.env.YELLAI_VPC_ID;
  const subnetId = process.env.YELLAI_SUBNET_ID;
  const securityGroupId = process.env.YELLAI_SECURITY_GROUP_ID;
  const keyName = process.env.YELLAI_KEY_NAME;
  const iamProfile = process.env.YELLAI_IAM_INSTANCE_PROFILE;
  await onLog?.(`EC2 config: region=${region}, subnet=${subnetId ?? "(not set)"}, securityGroup=${securityGroupId ?? "(not set)"}, keyName=${keyName ?? "(not set)"}`);
  log("EC2 config", { region, subnetId: subnetId ?? "(not set)", securityGroupId: securityGroupId ?? "(not set)", keyName: keyName ?? "(not set)" });

  const userData = Buffer.from(
    buildUserData(configToken, appUrl),
    "utf-8"
  ).toString("base64");

  console.log(P, "STEP 2a: Fetching Ubuntu 24.04 AMI (DescribeImages)...");
  await onLog?.("Fetching Ubuntu 24.04 AMI (DescribeImages)...");
  let imageId: string;
  try {
    imageId = await getUbuntuAmi(client);
    console.log(P, "STEP 2a done: AMI =", imageId);
  } catch (amiErr) {
    printError("getUbuntuAmi", amiErr);
    throw amiErr;
  }
  await onLog?.(`Using AMI: ${imageId}`);
  log("Using AMI", { imageId });

  const runInput: RunInstancesCommandInput = {
    ImageId: imageId,
    InstanceType: instanceType as RunInstancesCommandInput["InstanceType"],
    MinCount: 1,
    MaxCount: 1,
    UserData: userData,
    TagSpecifications: [
      {
        ResourceType: "instance",
        Tags: [
          { Key: "Name", Value: `yellai-${deploymentId.slice(0, 8)}` },
          { Key: "Yell AIDeploymentId", Value: deploymentId },
        ],
      },
    ],
    BlockDeviceMappings: [
      {
        DeviceName: "/dev/sda1",
        Ebs: {
          VolumeSize: 30,
          VolumeType: "gp3",
        },
      },
    ],
  };

  if (subnetId) runInput.SubnetId = subnetId;
  if (vpcId && !subnetId) {
    // If only VPC, we need a subnet; leave to user to set both or use default
  }
  if (securityGroupId) runInput.SecurityGroupIds = [securityGroupId];
  if (keyName) runInput.KeyName = keyName;
  if (iamProfile) runInput.IamInstanceProfile = { Name: iamProfile };

  console.log(P, "STEP 2b: Calling RunInstances (launching EC2)...");
  await onLog?.("Calling AWS RunInstances (launching EC2)...");
  let result;
  try {
    result = await client.send(new RunInstancesCommand(runInput));
  } catch (runErr) {
    printError("RunInstances", runErr);
    throw runErr;
  }
  const instance = result.Instances?.[0];
  if (!instance?.InstanceId) {
    const msg = "RunInstances did not return an instance ID";
    console.error(P, "ERROR:", msg);
    throw new Error(msg);
  }
  console.log(P, "STEP 2b done: InstanceId =", instance.InstanceId, "PublicIp =", instance.PublicIpAddress ?? "(pending)");
  await onLog?.(`RunInstances success. Instance: ${instance.InstanceId}, Public IP: ${instance.PublicIpAddress ?? "(pending)"}`);
  log("RunInstances success", { instanceId: instance.InstanceId, publicIp: instance.PublicIpAddress });

  return {
    instanceId: instance.InstanceId,
    publicIp: instance.PublicIpAddress ?? undefined,
  };
}

async function getUbuntuAmi(client: EC2Client): Promise<string> {
  const explicitAmi = process.env.YELLAI_EC2_AMI_ID;
  if (explicitAmi?.trim()) {
    log("Using YELLAI_EC2_AMI_ID", { ami: explicitAmi });
    return explicitAmi.trim();
  }

  const namePatterns = [
    "ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*",
    "ubuntu/images/hvm-ssd/ubuntu-noble-24.04-amd64-server-*",
    "ubuntu-noble-24.04-amd64-server-*",
  ];

  for (const namePattern of namePatterns) {
    const result = await client.send(
      new DescribeImagesCommand({
        Owners: [amiOwner],
        Filters: [
          { Name: "name", Values: [namePattern] },
          { Name: "state", Values: ["available"] },
        ],
        MaxResults: 10,
      })
    );
    const images = (result.Images ?? []).sort(
      (a, b) => (b.CreationDate ?? "").localeCompare(a.CreationDate ?? "")
    );
    if (images.length > 0) {
      const ami = images[0].ImageId;
      log("Found AMI with pattern " + namePattern, { ami, creationDate: images[0].CreationDate });
      return ami!;
    }
  }

  throw new Error(
    `No Ubuntu 24.04 AMI found in region ${region}. Set YELLAI_EC2_AMI_ID in .env to a valid Ubuntu 24.04 AMI for your region (EC2 → AMIs → search "ubuntu 24.04").`
  );
}

export async function getInstancePublicIp(
  instanceId: string
): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  const result = await client.send(
    new DescribeInstancesCommand({
      InstanceIds: [instanceId],
    })
  );
  const instance = result.Reservations?.[0]?.Instances?.[0];
  return instance?.PublicIpAddress ?? null;
}
