function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function getConfiguredBaseUrl(
  envName: 'IMAGE_BACKEND_URL' | 'REFINE_IMAGE_BACKEND_URL'
): string {
  const configuredUrl = process.env[envName]?.trim();

  if (configuredUrl) {
    return trimTrailingSlash(configuredUrl);
  }

  if (envName === 'REFINE_IMAGE_BACKEND_URL') {
    return getImageBackendBaseUrl();
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'http://127.0.0.1:8001';
  }

  throw new Error('IMAGE_BACKEND_URL is required in production.');
}

export function getImageBackendBaseUrl(): string {
  return getConfiguredBaseUrl('IMAGE_BACKEND_URL');
}

export function getRefineBackendBaseUrl(): string {
  return getConfiguredBaseUrl('REFINE_IMAGE_BACKEND_URL');
}

export function getImageBackendEndpoint(
  path: string,
  model: 'isnet' | 'birefnet' = 'isnet'
): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = model === 'birefnet' ? getRefineBackendBaseUrl() : getImageBackendBaseUrl();
  return `${baseUrl}${normalizedPath}`;
}
