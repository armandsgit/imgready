import type { Metadata } from 'next';
import SeoLandingPage from '@/components/SeoLandingPage';

export const metadata: Metadata = {
  title: 'Remove Background Online for Product Photos',
  description:
    'Remove image backgrounds online and create clean, listing-ready product photos with a simple upload, process, and download workflow.',
  alternates: {
    canonical: '/remove-background-online',
  },
};

export default function RemoveBackgroundOnlinePage() {
  return (
    <SeoLandingPage
      eyebrow="Online background removal"
      title="Remove product photo backgrounds online"
      description="ImgReady helps you turn raw product photos into cleaner images with a fast online workflow. Upload a photo, remove the background, and download a result that is easier to use in listings, storefronts, and catalogs."
      primaryCta="Remove background online"
      benefits={[
        {
          title: 'Simple upload workflow',
          description: 'Start from a product photo on your device and process it without opening a heavy desktop editor.',
        },
        {
          title: 'Cleaner product presentation',
          description: 'Remove distracting backgrounds so the item becomes the focus of the image.',
        },
        {
          title: 'Listing-ready exports',
          description: 'Download optimized output that is easier to reuse across product pages and marketing assets.',
        },
        {
          title: 'No design skills required',
          description: 'Use a guided workflow instead of manually tracing edges or rebuilding image backgrounds.',
        },
      ]}
      contentTitle="A faster way to prepare everyday product photos"
      contentBody={[
        'Online background removal is useful when you need a clean product image quickly and do not want to spend time in a manual editor. ImgReady is built around a direct workflow: upload, process, review, and download.',
        'The goal is not to replace every advanced design tool. It is to make routine product image preparation faster, especially for sellers who need consistent photos for listings, small catalogs, and product updates.',
        'You can use ImgReady for single product images or as part of a broader catalog cleanup process when your photos come from different suppliers, phone cameras, or older listing assets.',
      ]}
      contentCards={[
        {
          title: 'Useful for new listings',
          description: 'Prepare a cleaner hero image before publishing a product page or marketplace listing.',
        },
        {
          title: 'Works for repeat edits',
          description: 'Use the same workflow whenever you need to clean up more product images without rebuilding a process from scratch.',
        },
        {
          title: 'Built for speed',
          description: 'Keep the process focused on getting a usable result quickly rather than managing complex editing layers.',
        },
      ]}
      faqs={[
        {
          question: 'Can I remove a background online without installing software?',
          answer: 'Yes. ImgReady runs in the browser, so you can upload an image, process it, and download the result without installing a desktop image editor.',
        },
        {
          question: 'Is this only for product photos?',
          answer: 'ImgReady is optimized for product image workflows, but the same process can help with many object-focused images where you want a cleaner background.',
        },
        {
          question: 'Do I need a credit card to start?',
          answer: 'No. The Free plan lets you try ImgReady with included credits before upgrading.',
        },
        {
          question: 'Can I use the output in my store?',
          answer: 'Yes. The output is intended for product listings, catalogs, storefronts, and other commercial product presentation workflows.',
        },
      ]}
      relatedLinks={[
        { href: '/ecommerce-product-images', label: 'E-commerce product images' },
        { href: '/bulk-background-removal', label: 'Bulk background removal' },
      ]}
    />
  );
}
