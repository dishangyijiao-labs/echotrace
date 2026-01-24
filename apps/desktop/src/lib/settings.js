const STORAGE_KEY = "echotrace.playback.settings";

export const DEFAULT_SETTINGS = {
  playbackRate: 1.0,
  loopSegment: false,
  autoPlaySegment: true
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (error) {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn("Failed to save settings", error);
  }
}
