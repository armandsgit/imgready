import type { Metadata } from 'next';
import SeoLandingPage from '@/components/SeoLandingPage';

export const metadata: Metadata = {
  title: 'E-commerce Product Images with Clean White Backgrounds',
  description:
    'Create cleaner e-commerce product images with consistent framing, white backgrounds, and optimized exports for stores and marketplaces.',
  alternates: {
    canonical: '/ecommerce-product-images',
  },
};

export default function EcommerceProductImagesPage() {
  return (
    <SeoLandingPage
      eyebrow="E-commerce image preparation"
      title="Cleaner product images for online stores"
      description="ImgReady helps e-commerce sellers create more consistent product photos by removing busy backgrounds, improving framing, and preparing images that look cleaner across catalogs and marketplace listings."
      primaryCta="Prepare product images"
      benefits={[
        {
          title: 'Consistent catalog style',
          description: 'Make product images feel more aligned even when source photos come from different shoots or suppliers.',
        },
        {
          title: 'Cleaner listing visuals',
          description: 'Use white or simplified backgrounds so customers can focus on the product instead of the setting.',
        },
        {
          title: 'Marketplace-friendly workflow',
          description: 'Prepare images for stores, catalogs, and marketplace listings without repeatedly editing each photo by hand.',
        },
        {
          title: 'Optimized image exports',
          description: 'Keep outputs practical for web use, faster loading, and repeated product publishing workflows.',
        },
      ]}
      contentTitle="Product images affect how professional a catalog feels"
      contentBody={[
        'For e-commerce, image consistency is often as important as image quality. A catalog with mixed backgrounds, uneven framing, and distracting scenes can make products feel less organized even when the products themselves are good.',
        'ImgReady gives sellers a focused way to clean up product photos before they go into a store. The workflow is designed for practical catalog preparation: remove the background, center the product, and export an image that is easier to reuse.',
        'This is especially helpful for small teams and solo sellers who need to keep listings moving without building a full design workflow for every new product.',
      ]}
      contentCards={[
        {
          title: 'For marketplace listings',
          description: 'Prepare cleaner visuals for product pages where the first image needs to be direct and easy to understand.',
        },
        {
          title: 'For store catalogs',
          description: 'Create a more consistent browsing experience across category pages and product grids.',
        },
        {
          title: 'For product launches',
          description: 'Move from raw product photos to usable listing assets faster when adding new items.',
        },
      ]}
      faqs={[
        {
          question: 'Why use white background product images?',
          answer: 'White or simplified backgrounds reduce visual noise and help product catalogs look more consistent across multiple items and categories.',
        },
        {
          question: 'Can ImgReady help if my supplier photos all look different?',
          answer: 'Yes. It can help standardize the final presentation by removing inconsistent backgrounds and preparing cleaner output for listings.',
        },
        {
          question: 'Is this useful for small e-commerce stores?',
          answer: 'Yes. ImgReady is designed for sellers who need a practical workflow without hiring a designer for every routine product image update.',
        },
        {
          question: 'Does this replace professional product photography?',
          answer: 'No. Good source photos still matter. ImgReady helps improve and standardize the presentation after you already have product photos.',
        },
        {
          question: 'Can I process images before uploading to Shopify, WooCommerce, or marketplaces?',
          answer: 'Yes. You can prepare images in ImgReady first, then use the downloaded files in your store or listing workflow.',
        },
      ]}
      relatedLinks={[
        { href: '/remove-background-online', label: 'Remove background online' },
        { href: '/bulk-background-removal', label: 'Bulk background removal' },
      ]}
    />
  );
}
