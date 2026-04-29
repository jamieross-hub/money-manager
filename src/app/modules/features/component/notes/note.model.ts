export interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
}

export interface NoteColor {
  label: string;
  value: string;
  bgClass: string;
}

export const NOTE_COLORS: NoteColor[] = [
  { label: 'Default',  value: 'default',  bgClass: 'color-default' },
  { label: 'Rose',     value: 'rose',     bgClass: 'color-rose' },
  { label: 'Amber',    value: 'amber',    bgClass: 'color-amber' },
  { label: 'Emerald',  value: 'emerald',  bgClass: 'color-emerald' },
  { label: 'Sky',      value: 'sky',      bgClass: 'color-sky' },
  { label: 'Violet',   value: 'violet',   bgClass: 'color-violet' },
  { label: 'Teal',     value: 'teal',     bgClass: 'color-teal' },
];
