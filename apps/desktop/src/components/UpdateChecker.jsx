import { useState, useEffect } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { Download, X, RefreshCw } from 'lucide-react';

const UpdateChecker = () => {
  const [update, setUpdate] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkForUpdate();
  }, []);

  const checkForUpdate = async () => {
    try {
      const result = await check();
      if (result?.available) {
        setUpdate(result);
      }
    } catch (e) {
      console.log('Update check failed:', e);
    }
  };

  const installUpdate = async () => {
    if (!update) return;
    setInstalling(true);
    try {
      let downloaded = 0;
      let contentLength = 0;
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              setProgress(Math.round((downloaded / contentLength) * 100));
            }
            break;
          case 'Finished':
            break;
        }
      });
      // Tauri will automatically restart the app after install
    } catch (e) {
      console.error('Update failed:', e);
      setInstalling(false);
    }
  };

  if (!update || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border border-blue-200 rounded-lg shadow-lg p-4 max-w-sm">
      <div className="flex items-start gap-3">
        <Download className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm">
            New version available: {update.version}
          </p>
          {update.body && (
            <p className="text-gray-600 text-xs mt-1 line-clamp-2">{update.body}</p>
          )}
          <div className="mt-3 flex items-center gap-2">
            {installing ? (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <RefreshCw className="h-4 w-4 animate-spin" />
                {progress !== null ? `${progress}%` : 'Downloading...'}
              </div>
            ) : (
              <>
                <button
                  onClick={installUpdate}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded font-medium"
                >
                  Install & Restart
                </button>
                <button
                  onClick={() => setDismissed(true)}
                  className="text-gray-500 hover:text-gray-700 text-xs px-2 py-1.5"
                >
                  Later
                </button>
              </>
            )}
          </div>
        </div>
        {!installing && (
          <button onClick={() => setDismissed(true)} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default UpdateChecker;
