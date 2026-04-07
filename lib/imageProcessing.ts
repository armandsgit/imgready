import sharp from 'sharp';

export async function optimizeOutputImage(imageBuffer: Buffer) {
  return sharp(imageBuffer)
    .png({ compressionLevel: 9, quality: 100 })
    .toBuffer();
}

const FOREGROUND_ALPHA_THRESHOLD = 8;
const WHITE_BG_THRESHOLD = 242;
const TARGET_FILL_RATIO = 0.68;
const PADDING_RATIO = 0.12;
const MIN_CROP_SIDE_RATIO = 0.4;

interface Bounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

async function detectForegroundBounds(imageBuffer: Buffer): Promise<{ bounds: Bounds | null; width: number; height: number }> {
  const pipeline = sharp(imageBuffer, { failOn: 'none' }).ensureAlpha();
  const metadata = await pipeline.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const sourceHasAlpha = Boolean(metadata.hasAlpha);

  if (!width || !height) {
    throw new Error('Could not read image dimensions for auto framing.');
  }

  const { data, info } = await pipeline
    .raw()
    .toBuffer({ resolveWithObject: true });

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const index = (y * info.width + x) * info.channels;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const alpha = data[index + 3];

      if (sourceHasAlpha) {
        if (alpha <= FOREGROUND_ALPHA_THRESHOLD) {
          continue;
        }
      } else {
        const isNotWhiteBackground =
          red < WHITE_BG_THRESHOLD ||
          green < WHITE_BG_THRESHOLD ||
          blue < WHITE_BG_THRESHOLD;

        if (!isNotWhiteBackground) {
          continue;
        }
      }

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    return { bounds: null, width, height };
  }

  return {
    bounds: {
      left: minX,
      top: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    },
    width,
    height,
  };
}

export async function autoFrameProduct(imageBuffer: Buffer, size = 1000) {
  const { bounds, width, height } = await detectForegroundBounds(imageBuffer);

  // Fallback: if no subject is detected, just fit the full image into the requested square.
  if (!bounds) {
    return sharp(imageBuffer, { failOn: 'none' })
      .resize(size, size, {
        fit: 'cover',
        position: 'center',
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
  }

  const subjectMaxSide = Math.max(bounds.width, bounds.height);
  const fillRatio = subjectMaxSide / Math.min(width, height);

  // If the product already fills the frame enough, avoid extra zooming.
  if (fillRatio >= 0.7) {
    return sharp(imageBuffer, { failOn: 'none' })
      .resize(size, size, {
        fit: 'cover',
        position: 'center',
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
  }

  const paddedWidth = bounds.width * (1 + PADDING_RATIO * 2);
  const paddedHeight = bounds.height * (1 + PADDING_RATIO * 2);
  const desiredCropSide = Math.max(paddedWidth, paddedHeight) / TARGET_FILL_RATIO;
  const maxCropSide = Math.min(width, height);
  const minCropSide = Math.round(maxCropSide * MIN_CROP_SIDE_RATIO);
  const cropSide = Math.round(clamp(desiredCropSide, minCropSide, maxCropSide));

  const centerX = bounds.left + bounds.width / 2;
  const centerY = bounds.top + bounds.height / 2;

  const left = Math.round(clamp(centerX - cropSide / 2, 0, width - cropSide));
  const top = Math.round(clamp(centerY - cropSide / 2, 0, height - cropSide));

  return sharp(imageBuffer, { failOn: 'none' })
    .extract({
      left,
      top,
      width: cropSide,
      height: cropSide,
    })
    .resize(size, size, {
      fit: 'cover',
      position: 'center',
    })
    .png()
    .toBuffer();
}
