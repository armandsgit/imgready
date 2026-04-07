function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

export function getImageBackendBaseUrl() {
  const configuredUrl = process.env.IMAGE_BACKEND_URL?.trim();

  if (configuredUrl) {
    return trimTrailingSlash(configuredUrl);
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'http://127.0.0.1:8001';
  }

  throw new Error('IMAGE_BACKEND_URL is required in production.');
}

export function getImageBackendEndpoint(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getImageBackendBaseUrl()}${normalizedPath}`;
}
