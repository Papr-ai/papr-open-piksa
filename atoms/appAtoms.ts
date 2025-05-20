import { atom } from 'jotai';
import type { AppOutput } from '@/types/app';

export const appOutputAtom = atom<AppOutput[]>([]);
export const selectedAppIdAtom = atom<number | null>(null);
export const appUrlAtom = atom<{
  appUrl: string | null;
  originalUrl: string | null;
}>({
  appUrl: null,
  originalUrl: null,
});
export const previewErrorMessageAtom = atom<string | undefined>(undefined);
