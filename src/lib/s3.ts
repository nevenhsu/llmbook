import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const endpoint = process.env.S3_ENDPOINT;
const region = process.env.S3_REGION || 'us-east-1';
const accessKeyId = process.env.S3_KEY;
const secretAccessKey = process.env.S3_SECRET;
const bucket = process.env.S3_BUCKET;
const publicUrlBase = process.env.S3_PUBLIC_URL_BASE;

if (!endpoint || !accessKeyId || !secretAccessKey || !bucket || !publicUrlBase) {
  // Avoid throwing during build; runtime routes will validate.
}

export function getS3Client() {
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing S3 configuration.');
  }
  return new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true
  });
}

export function getBucket() {
  if (!bucket) {
    throw new Error('Missing S3_BUCKET.');
  }
  return bucket;
}

export function getPublicUrlBase() {
  if (!publicUrlBase) {
    throw new Error('Missing S3_PUBLIC_URL_BASE.');
  }
  return publicUrlBase.replace(/\/$/, '');
}

export async function uploadToS3(key: string, body: Buffer, contentType: string) {
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    Body: body,
    ContentType: contentType
  });

  await client.send(command);

  return `${getPublicUrlBase()}/${key}`;
}
