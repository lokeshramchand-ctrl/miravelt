import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { api, appUpdateRepository } from '../api/instance';
import { ApiException } from '../api/errors';
import type { AppUpdateInfo } from '../domain/types';

export type AppUpdateStage = 'idle' | 'checking' | 'upToDate' | 'available' | 'downloading' | 'readyToInstall' | 'error';

interface AppUpdateState {
  stage: AppUpdateStage;
  info: AppUpdateInfo | null;
  progressPercent: number;
  errorMessage: string | null;
  checkForUpdate(): Promise<void>;
  downloadAndInstall(): Promise<void>;
  cancelDownload(): void;
  dismiss(): void;
}

let download: FileSystem.DownloadResumable | null = null;
let cancelled = false;

/** Android's versionCode - the same integer the backend compares against as version_code. */
export function currentVersionCode(): number {
  const parsed = parseInt(Application.nativeBuildVersion ?? '', 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

const INITIAL = { stage: 'idle' as AppUpdateStage, info: null, progressPercent: 0, errorMessage: null };

export const useAppUpdate = create<AppUpdateState>((set, get) => ({
  ...INITIAL,

  /**
   * Fire-and-forget, called once from the tab shell on launch - a broken or
   * unreachable update check must never interrupt the user's actual session,
   * so failures are swallowed here rather than surfaced. Self-hosted updates
   * ship as an APK, so there is nothing to offer on other platforms.
   */
  async checkForUpdate() {
    if (Platform.OS !== 'android' || get().stage === 'checking') return;
    set({ stage: 'checking', errorMessage: null });
    try {
      const info = await appUpdateRepository.checkForUpdate();
      if (info == null || info.versionCode <= currentVersionCode()) {
        set({ stage: 'upToDate' });
        return;
      }
      set({ stage: 'available', info });
    } catch {
      set({ stage: 'idle' });
    }
  },

  async downloadAndInstall() {
    const info = get().info;
    if (!info) return;
    cancelled = false;
    set({ stage: 'downloading', progressPercent: 0, errorMessage: null });
    try {
      const target = `${FileSystem.documentDirectory}miravelt-update-${info.versionCode}.apk`;
      download = FileSystem.createDownloadResumable(info.downloadUrl, target, { headers: await api.authHeaders() }, ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
        if (totalBytesExpectedToWrite > 0) set({ progressPercent: (totalBytesWritten / totalBytesExpectedToWrite) * 100 });
      });
      const result = await download.downloadAsync();
      if (cancelled) return;
      if (!result || result.status < 200 || result.status >= 300) throw new Error(`Download failed (${result?.status ?? 'no response'})`);
      set({ stage: 'readyToInstall' });
      await installApk(result.uri);
    } catch (e) {
      if (cancelled) return;
      set({ stage: 'error', errorMessage: e instanceof ApiException ? e.message : "Couldn't install the update. Please try again." });
    }
  },

  cancelDownload() {
    cancelled = true;
    void download?.pauseAsync().catch(() => {});
    set({ stage: 'available' });
  },

  dismiss: () => set({ ...INITIAL }),
}));

/**
 * Hands off to Android's own package installer. Android still shows its own
 * "install unknown app" confirmation - nothing here bypasses that. Throws if
 * the OS couldn't launch the installer at all, so the caller can show a real
 * error instead of silently doing nothing.
 */
async function installApk(fileUri: string): Promise<void> {
  const contentUri = await FileSystem.getContentUriAsync(fileUri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    type: 'application/vnd.android.package-archive',
  });
}
