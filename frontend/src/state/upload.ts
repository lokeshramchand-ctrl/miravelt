import * as DocumentPicker from 'expo-document-picker';
import { create } from 'zustand';
import { statementsRepository } from '../api/instance';
import { ApiException, ApiPayloadTooLargeException } from '../api/errors';
import type { Statement } from '../domain/types';
import { invalidatePeriods } from '../hooks/periods';
import { useSettings } from './settings';

export type UploadStage = 'idle' | 'uploading' | 'recognized' | 'rejected';

interface UploadState {
  stage: UploadStage;
  fileName: string | null;
  fileSizeBytes: number | null;
  progressPercent: number;
  jobId: string | null;
  statement: Statement | null;
  errorMessage: string | null;
  /** Whether the Uploading sheet is on screen (it is hosted once, at the app root). */
  sheetOpen: boolean;

  pickAndUpload(): Promise<void>;
  retryWithPassword(password: string): Promise<void>;
  cancel(): void;
  reset(): void;
  openSheet(): void;
  closeSheet(): void;
}

const INITIAL = {
  stage: 'idle' as UploadStage,
  fileName: null,
  fileSizeBytes: null,
  progressPercent: 0,
  jobId: null,
  statement: null,
  errorMessage: null,
};

let abort: AbortController | null = null;
let last: { uri: string; name: string; size: number } | null = null;

export function looksLikePasswordIssue(message: string | null | undefined): boolean {
  return (message ?? '').toLowerCase().includes('password');
}

export const useUpload = create<UploadState>((set, get) => {
  async function upload(file: { uri: string; name: string; size: number }, password?: string) {
    abort = new AbortController();
    const signal = abort.signal;
    set({ stage: 'uploading', fileName: file.name, fileSizeBytes: file.size, progressPercent: 0, errorMessage: null });
    try {
      const response = await statementsRepository.upload({
        uri: file.uri,
        filename: file.name,
        password,
        keepOriginalPdf: useSettings.getState().keepOriginalPdfs,
        signal,
        onProgress: (sent, total) => {
          if (total > 0 && !signal.aborted) set({ progressPercent: (sent / total) * 100 });
        },
      });
      const statement = await statementsRepository.get(response.statementId);
      if (signal.aborted) return;
      set({ stage: 'recognized', jobId: response.jobId, statement });
      invalidatePeriods();
    } catch (e) {
      if (signal.aborted) return; // cancelled by the user: cancel() already reset the state
      if (e instanceof ApiPayloadTooLargeException) {
        set({ stage: 'rejected', errorMessage: 'This file is too large - Miravelt accepts statements up to 10MB.' });
      } else if (e instanceof ApiException) {
        set({ stage: 'rejected', errorMessage: e.message });
      } else {
        set({ stage: 'rejected', errorMessage: 'Something went wrong. Please try again.' });
      }
    }
  }

  return {
    ...INITIAL,
    sheetOpen: false,

    async pickAndUpload() {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      last = { uri: asset.uri, name: asset.name, size: asset.size ?? 0 };
      await upload(last);
    },

    async retryWithPassword(password) {
      if (!last) return;
      await upload(last, password);
    },

    cancel() {
      abort?.abort();
      set({ ...INITIAL });
    },

    reset: () => set({ ...INITIAL }),
    openSheet: () => set({ sheetOpen: true }),
    closeSheet: () => set({ sheetOpen: false }),
  };
});

/** Opens the file picker inside the Uploading sheet, then routes to Analysing/Rejected as the upload resolves. */
export function startUploadFlow(): void {
  useUpload.getState().reset();
  useUpload.getState().openSheet();
}

export const getUploadStage = () => useUpload.getState().stage;
