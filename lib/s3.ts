import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createS3Client, getBucketConfig } from './aws-config';

const s3Client = createS3Client();

export async function generatePresignedUploadUrl(
  fileName: string,
  contentType: string,
  isPublic = false
) {
  const { bucketName, folderPrefix } = getBucketConfig();
  const timestamp = Date.now();
  const cloudStoragePath = isPublic
    ? `${folderPrefix}public/uploads/${timestamp}-${fileName}`
    : `${folderPrefix}uploads/${timestamp}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: cloudStoragePath,
    ContentType: contentType,
    ContentDisposition: isPublic ? 'attachment' : undefined,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  return { uploadUrl, cloud_storage_path: cloudStoragePath };
}

export async function getFileUrl(cloudStoragePath: string, isPublic = false) {
  const { bucketName } = getBucketConfig();
  const region = process.env.AWS_REGION || 'us-east-1';

  if (isPublic) {
    return `https://${bucketName}.s3.${region}.amazonaws.com/${cloudStoragePath}`;
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: cloudStoragePath,
    ResponseContentDisposition: 'attachment',
  });

  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

export async function deleteFile(cloudStoragePath: string) {
  const { bucketName } = getBucketConfig();

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: cloudStoragePath,
  });

  await s3Client.send(command);
}
