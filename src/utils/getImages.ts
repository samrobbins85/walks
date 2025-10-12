import {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "auto",
  endpoint: import.meta.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: import.meta.env.R2_ACCESS_KEY,
    secretAccessKey: import.meta.env.R2_SECRET_KEY,
  },
});

export default async function getImages(slug: string) {
  const listResp = await s3.send(
    new ListObjectsV2Command({
      Bucket: import.meta.env.R2_BUCKET,
      Prefix: `${slug}/`,
      Delimiter: undefined,
    })
  );
  if (!listResp?.Contents) {
    return [];
  }

  const mappedContents = await Promise.all(
    listResp.Contents.map(async (file) => {
      const tags = await s3.send(
        new HeadObjectCommand({
          Bucket: import.meta.env.R2_BUCKET,
          Key: file.Key,
        })
      );
      return {
        ...file,
        src: import.meta.env.PUBLIC_ASSET_SERVER + file.Key,
        cover: tags.Metadata?.cover === "true",
        width: tags.Metadata?.width,
        height: tags.Metadata?.height,
      };
    })
  );
  return mappedContents;
}

export async function getCover(slug: string) {
  const images = await getImages(slug);
  return images.find((image) => image.cover);
}
