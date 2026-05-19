import { defineChain } from '../../core/scenes';

export const RAID_CHAIN = defineChain([
  'raid:title',
  'raid:photo',
  'raid:link',
  'raid:price',
  'raid:description',
  'raid:date',
  'raid:review',
] as const);

/** State accumulated across the wizard. Stored in scene session. */
export interface RaidDraft {
  title?: string;
  photoFileIds?: string[];
  link?: string | null;
  price?: number;
  currency?: string;
  description?: string;
  endDate?: string | null; // ISO
}
