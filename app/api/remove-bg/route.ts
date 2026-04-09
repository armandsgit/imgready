import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import sharp from 'sharp';
import { authOptions } from '@/lib/auth';
import { limiter } from '@/lib/concurrency';
import { REMOVE_BACKGROUND_CREDIT_COST } from '@/lib/credits';
import { getImageBackendEndpoint } from '@/lib/backendConfig';
import { hasUnlimitedCredits } from '@/lib/plans';
import { createProcessingJob, markProcessingJobStatus } from '@/lib/processingJobs';
import { prisma } from '@/lib/prisma';
import type { MaskCleanupMode, ProcessingQuality } from '@/types';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SIZE = 10 * 1024 * 1024;
const FALLBACK_MAX_SIDE = 1920;

function shouldRetryWithCompressedInput(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('413') ||
    normalized.includes('request entity too large') ||
    normalized.includes('payload too large') ||
    normalized.includes('body exceeded') ||
    normalized.includes('request error') ||
    normalized.includes('bad gateway') ||
    normalized.includes('upstream')
  );
}

async function uploadToAiBackend(params: {
  file: File | Blob;
  fileName: string;
  maskCleanup: MaskCleanupMode;
  model: 'isnet' | 'birefnet';
  quality: ProcessingQuality;
}) {
  const aiFormData = new FormData();
  aiFormData.append('file', params.file, params.fileName);
  aiFormData.append('mask_cleanup', params.maskCleanup);
  aiFormData.append('model', params.model);
  aiFormData.append('quality', params.quality);

  const response = await fetch(getImageBackendEndpoint('/remove-bg', params.model), {
    method: 'POST',
    body: aiFormData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI server error: ${text}`);
  }

  return {
    buffer: await response.arrayBuffer(),
    qualityMode: response.headers.get('X-Quality-Mode') ?? params.quality,
    exportSize: response.headers.get('X-Export-Size') ?? null,
    modelUsed: response.headers.get('X-Model-Used') ?? params.model,
  };
}

async function createCompressedFallbackFile(file: File) {
  const inputBuffer = Buffer.from(await file.arrayBuffer());
  const outputBuffer = await sharp(inputBuffer, { failOn: 'none' })
    .rotate()
    .resize({
      width: FALLBACK_MAX_SIDE,
      height: FALLBACK_MAX_SIDE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 90 })
    .toBuffer();

  const fallbackName = file.name.replace(/\.[^.]+$/, '') || 'upload';
  return {
    file: new Blob([new Uint8Array(outputBuffer)], { type: 'image/webp' }),
    fileName: `${fallbackName}-compressed.webp`,
  };
}

export async function POST(request: Request) {
  let processingJobId: string | null = null;

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'You must be logged in to remove backgrounds.' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('image');
    const maskCleanupValue = formData.get('maskCleanup');
    const modelValue = formData.get('model');
    const qualityValue = formData.get('quality');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Image file is required.' }, { status: 400 });
    }

    const allowedModes: MaskCleanupMode[] = ['standard', 'aggressive', 'product', 'hollow-object'];
    const maskCleanup: MaskCleanupMode =
      typeof maskCleanupValue === 'string' && allowedModes.includes(maskCleanupValue as MaskCleanupMode)
        ? (maskCleanupValue as MaskCleanupMode)
        : 'standard';
    const model = typeof modelValue === 'string' && modelValue === 'birefnet' ? 'birefnet' : 'isnet';
    const quality: ProcessingQuality =
      typeof qualityValue === 'string' && ['standard', 'hd', 'original'].includes(qualityValue)
        ? (qualityValue as ProcessingQuality)
        : 'standard';

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type.' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File exceeds 10MB limit.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, credits: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Your account could not be found.' }, { status: 401 });
    }

    if (!hasUnlimitedCredits(user.credits) && user.credits < REMOVE_BACKGROUND_CREDIT_COST) {
      return NextResponse.json({ error: 'Upgrade your plan to continue removing backgrounds.' }, { status: 402 });
    }

    const job = await createProcessingJob({
      userId: user.id,
      userEmail: user.email,
      mode: 'remove-background',
      imagesCount: 1,
      status: 'queued',
    });
    processingJobId = job.id;

    const processed = await limiter.run(async () => {
      if (processingJobId) {
        await markProcessingJobStatus(processingJobId, 'processing');
      }

      try {
        return await uploadToAiBackend({
          file,
          fileName: file.name,
          maskCleanup,
          model,
          quality,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected AI upload error';
        if (!shouldRetryWithCompressedInput(message)) {
          throw error;
        }

        const compressed = await createCompressedFallbackFile(file);
        return await uploadToAiBackend({
          file: compressed.file,
          fileName: compressed.fileName,
          maskCleanup,
          model,
          quality,
        });
      }
    });

    if (!hasUnlimitedCredits(user.credits)) {
      const decremented = await prisma.user.updateMany({
        where: {
          id: session.user.id,
          credits: {
            gte: REMOVE_BACKGROUND_CREDIT_COST,
          },
        },
        data: {
          credits: {
            decrement: REMOVE_BACKGROUND_CREDIT_COST,
          },
          processedCount: {
            increment: 1,
          },
        },
      });

      if (decremented.count === 0) {
        return NextResponse.json({ error: 'No credits left after processing. Please refresh and try again.' }, { status: 409 });
      }
    } else {
      await prisma.user.update({
        where: {
          id: session.user.id,
        },
        data: {
          processedCount: {
            increment: 1,
          },
        },
      });
    }

    const responseBuffer = Buffer.from(new Uint8Array(processed.buffer));

    if (processingJobId) {
      await markProcessingJobStatus(processingJobId, 'done');
    }

    return new NextResponse(new Uint8Array(responseBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
        'X-Quality-Mode': processed.qualityMode,
        ...(processed.exportSize ? { 'X-Export-Size': processed.exportSize } : {}),
        'X-Model-Used': processed.modelUsed,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    if (processingJobId) {
      await markProcessingJobStatus(processingJobId, 'failed', { errorMessage: message });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
