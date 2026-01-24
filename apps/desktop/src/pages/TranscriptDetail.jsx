import { useEffect, useMemo, useRef, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";
import api from "../lib/api";
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences
} from "../lib/preferences";
import { DEFAULT_SETTINGS, loadSettings } from "../lib/settings";

const formatTime = (seconds) => {
  if (seconds === null || seconds === undefined) return "-";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

function TranscriptDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [transcript, setTranscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [provider, setProvider] = useState(DEFAULT_PREFERENCES.provider);
  const [model, setModel] = useState(DEFAULT_PREFERENCES.model);
  const [customModel, setCustomModel] = useState(DEFAULT_PREFERENCES.customModel);
  const [promptType, setPromptType] = useState(DEFAULT_PREFERENCES.promptType);
  const [providerConfig, setProviderConfig] = useState({});
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);
  const [playbackSettings, setPlaybackSettings] = useState(DEFAULT_SETTINGS);
  const [activeSegmentId, setActiveSegmentId] = useState(null);
  const [followPlayback, setFollowPlayback] = useState(true);
  const segmentRefs = useRef({});

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/transcripts/${id}`);
        const payload = response.data?.data || null;
        setTranscript(payload);
        setSummary(payload?.summary || "");
      } catch (error) {
        console.error("Failed to load transcript:", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !transcript?.segments?.length) return;
    const handler = () => {
      const time = audio.currentTime || 0;
      setCurrentTime(time);
      const active = transcript.segments.find(
        (segment) => time >= segment.start && time <= segment.end
      );
      if (active && active.id !== activeSegmentId) {
        setActiveSegmentId(active.id);
      }
    };
    audio.addEventListener("timeupdate", handler);
    return () => audio.removeEventListener("timeupdate", handler);
  }, [transcript?.media_path, transcript?.segments, activeSegmentId]);

  useEffect(() => {
    setPlaybackSettings(loadSettings());
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackSettings.playbackRate;
  }, [playbackSettings.playbackRate, transcript?.media_path]);

  useEffect(() => {
    if (!playbackSettings.loopSegment || !audioRef.current) return;
    const active = transcript?.segments?.find(
      (segment) => segment.id === activeSegmentId
    );
    if (!active) return;
    if (currentTime > active.end) {
      audioRef.current.currentTime = active.start;
      audioRef.current.play();
    }
  }, [currentTime, playbackSettings.loopSegment, activeSegmentId, transcript?.segments]);

  useEffect(() => {
    if (!followPlayback || !activeSegmentId) return;
    const node = segmentRefs.current[activeSegmentId];
    if (node) {
      node.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [activeSegmentId, followPlayback]);

  useEffect(() => {
    const prefs = loadPreferences();
    setProvider(prefs.provider);
    setModel(prefs.model);
    setCustomModel(prefs.customModel || "");
    setPromptType(prefs.promptType);
  }, []);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await invoke("load_mcp_config");
        setProviderConfig(config || {});
      } catch (error) {
        console.error("Failed to load MCP config:", error);
      }
    };
    loadConfig();
  }, []);

  useEffect(() => {
    savePreferences({ provider, model, customModel, promptType });
  }, [provider, model, customModel, promptType]);

  useEffect(() => {
    const options = providerConfig?.[provider]?.models || [];
    if (!options.includes(model) && model !== "custom") {
      setModel(options.length ? options[0] : "custom");
    }
  }, [provider, providerConfig]);

  useEffect(() => {
    const keyword = searchParams.get("q") || "";
    if (keyword !== searchTerm) {
      setSearchTerm(keyword);
    }
  }, [searchParams, searchTerm]);

  useEffect(() => {
    if (!transcript?.segments?.length) return;
    const segmentParam = searchParams.get("segment");
    if (segmentParam) {
      const segmentId = Number(segmentParam);
      const target = transcript.segments.find((segment) => segment.id === segmentId);
      if (target) {
        setActiveSegmentId(target.id);
        if (audioRef.current) {
          audioRef.current.currentTime = target.start;
        }
        return;
      }
    }
    const timeParam = searchParams.get("t");
    if (timeParam) {
      const time = Number(timeParam);
      if (!Number.isNaN(time) && audioRef.current) {
        audioRef.current.currentTime = time;
      }
    }
  }, [searchParams, transcript]);

  const highlighted = useMemo(() => {
    if (!transcript?.content || !searchTerm.trim()) return transcript?.content || "";
    const term = searchTerm.trim();
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    return transcript.content.split(regex).map((part, index) => {
      const isMatch = part.toLowerCase() === term.toLowerCase();
      if (!isMatch) return <span key={index}>{part}</span>;
      return (
        <mark key={index} className="bg-yellow-100 text-yellow-800 px-1 rounded">
          {part}
        </mark>
      );
    });
  }, [transcript, searchTerm]);

  const highlightSegment = (text) => {
    if (!searchTerm.trim() || !text) return text;
    const term = searchTerm.trim();
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    return text.split(regex).map((part, index) => {
      const isMatch = part.toLowerCase() === term.toLowerCase();
      if (!isMatch) return <span key={index}>{part}</span>;
      return (
        <mark key={index} className="bg-yellow-100 text-yellow-800 px-1 rounded">
          {part}
        </mark>
      );
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="spinner w-8 h-8" />
      </div>
    );
  }

  if (!transcript) {
    return <div className="empty-state">未找到转录文本。</div>;
  }

  const mediaSrc = transcript.media_path
    ? convertFileSrc(transcript.media_path)
    : "";

  const playSegment = (start) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = start;
    if (playbackSettings.autoPlaySegment) {
      audioRef.current.play();
    }
  };

  const jumpSegment = (direction) => {
    if (!transcript?.segments?.length) return;
    const list = transcript.segments;
    const currentIndex = list.findIndex((segment) => segment.id === activeSegmentId);
    const nextIndex =
      currentIndex === -1
        ? 0
        : direction === "next"
          ? Math.min(currentIndex + 1, list.length - 1)
          : Math.max(currentIndex - 1, 0);
    const target = list[nextIndex];
    if (!target) return;
    setActiveSegmentId(target.id);
    playSegment(target.start);
  };

  const runSummary = async () => {
    if (!transcript?.content) return;
    try {
      setSummarizing(true);
      const modelName = model === "custom" ? customModel : model;
      const response = await api.post("/summarize", {
        provider,
        model: modelName,
        prompt_type: promptType,
        text: transcript.content,
        transcript_id: transcript.id,
        update_summary: true
      });
      setSummary(response.data?.summary || "");
    } catch (error) {
      console.error("Failed to summarize:", error);
    } finally {
      setSummarizing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link className="text-gray-500 hover:text-gray-700" to="/results">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{transcript.filename}</h1>
          <p className="text-sm text-gray-500">语言: {transcript.language || "-"}</p>
        </div>
      </div>

      <div className="form-search">
        <Search className="form-search-icon" />
        <input
          className="form-search-input"
          placeholder="搜索文本内容"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900">全文</h2>
          <div className="mt-4 text-sm text-gray-700 whitespace-pre-wrap leading-7">
            {highlighted}
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900">摘要</h2>
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Provider</label>
                <select
                  className="form-input"
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                >
                  <option value="openai">OpenAI</option>
                  <option value="claude">Claude</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="doubao">Doubao</option>
                  <option value="local">Local</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Model</label>
                <select
                  className="form-input"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                >
                  {(providerConfig?.[provider]?.models || []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  <option value="custom">自定义</option>
                </select>
                {model === "custom" ? (
                  <input
                    className="form-input mt-2"
                    value={customModel}
                    onChange={(event) => setCustomModel(event.target.value)}
                    placeholder="输入模型名称"
                  />
                ) : null}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Prompt</label>
                <select
                  className="form-input"
                  value={promptType}
                  onChange={(event) => setPromptType(event.target.value)}
                >
                  <option value="summary">摘要</option>
                  <option value="outline">提纲</option>
                  <option value="action_items">行动项</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={runSummary}
              disabled={summarizing || (model === "custom" && !customModel.trim())}
            >
              {summarizing ? "生成中..." : "生成摘要"}
            </button>
            <div className="text-sm text-gray-700 whitespace-pre-wrap min-h-[120px]">
              {summary || "还没有摘要。"}
            </div>
          </div>
        </div>

        <div className="card lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900">时间轴</h2>
          {mediaSrc ? (
            <div className="mt-4">
              <audio ref={audioRef} src={mediaSrc} controls className="w-full" />
              <p className="mt-2 text-xs text-gray-500">
                点击分段可跳转播放。当前播放时间：{formatTime(currentTime)}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500">未找到媒体文件路径。</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => jumpSegment("prev")}
            >
              上一段
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => jumpSegment("next")}
            >
              下一段
            </button>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={followPlayback}
                onChange={(event) => setFollowPlayback(event.target.checked)}
              />
              跟随播放
            </label>
          </div>
          <div className="mt-4 space-y-3 max-h-[480px] overflow-y-auto pr-2 scrollbar-thin">
            {transcript.segments?.length ? (
              transcript.segments.map((segment) => (
                <button
                  type="button"
                  key={segment.id}
                  ref={(node) => {
                    if (node) segmentRefs.current[segment.id] = node;
                  }}
                  className={`w-full text-left border rounded-xl p-3 transition-colors ${
                    activeSegmentId === segment.id
                      ? "bg-blue-50 border-blue-300"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => {
                    setActiveSegmentId(segment.id);
                    playSegment(segment.start);
                  }}
                >
                  <div className="text-xs text-gray-500">
                    {formatTime(segment.start)} - {formatTime(segment.end)}
                  </div>
                  <div className="mt-1 text-sm text-gray-800">
                    {highlightSegment(segment.text)}
                  </div>
                </button>
              ))
            ) : (
              <p className="text-sm text-gray-500">暂无分段信息。</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TranscriptDetail;
