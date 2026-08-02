export type IncomingMessage = {
  sourceGroupId: string;
  sourceGroupTitle: string;
  messageId?: string;
  author?: string;
  timestamp?: string;
  text?: string;
  imageDataUrl?: string;
};

export type CatalogItem = {
  id: string;
  sourceMessageId: string;
  sourceGroupId: string;
  sourceGroupTitle: string;
  title: string;
  price?: string;
  description?: string;
  imageDataUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  extractedBy: 'rules' | 'openai-vision';
  createdAt: string;
  updatedAt: string;
};
