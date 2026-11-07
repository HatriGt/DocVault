import type { Ionicons } from '@expo/vector-icons';

export type ToolId = 'edit' | 'format' | 'compress' | 'img2pdf' | 'merge' | 'split' | 'extract' | 'rotate';

export interface ToolDef {
  id: ToolId;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  accepts: 'image' | 'pdf';
  multi: boolean; // needs several inputs
}

export const TOOLS: ToolDef[] = [
  { id: 'edit', title: 'Crop & rotate', subtitle: 'Straighten and trim a photo', icon: 'crop', color: '#15171B', accepts: 'image', multi: false },
  { id: 'format', title: 'Convert image', subtitle: 'JPG · PNG · WEBP', icon: 'swap-horizontal', color: '#3E5A7A', accepts: 'image', multi: false },
  { id: 'compress', title: 'Compress & resize', subtitle: 'Make photos smaller to send', icon: 'contract', color: '#16A36A', accepts: 'image', multi: false },
  { id: 'img2pdf', title: 'Images to PDF', subtitle: 'Combine photos into one PDF', icon: 'documents', color: '#C2413A', accepts: 'image', multi: true },
  { id: 'merge', title: 'Merge PDFs', subtitle: 'Join several PDFs', icon: 'git-merge', color: '#B08A5B', accepts: 'pdf', multi: true },
  { id: 'split', title: 'Split PDF', subtitle: 'One document per page', icon: 'cut', color: '#FF7A45', accepts: 'pdf', multi: false },
  { id: 'extract', title: 'Extract pages', subtitle: 'Pick pages, e.g. 1-3, 5', icon: 'albums', color: '#6B5B95', accepts: 'pdf', multi: false },
  { id: 'rotate', title: 'Rotate PDF', subtitle: 'Fix sideways scans', icon: 'refresh-circle', color: '#14112B', accepts: 'pdf', multi: false },
];

export const toolById = (id: string) => TOOLS.find((t) => t.id === id);
