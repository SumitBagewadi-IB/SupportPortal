import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://support.indiabulls.com', lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: 'https://support.indiabulls.com/faq', lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: 'https://support.indiabulls.com/contact', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://support.indiabulls.com/my-tickets', lastModified: new Date(), changeFrequency: 'never', priority: 0.3 },
  ]
}
