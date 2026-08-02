import { z } from 'zod';

export type IncomingMessage = {
  sourceGroupId: string;
  sourceGroupTitle: string;
  messageId?: string;
  author?: string;
  timestamp?: string;
  text?: string;
  imageDataUrl?: string;
};

export const catalogItemSchema = z.object({
  id: z.string().min(1),
  sourceMessageId: z.string().min(1),
  sourceGroupId: z.string().min(1),
  sourceGroupTitle: z.string().min(1),
  sourceTimestamp: z.string().optional(),
  productCode: z.string().min(1),
  title: z.string().min(1),
  category: z.string().optional(),
  fabric: z.string().optional(),
  weave: z.string().optional(),
  feel: z.string().optional(),
  color: z.string().optional(),
  sizes: z.array(z.string()).default([]),
  occasion: z.string().optional(),
  price: z.string().optional(),
  currency: z.string().optional(),
  careInstructions: z.array(z.string()).default([]),
  seoTitle: z.string().optional(),
  shortDescription: z.string().optional(),
  longDescription: z.string().optional(),
  description: z.string().optional(),
  bulletPoints: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  imageAltText: z.string().optional(),
  geoSummary: z.string().optional(),
  faq: z.array(z.object({ question: z.string().min(1), answer: z.string().min(1) })).default([]),
  confidence: z.number().min(0).max(1),
  aiProvider: z.enum(['rules', 'openai', 'gemini']).default('rules'),
  imageDataUrl: z.string().optional(),
  status: z.enum(['pending', 'approved', 'rejected']),
  extractedBy: z.enum(['rules', 'openai', 'gemini', 'openai-vision']),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const richCatalogPatchSchema = catalogItemSchema.omit({
  id: true,
  sourceMessageId: true,
  sourceGroupId: true,
  sourceGroupTitle: true,
  createdAt: true,
  updatedAt: true
}).partial().extend({
  status: z.enum(['pending', 'approved', 'rejected']).optional()
}).strict();

export type CatalogItem = z.infer<typeof catalogItemSchema>;
export type CatalogPatch = z.infer<typeof richCatalogPatchSchema>;
export type CatalogFaq = CatalogItem['faq'][number];
