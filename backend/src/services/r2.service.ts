import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { env } from '../config/env.js';
import { r2Client } from '../config/r2.js';

export async function createPresignedUploadUrl(key: string, contentType: string) {
  const command = new PutObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key, ContentType: contentType });
  return getSignedUrl(r2Client, command, { expiresIn: 900 });
}

export async function createPresignedDownloadUrl(key: string, expiresIn = 300) {
  const command = new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key });
  return getSignedUrl(r2Client, command, { expiresIn });
}

export async function checkStorageConnection() {
  await r2Client.send(new HeadBucketCommand({ Bucket: env.R2_BUCKET_NAME }));
  return true;
}

export async function downloadObjectToFile(key: string, destinationPath: string) {
  const response = await r2Client.send(new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }));
  if (!response.Body) throw new Error(`R2 object has no body: ${key}`);
  await pipeline(response.Body as NodeJS.ReadableStream, createWriteStream(destinationPath));
}

export async function uploadFileToObject(key: string, sourcePath: string, contentType: string) {
  await r2Client.send(new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    Body: createReadStream(sourcePath),
  }));
}

export async function uploadJsonObject(key: string, value: unknown) {
  await r2Client.send(new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
    ContentType: 'application/json',
    Body: JSON.stringify(value, null, 2),
  }));
}

export async function copyObject(sourceKey: string, destinationKey: string, contentType?: string) {
  await r2Client.send(new CopyObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    CopySource: `${env.R2_BUCKET_NAME}/${sourceKey}`,
    Key: destinationKey,
    ContentType: contentType,
    MetadataDirective: contentType ? 'REPLACE' : 'COPY',
  }));
}

export async function deleteObject(key: string) {
  await r2Client.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }));
}
