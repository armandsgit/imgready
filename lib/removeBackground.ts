import type { MaskCleanupMode } from '@/types';

const API = '/api/remove-bg';

export async function removeBackground(
  file: File,
  maskCleanup: MaskCleanupMode = 'standard'
): Promise<ArrayBuffer> {
  const form = new FormData();
  form.append('image', file);
  form.append('maskCleanup', maskCleanup);

  const response = await fetch(API, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI server error: ${text}`);
  }

  return await response.arrayBuffer();
}
