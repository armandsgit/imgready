import type { Metadata } from 'next';
import SeoLandingPage from '@/components/SeoLandingPage';

export const metadata: Metadata = {
  title: 'Bulk Background Removal for Product Images',
  description:
    'Process multiple product images faster with bulk background removal workflows built for catalog preparation and e-commerce teams.',
  alternates: {
    canonical: '/bulk-background-removal',
  },
};

export default function BulkBackgroundRemovalPage() {
  return (
    <SeoLandingPage
      eyebrow="Batch product image workflow"
      title="Bulk background removal for product catalogs"
      description="ImgReady helps you prepare multiple product images without repeating the same manual editing steps over and over. Use it when you need faster catalog cleanup, consistent output, and a workflow that scales beyond one image at a time."
      primaryCta="Start bulk processing"
      benefits={[
        {
          title: 'Process more images faster',
          description: 'Move through groups of product images instead of editing each background manually in a design tool.',
        },
        {
          title: 'Reduce repetitive work',
          description: 'Use one focused workflow for product image cleanup, review, and download.',
        },
        {
          title: 'Prepare catalogs at scale',
          description: 'Useful when adding new products, refreshing old listings, or cleaning up supplier photo sets.',
        },
        {
          title: 'Keep results consistent',
          description: 'Standardize product presentation across many images so your catalog feels more coherent.',
        },
      ]}
      contentTitle="Batch workflows are useful when image editing becomes a bottleneck"
      contentBody={[
        'Bulk background removal matters when you have more than a few product photos to prepare. A small manual task becomes expensive when it has to be repeated across dozens or hundreds of images.',
        'ImgReady is designed to keep the workflow simple: upload product images, process them, and download results that are easier to use for stores, catalogs, and listings. This helps teams spend less time on repetitive background cleanup.',
        'For larger catalog work, the biggest benefit is consistency. When every image goes through the same preparation workflow, the final product grid can look more organized and easier for customers to scan.',
      ]}
      contentCards={[
        {
          title: 'For catalog refreshes',
          description: 'Clean up older product images when updating a store or improving category pages.',
        },
        {
          title: 'For supplier image sets',
          description: 'Normalize images that arrive with different backgrounds, framing, and visual styles.',
        },
        {
          title: 'For launch preparation',
          description: 'Prepare image sets faster when a new product collection needs to go live.',
        },
      ]}
      faqs={[
        {
          question: 'Can I remove backgrounds from multiple images?',
          answer: 'Yes. ImgReady is built around product image workflows where sellers may need to process more than one image for a listing or catalog update.',
        },
        {
          question: 'Is bulk background removal good for catalog cleanup?',
          answer: 'Yes. It is useful when you want product images across a catalog to look more consistent and less dependent on the original photo background.',
        },
        {
          question: 'Will bulk processing save time compared with manual editing?',
          answer: 'For repeated product image cleanup, yes. It reduces the need to manually trace and edit backgrounds one image at a time.',
        },
        {
          question: 'Can I use this before uploading images to my store?',
          answer: 'Yes. You can process the images first, download the results, and then upload them into your store, marketplace, or catalog system.',
        },
        {
          question: 'Do extra credits help with larger batches?',
          answer: 'Yes. If you need more processing volume than your monthly plan includes, extra credits can be added on top of your current balance.',
        },
      ]}
      relatedLinks={[
        { href: '/remove-background-online', label: 'Remove background online' },
        { href: '/ecommerce-product-images', label: 'E-commerce product images' },
      ]}
    />
  );
}
