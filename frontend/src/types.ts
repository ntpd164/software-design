export interface Style {
  id: string;
  name: string;
}

export interface Work {
  title: string;
  author?: string;
  fromWikipedia?: boolean;
  fromDatabase?: boolean;
  inDatabase?: boolean;
  pageid?: number;
  snippet?: string;
  introduction?: string;
  _id?: string;
}

export interface PreviewResult {
  success: boolean;
  topic: string;
  style: string;
  preview: string;
  workIds: string[];
}
