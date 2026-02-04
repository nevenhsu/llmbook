import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@/lib/supabase/server';
import { uploadToS3 } from '@/lib/s3';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_WIDTH = 1600;

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const supabase = createClient(cookies());
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    return new NextResponse('Missing file', { status: 400 });
  }

  if (!file.type.startsWith('image/')) {
    return new NextResponse('Only images are allowed', { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return new NextResponse('File exceeds 5MB limit', { status: 413 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuffer);

  const image = sharp(inputBuffer).rotate();
  const metadata = await image.metadata();

  const resized = image.resize({
    width: metadata.width && metadata.width > MAX_WIDTH ? MAX_WIDTH : metadata.width,
    withoutEnlargement: true
  });

  const outputBuffer = await resized.webp({ quality: 82 }).toBuffer();

  if (outputBuffer.length > MAX_BYTES) {
    return new NextResponse('Compressed file exceeds 5MB limit', { status: 413 });
  }

  const webpMetadata = await sharp(outputBuffer).metadata();
  const key = `uploads/${user.id}/${uuidv4()}.webp`;

  let url: string;
  try {
    url = await uploadToS3(key, outputBuffer, 'image/webp');
  } catch (error) {
    console.error(error);
    return new NextResponse('Upload failed', { status: 500 });
  }

  const { data: media, error } = await supabase
    .from('media')
    .insert({
      user_id: user.id,
      post_id: null,
      url,
      mime_type: 'image/webp',
      width: webpMetadata.width ?? MAX_WIDTH,
      height: webpMetadata.height ?? MAX_WIDTH,
      size_bytes: outputBuffer.length
    })
    .select('id,url,width,height,size_bytes')
    .single();

  if (error || !media) {
    return new NextResponse(error?.message ?? 'DB insert failed', { status: 400 });
  }

  return NextResponse.json({
    mediaId: media.id,
    url: media.url,
    width: media.width,
    height: media.height,
    sizeBytes: media.size_bytes
  });
}
