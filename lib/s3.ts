import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export function getBucketConfig() {
  return {
    bucketName: process.env.AWS_BUCKET_NAME ?? '',
    folderPrefix: process.env.AWS_FOLDER_PREFIX ?? '',
  };
}

export function createS3Client() { return new S3Client({}); }

export async function generatePresignedUploadUrl(fileName: string, contentType: string, isPublic = false) {
  const { bucketName, folderPrefix } = getBucketConfig();
  const client = createS3Client();
  const cloud_storage_path = `${folderPrefix}${isPublic ? 'public/uploads/' : 'uploads/'}${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const cmd = new PutObjectCommand({
    Bucket: bucketName, Key: cloud_storage_path, ContentType: contentType,
    ContentDisposition: isPublic ? 'attachment' : undefined,
  });
  const uploadUrl = await getSignedUrl(client, cmd, { expiresIn: 3600 });
  return { uploadUrl, cloud_storage_path };
}

export async function getFileUrl(cloud_storage_path: string, isPublic: boolean): Promise<string> {
  const { bucketName } = getBucketConfig();
  if (isPublic) {
    const region = process.env.AWS_REGION ?? 'us-east-1';
    return `https://${bucketName}.s3.${region}.amazonaws.com/${cloud_storage_path}`;
  }
  const client = createS3Client();
  const cmd = new GetObjectCommand({ Bucket: bucketName, Key: cloud_storage_path });
  return await getSignedUrl(client, cmd, { expiresIn: 3600 });
}

export async function deleteFile(cloud_storage_path: string) {
  const { bucketName } = getBucketConfig();
  const client = createS3Client();
  await client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: cloud_storage_path }));
}
