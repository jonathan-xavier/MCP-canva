export interface Capabilities {
  connected: boolean;
  generationTool?: string;
  designTypes: string[];
  canExport: boolean;
}

export interface Candidate {
  candidateId: string;
  previewUrls: string[];
  canvaPreviewUrl?: string;
}

export interface GenerationResponse {
  generationId: string;
  candidates: Candidate[];
}

export interface MediaGenerationInput {
  imageUrl?: string;
  videoUrl?: string;
  imageAssetId?: string;
  videoAssetId?: string;
  imagePercent: number;
  orientation: 'vertical' | 'horizontal';
}

export interface Design {
  id: string;
  title?: string;
  editUrl?: string;
  viewUrl?: string;
}

export interface SelectionResponse {
  design: Design;
  exportFormats: string[];
  instructionCheck?: InstructionCheck;
}

export interface InstructionCheck {
  status: 'verified' | 'missing' | 'unavailable';
  items: Array<{ text: string; found: boolean }>;
}

export interface ExportResponse {
  format: string;
  urls: string[];
  expires: boolean;
}

export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    retryable?: boolean;
  };
}
