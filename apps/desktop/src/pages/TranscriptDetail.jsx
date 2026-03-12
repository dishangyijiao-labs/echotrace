import { useEffect, useMemo, useRef, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
  const [subtitleWriting, setSubtitleWriting] = useState(false);
  const [subtitleStatus, setSubtitleStatus] = useState(null);

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
    return <div className="empty-state">{t('transcriptDetail.notFound')}</div>;
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

  const writeSubtitle = async () => {
    try {
      setSubtitleWriting(true);
      setSubtitleStatus(null);
      const response = await api.post(`/transcripts/${id}/write-subtitle`);
      const path = response.data?.srt_path || "";
      setSubtitleStatus({ ok: true, message: t('transcriptDetail.timeline.subtitleSuccess', { path }) });
    } catch (error) {
      setSubtitleStatus({ ok: false, message: t('transcriptDetail.timeline.subtitleFailed') });
      console.error("Failed to write subtitle:", error);
    } finally {
      setSubtitleWriting(false);
    }
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
          <p className="text-sm text-gray-500">{t('transcriptDetail.language', { lang: transcript.language || "-" })}</p>
        </div>
      </div>

      <div className="form-search">
        <Search className="form-search-icon" />
        <input
          className="form-search-input"
          placeholder={t('transcriptDetail.searchPlaceholder')}
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900">{t('transcriptDetail.fullText')}</h2>
          <div className="mt-4 text-sm text-gray-700 whitespace-pre-wrap leading-7">
            {highlighted}
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900">{t('transcriptDetail.summary.title')}</h2>
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">{t('transcriptDetail.summary.provider')}</label>
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
                <label className="text-sm font-medium text-gray-700">{t('transcriptDetail.summary.model')}</label>
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
                  <option value="custom">{t('transcriptDetail.summary.custom')}</option>
                </select>
                {model === "custom" ? (
                  <input
                    className="form-input mt-2"
                    value={customModel}
                    onChange={(event) => setCustomModel(event.target.value)}
                    placeholder={t('transcriptDetail.summary.customPlaceholder')}
                  />
                ) : null}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('transcriptDetail.summary.prompt')}</label>
                <select
                  className="form-input"
                  value={promptType}
                  onChange={(event) => setPromptType(event.target.value)}
                >
                  <option value="summary">{t('transcriptDetail.summary.promptSummary')}</option>
                  <option value="outline">{t('transcriptDetail.summary.promptOutline')}</option>
                  <option value="action_items">{t('transcriptDetail.summary.promptActionItems')}</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={runSummary}
              disabled={summarizing || (model === "custom" && !customModel.trim())}
            >
              {summarizing ? t('transcriptDetail.summary.generating') : t('transcriptDetail.summary.generate')}
            </button>
            <div className="text-sm text-gray-700 whitespace-pre-wrap min-h-[120px]">
              {summary || t('transcriptDetail.summary.empty')}
            </div>
          </div>
        </div>

        <div className="card lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900">{t('transcriptDetail.timeline.title')}</h2>
          {mediaSrc ? (
            <div className="mt-4">
              <audio ref={audioRef} src={mediaSrc} controls className="w-full" />
              <p className="mt-2 text-xs text-gray-500">
                {t('transcriptDetail.timeline.clickToJump', { time: formatTime(currentTime) })}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500">{t('transcriptDetail.timeline.noMedia')}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => jumpSegment("prev")}
            >
              {t('transcriptDetail.timeline.prevSegment')}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => jumpSegment("next")}
            >
              {t('transcriptDetail.timeline.nextSegment')}
            </button>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={followPlayback}
                onChange={(event) => setFollowPlayback(event.target.checked)}
              />
              {t('transcriptDetail.timeline.followPlayback')}
            </label>
            {mediaSrc ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={writeSubtitle}
                disabled={subtitleWriting}
              >
                {subtitleWriting ? t('transcriptDetail.timeline.writingSubtitle') : t('transcriptDetail.timeline.writeSubtitle')}
              </button>
            ) : null}
          </div>
          {subtitleStatus && (
            <div
              className={`mt-2 text-sm px-3 py-2 rounded ${
                subtitleStatus.ok
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {subtitleStatus.message}
            </div>
          )}
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
              <p className="text-sm text-gray-500">{t('transcriptDetail.timeline.noSegments')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TranscriptDetail;
