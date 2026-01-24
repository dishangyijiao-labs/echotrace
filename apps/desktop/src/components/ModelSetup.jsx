import { useState, useEffect } from 'react';
import { CheckCircle, Download, AlertCircle, Loader } from 'lucide-react';

const ModelSetup = ({ onComplete }) => {
  const [models, setModels] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [currentDownload, setCurrentDownload] = useState(null);
  const [error, setError] = useState(null);

  const recommendedModel = 'base'; // Default model for first-time users

  useEffect(() => {
    checkModels();
  }, []);

  const checkModels = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8787/models');
      const data = await response.json();
      setModels(data.models);

      // Check if recommended model is downloaded
      const baseModel = data.models.find(m => m.name === recommendedModel);
      if (baseModel?.downloaded) {
        // Auto-complete if base model exists
        setTimeout(() => onComplete?.(), 1500);
      }
    } catch (err) {
      setError('无法连接到 Core API，请确保服务已启动');
    }
  };

  const downloadModel = async (modelName) => {
    setDownloading(true);
    setCurrentDownload(modelName);
    setError(null);

    try {
      const response = await fetch(
        `http://127.0.0.1:8787/models/${modelName}/download`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error('下载失败');
      }

      const data = await response.json();
      
      // Refresh models list
      await checkModels();
      
      setDownloading(false);
      setCurrentDownload(null);

      // Auto-complete after successful download
      if (modelName === recommendedModel) {
        setTimeout(() => onComplete?.(), 1000);
      }
    } catch (err) {
      setError(`下载模型失败: ${err.message}`);
      setDownloading(false);
      setCurrentDownload(null);
    }
  };

  const getModelIcon = (model) => {
    if (downloading && currentDownload === model.name) {
      return <Loader className="h-5 w-5 text-blue-500 animate-spin" />;
    }
    if (model.downloaded) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    return <Download className="h-5 w-5 text-gray-400" />;
  };

  const getModelDescription = (model) => {
    const descriptions = {
      'tiny': '最快，精度较低（仅测试用）',
      'base': '推荐：速度快，精度适中',
      'small': '较好的精度，速度较慢',
      'medium': '高精度，需要较长时间',
      'large-v2': '最高精度，处理很慢',
      'large-v3': '最高精度（最新版），处理很慢'
    };
    return descriptions[model.name] || '';
  };

  const baseModel = models.find(m => m.name === recommendedModel);
  const isReady = baseModel?.downloaded;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            欢迎使用 EchoTrace
          </h1>
          <p className="text-gray-600">
            首次使用需要下载 Whisper 转录模型
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-red-800 text-sm">{error}</div>
          </div>
        )}

        {!isReady && (
          <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">
              推荐：下载 Base 模型
            </h3>
            <p className="text-blue-800 text-sm mb-4">
              Base 模型（142MB）提供了速度和精度的最佳平衡，适合大多数使用场景。
            </p>
            <button
              onClick={() => downloadModel(recommendedModel)}
              disabled={downloading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {downloading ? (
                <>
                  <Loader className="h-5 w-5 animate-spin" />
                  正在下载...
                </>
              ) : (
                <>
                  <Download className="h-5 w-5" />
                  下载 Base 模型 (142 MB)
                </>
              )}
            </button>
          </div>
        )}

        {isReady && (
          <div className="mb-8 p-6 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-3 text-green-800">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <div>
                <h3 className="font-semibold">模型已就绪！</h3>
                <p className="text-sm">即将进入主界面...</p>
              </div>
            </div>
          </div>
        )}

        <div className="border-t pt-6">
          <h3 className="font-semibold text-gray-900 mb-4">所有可用模型</h3>
          <div className="space-y-3">
            {models.map((model) => (
              <div
                key={model.name}
                className={`p-4 rounded-lg border ${
                  model.name === recommendedModel
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {getModelIcon(model)}
                      <span className="font-medium text-gray-900">
                        {model.name}
                      </span>
                      {model.name === recommendedModel && (
                        <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded">
                          推荐
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {getModelDescription(model)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      大小: {model.size_mb} MB • 参数: {model.params}
                    </p>
                  </div>
                  {!model.downloaded && (
                    <button
                      onClick={() => downloadModel(model.name)}
                      disabled={downloading}
                      className="ml-4 text-blue-600 hover:text-blue-800 disabled:text-gray-400 text-sm font-medium"
                    >
                      下载
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>💡 提示：模型文件存储在 ~/.cache/huggingface/</p>
          <p className="mt-1">可以随时在设置中切换或下载其他模型</p>
        </div>
      </div>
    </div>
  );
};

export default ModelSetup;
