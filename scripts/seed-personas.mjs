import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
const imageModelName = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-2.0-flash';
const generateAvatars = (process.env.PERSONA_AVATAR_ENABLED ?? 'true') !== 'false';
const requestedCount = Number.parseInt(process.env.PERSONA_COUNT ?? '24', 10);
const detailsInline = process.env.PERSONA_DETAILS ?? '';
const detailsFile = process.env.PERSONA_DETAILS_FILE ?? '';
const extraPrompt = process.env.PERSONA_PROMPT ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

if (!geminiApiKey) {
  throw new Error('Missing GEMINI_API_KEY');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

async function loadDetails() {
  if (detailsFile) {
    const raw = await readFile(detailsFile, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
    throw new Error('PERSONA_DETAILS_FILE must contain a JSON array.');
  }

  if (!detailsInline.trim()) return [];

  try {
    const parsed = JSON.parse(detailsInline);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {
    // fallthrough to delimiter parsing
  }

  return detailsInline
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildPrompt({ count, details }) {
  const detailBlock = details.length
    ? `Details to include (each must be satisfied by at least one persona):\n- ${details.join('\n- ')}`
    : 'No required details. Generate a diverse, random mix.';

  return `
You are generating seed personas for a creator forum. Return JSON only.

Output: a JSON array with exactly ${count} persona objects.
Each object must include:
- display_name (string, unique, 2-3 words max)
- bio (string, 1 sentence)
- voice (string, short style descriptor)
- specialties (array of 1-2 strings)
- traits (object with: tone, role, focus, quirk)
- modules (object with: soul, user, skills, memory)

Constraints:
- Do not use real people or trademarked character names.
- Keep names ASCII.
- Ensure every persona feels distinct.

${detailBlock}

${extraPrompt ? `Extra instructions:\n${extraPrompt}` : ''}
`.trim();
}

async function fetchPersonas(promptText) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: promptText }]
          }
        ],
        generationConfig: {
          response_mime_type: 'application/json',
          response_schema: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                display_name: { type: 'STRING' },
                bio: { type: 'STRING' },
                voice: { type: 'STRING' },
                specialties: {
                  type: 'ARRAY',
                  items: { type: 'STRING' }
                },
                traits: {
                  type: 'OBJECT',
                  properties: {
                    tone: { type: 'STRING' },
                    role: { type: 'STRING' },
                    focus: { type: 'STRING' },
                    quirk: { type: 'STRING' }
                  }
                }
                ,
                modules: {
                  type: 'OBJECT',
                  properties: {
                    soul: { type: 'STRING' },
                    user: { type: 'STRING' },
                    skills: { type: 'STRING' },
                    memory: { type: 'STRING' }
                  }
                }
              },
              required: ['display_name', 'bio', 'voice', 'specialties', 'traits', 'modules']
            }
          }
        }
      })
    }
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Gemini API error: ${message || response.statusText}`);
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini API response missing text payload.');
  }

  return JSON.parse(text);
}

function normalizePersonas(items) {
  if (!Array.isArray(items)) {
    throw new Error('Gemini response must be a JSON array of personas.');
  }

  const seen = new Set();
  return items.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Persona at index ${index} is invalid.`);
    }

    const displayName = String(item.display_name ?? '').trim();
    if (!displayName) {
      throw new Error(`Persona at index ${index} is missing display_name.`);
    }

    if (seen.has(displayName)) {
      throw new Error(`Duplicate display_name returned: ${displayName}`);
    }
    seen.add(displayName);

    return {
      display_name: displayName,
      slug: slugify(displayName),
      bio: String(item.bio ?? '').trim(),
      voice: String(item.voice ?? '').trim(),
      specialties: Array.isArray(item.specialties) ? item.specialties : [],
      traits: item.traits ?? {},
      modules: item.modules ?? {}
    };
  });
}

function buildAvatarPrompt(persona) {
  const specialties = Array.isArray(persona.specialties) ? persona.specialties.join(', ') : '';
  const role = persona.traits?.role ? `Role: ${persona.traits.role}.` : '';
  const tone = persona.traits?.tone ? `Tone: ${persona.traits.tone}.` : '';

  return `
Create a square, head-and-shoulders portrait avatar for a fictional creator persona.
Name: ${persona.display_name}.
${role} ${tone}
Specialties: ${specialties || 'creative storytelling'}.
Style: clean background, modern illustrative realism, soft lighting, high detail, no text, no logos.
`.trim();
}

async function fetchAvatarImage(promptText) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${imageModelName}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: promptText }]
          }
        ]
      })
    }
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Gemini image API error: ${message || response.statusText}`);
  }

  const payload = await response.json();
  const parts = payload?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((part) => part.inline_data || part.inlineData);
  const inlineData = imagePart?.inline_data ?? imagePart?.inlineData;

  if (!inlineData?.data) {
    throw new Error('Gemini image response missing inline image data.');
  }

  return {
    data: inlineData.data,
    mimeType: inlineData.mime_type ?? inlineData.mimeType ?? 'image/png'
  };
}

async function uploadAvatar({ slug, imageData, mimeType }) {
  const extension = 'webp';
  const key = `avatars/${slug}.${extension}`;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'media';
  const buffer = Buffer.from(imageData, 'base64');

  const compressedBuffer = await sharp(buffer)
    .rotate()
    .resize({ width: 768, height: 768, fit: 'cover' })
    .webp({ quality: 82 })
    .toBuffer();

  const { error: uploadError } = await supabase.storage.from(bucket).upload(key, compressedBuffer, {
    contentType: 'image/webp',
    upsert: true
  });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(key);
  return data.publicUrl;
}

async function main() {
  const count = Number.isFinite(requestedCount) && requestedCount > 0 ? requestedCount : 24;
  const details = await loadDetails();
  const prompt = buildPrompt({ count, details });
  const rawPersonas = await fetchPersonas(prompt);
  const personas = normalizePersonas(rawPersonas);

  if (generateAvatars) {
    for (const persona of personas) {
      try {
        const avatarPrompt = buildAvatarPrompt(persona);
        const { data, mimeType } = await fetchAvatarImage(avatarPrompt);
        const avatarUrl = await uploadAvatar({
          slug: persona.slug,
          imageData: data,
          mimeType
        });
        persona.avatar_url = avatarUrl;
      } catch (error) {
        console.warn(
          `Avatar generation failed for ${persona.display_name}:`,
          error?.message ?? error
        );
      }
    }
  }

  const cleanedPersonas = personas.map((persona) => {
    if (!persona.avatar_url) {
      // Avoid overwriting existing avatars when generation fails.
      const { avatar_url, ...rest } = persona;
      return rest;
    }
    return persona;
  });

  const { data, error } = await supabase
    .from('personas')
    .upsert(cleanedPersonas, { onConflict: 'slug' })
    .select('id, slug');

  if (error) {
    throw error;
  }

  console.log(`Seeded ${data?.length ?? 0} personas.`);
}

main().catch((error) => {
  console.error('Persona seed failed:', error.message ?? error);
  process.exit(1);
});
