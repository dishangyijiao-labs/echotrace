import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "../lib/settings";

function Settings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">播放设置</h1>
        <p className="mt-2 text-gray-600">控制转录播放与时间轴联动行为。</p>
      </div>

      <div className="card space-y-6">
        <div>
          <label className="text-sm font-medium text-gray-700">播放速度</label>
          <div className="mt-2 flex items-center gap-4">
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.playbackRate}
              onChange={(event) =>
                updateSetting("playbackRate", Number(event.target.value))
              }
              className="w-64"
            />
            <span className="text-sm text-gray-600">
              {settings.playbackRate.toFixed(1)}x
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between border rounded-xl p-4">
          <div>
            <p className="text-sm font-medium text-gray-900">点击分段自动播放</p>
            <p className="text-xs text-gray-500">跳转到时间轴后立即播放</p>
          </div>
          <input
            type="checkbox"
            checked={settings.autoPlaySegment}
            onChange={(event) => updateSetting("autoPlaySegment", event.target.checked)}
          />
        </div>

        <div className="flex items-center justify-between border rounded-xl p-4">
          <div>
            <p className="text-sm font-medium text-gray-900">循环当前分段</p>
            <p className="text-xs text-gray-500">播放到分段结尾后自动回放</p>
          </div>
          <input
            type="checkbox"
            checked={settings.loopSegment}
            onChange={(event) => updateSetting("loopSegment", event.target.checked)}
          />
        </div>
      </div>
    </div>
  );
}

export default Settings;
