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

export interface Design {
  id: string;
  title?: string;
  editUrl?: string;
  viewUrl?: string;
}

export interface SelectionResponse {
  design: Design;
  exportFormats: string[];
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
