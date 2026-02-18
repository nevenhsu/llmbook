import { NextResponse } from "next/server";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import { createAdminClient } from "@/lib/supabase/admin";
import { http, jsonError, withAuth } from "@/lib/server/route-helpers";

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_WIDTH = 2048;
const DEFAULT_QUALITY = 82;
const DEFAULT_BUCKET = "media";

export const runtime = "nodejs";

export const POST = withAuth(async (request, { user, supabase }) => {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return http.badRequest("Missing file");
  }

  if (!file.type.startsWith("image/")) {
    return http.badRequest("Only images are allowed");
  }

  const maxBytes = parseInt(formData.get("maxBytes") as string) || DEFAULT_MAX_BYTES;
  const maxWidth = parseInt(formData.get("maxWidth") as string) || DEFAULT_MAX_WIDTH;
  const quality = parseInt(formData.get("quality") as string) || DEFAULT_QUALITY;
  const aspectRatio = (formData.get("aspectRatio") as string) || null;

  if (file.size > maxBytes) {
    return jsonError(`File exceeds ${maxBytes / 1024 / 1024}MB limit`, 413);
  }

  const arrayBuffer = await file.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuffer);

  const image = sharp(inputBuffer).rotate();
  const metadata = await image.metadata();

  let resized = image;

  // Handle aspect ratio cropping
  if (aspectRatio === "banner" && metadata.width && metadata.height) {
    // Banner should be 3:1 ratio
    const targetRatio = 3 / 1;
    const currentRatio = metadata.width / metadata.height;

    if (currentRatio > targetRatio) {
      // Image is wider than 3:1, crop width
      const targetWidth = Math.round(metadata.height * targetRatio);
      const left = Math.round((metadata.width - targetWidth) / 2);
      resized = image.extract({
        left,
        top: 0,
        width: targetWidth,
        height: metadata.height,
      });
    } else if (currentRatio < targetRatio) {
      // Image is taller than 3:1, crop height
      const targetHeight = Math.round(metadata.width / targetRatio);
      const top = Math.round((metadata.height - targetHeight) / 2);
      resized = image.extract({
        left: 0,
        top,
        width: metadata.width,
        height: targetHeight,
      });
    }

    // Then resize if needed
    resized = resized.resize({
      width: maxWidth,
      withoutEnlargement: true,
    });
  } else if (aspectRatio === "square" && metadata.width && metadata.height) {
    // Square cropping (1:1)
    const size = Math.min(metadata.width, metadata.height);
    const left = Math.round((metadata.width - size) / 2);
    const top = Math.round((metadata.height - size) / 2);

    resized = image
      .extract({
        left,
        top,
        width: size,
        height: size,
      })
      .resize({
        width: Math.min(size, maxWidth),
        withoutEnlargement: true,
      });
  } else {
    // Original aspect ratio
    resized = image.resize({
      width: metadata.width && metadata.width > maxWidth ? maxWidth : metadata.width,
      withoutEnlargement: true,
    });
  }

  const outputBuffer = await resized.webp({ quality }).toBuffer();

  if (outputBuffer.length > maxBytes) {
    return jsonError(`Compressed file exceeds ${maxBytes / 1024 / 1024}MB limit`, 413);
  }

  const webpMetadata = await sharp(outputBuffer).metadata();
  const key = `uploads/${user.id}/${uuidv4()}.webp`;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;

  let publicUrl: string;
  try {
    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage
      .from(bucket)
      .upload(key, outputBuffer, { contentType: "image/webp", upsert: false });

    if (uploadError) {
      return http.internalError(uploadError.message);
    }

    const { data } = admin.storage.from(bucket).getPublicUrl(key);
    publicUrl = data.publicUrl;
  } catch (error) {
    console.error(error);
    return http.internalError("Upload failed");
  }

  const { data: media, error } = await supabase
    .from("media")
    .insert({
      user_id: user.id,
      post_id: null,
      url: publicUrl,
      mime_type: "image/webp",
      width: webpMetadata.width ?? maxWidth,
      height: webpMetadata.height ?? maxWidth,
      size_bytes: outputBuffer.length,
    })
    .select("id,url,width,height,size_bytes")
    .single();

  if (error || !media) {
    return http.badRequest(error?.message ?? "DB insert failed");
  }

  return http.ok({
    mediaId: media.id,
    url: media.url,
    width: media.width,
    height: media.height,
    sizeBytes: media.size_bytes,
  });
});
