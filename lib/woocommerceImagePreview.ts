export const WOO_PREVIEW_SIZE = 1000;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load image for preview processing.'));
    image.src = src;
  });
}

export async function createWooImagePreview(imageUrl: string, size = WOO_PREVIEW_SIZE) {
  const image = await loadImage(imageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not initialize preview canvas.');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size, size);

  const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const offsetX = (size - drawWidth) / 2;
  const offsetY = (size - drawHeight) / 2;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((nextBlob) => resolve(nextBlob), 'image/webp', 0.92);
  });

  if (!blob) {
    throw new Error('Could not create processed preview image.');
  }

  return {
    blob,
    previewUrl: URL.createObjectURL(blob),
    width: size,
    height: size,
  };
}
