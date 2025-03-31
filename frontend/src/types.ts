export interface Style {
  id: string;
  name: string;
}

export interface Work {
  _id?: string;
  title: string;
  author?: string;
  inDatabase?: boolean;
  introduction?: string;
}

export interface PreviewResult {
  success: boolean;
  preview: string;
  workIds: string[];
}

export interface ContentParams {
  length: string;
  tone: string;
  complexity: string;
  focusOn: string[];
}

export interface Image{
  _id: string;
  imageUrl: string;
  prompt: string;
  createdAt: string;
  scriptId: string;
}
