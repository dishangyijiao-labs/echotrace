const STORAGE_KEY = "echotrace.mcp.preferences";

export const DEFAULT_PREFERENCES = {
  provider: "openai",
  model: "gpt-4o-mini",
  customModel: "",
  promptType: "summary"
};

export function loadPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch (error) {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (error) {
    console.warn("Failed to save preferences", error);
  }
}
