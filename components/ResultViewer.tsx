'use client';

import BeforeAfterSlider from './BeforeAfterSlider';
import DownloadButton from './DownloadButton';

interface ResultViewerProps {
  originalImage: string;
  resultImage: string;
}

export default function ResultViewer({ originalImage, resultImage }: ResultViewerProps) {
  const finalProcessedImage = resultImage;

  return (
    <div className="panel rounded-3xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">Single image result</h3>
          <p className="text-sm text-[color:var(--text-secondary)]">Use the slider to compare before and after.</p>
        </div>
        <DownloadButton image={finalProcessedImage} compact />
      </div>
      <BeforeAfterSlider beforeSrc={originalImage} afterSrc={finalProcessedImage} />
    </div>
  );
}
