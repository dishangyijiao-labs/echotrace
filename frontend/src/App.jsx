import { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'

const API_BASE = 'http://localhost:8000/api'

function App() {
  const [mediaFiles, setMediaFiles] = useState([])
  const [filePaths, setFilePaths] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  // 加载所有媒体文件
  const loadMediaFiles = async () => {
    try {
      const response = await axios.get(`${API_BASE}/files/`)
      setMediaFiles(response.data)
    } catch (error) {
      setMessage('加载文件列表失败: ' + error.message)
    }
  }

  useEffect(() => {
    loadMediaFiles()
  }, [])

  // 批量上传文件
  const handleBatchUpload = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const paths = filePaths.split('\n').filter(p => p.trim())
      const response = await axios.post(`${API_BASE}/files/batch_upload/`, {
        file_paths: paths
      })

      setMessage(`成功添加 ${response.data.success} 个文件,失败 ${response.data.failed} 个`)
      setFilePaths('')
      loadMediaFiles()
    } catch (error) {
      setMessage('上传失败: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // 批量转录
  const handleBatchTranscribe = async () => {
    setLoading(true)
    setMessage('正在转录,请稍候...')

    try {
      const response = await axios.post(`${API_BASE}/files/batch_transcribe/`)
      setMessage(`转录完成!成功 ${response.data.success} 个,失败 ${response.data.failed} 个`)
      loadMediaFiles()
    } catch (error) {
      setMessage('转录失败: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // 搜索
  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setLoading(true)
    try {
      const response = await axios.get(`${API_BASE}/files/search/?q=${encodeURIComponent(searchQuery)}`)
      setSearchResults(response.data.results)
      setMessage(`找到 ${response.data.count} 个结果`)
    } catch (error) {
      setMessage('搜索失败: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // 转录单个文件
  const transcribeSingle = async (id) => {
    setLoading(true)
    try {
      await axios.post(`${API_BASE}/files/${id}/transcribe/`)
      setMessage('转录成功!')
      loadMediaFiles()
    } catch (error) {
      setMessage('转录失败: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const displayFiles = searchResults.length > 0 ? searchResults : mediaFiles

  return (
    <div className="container">
      <h1>媒体文件转录管理系统</h1>

      {message && (
        <div className="message">
          {message}
        </div>
      )}

      {/* 批量上传 */}
      <section className="section">
        <h2>批量添加本地文件</h2>
        <form onSubmit={handleBatchUpload}>
          <textarea
            value={filePaths}
            onChange={(e) => setFilePaths(e.target.value)}
            placeholder="输入本地文件路径,每行一个&#10;例如:&#10;/path/to/video1.mp4&#10;/path/to/audio1.mp3"
            rows={5}
            disabled={loading}
          />
          <button type="submit" disabled={loading || !filePaths.trim()}>
            {loading ? '处理中...' : '添加文件'}
          </button>
        </form>
      </section>

      {/* 批量转录 */}
      <section className="section">
        <h2>批量转录</h2>
        <button
          onClick={handleBatchTranscribe}
          disabled={loading}
          className="transcribe-btn"
        >
          {loading ? '转录中...' : '转录所有待处理文件'}
        </button>
      </section>

      {/* 搜索 */}
      <section className="section">
        <h2>搜索</h2>
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索文件名或转录文本..."
            disabled={loading}
          />
          <button type="submit" disabled={loading || !searchQuery.trim()}>
            搜索
          </button>
          {searchResults.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSearchResults([])
                setSearchQuery('')
                setMessage('')
              }}
            >
              清除搜索
            </button>
          )}
        </form>
      </section>

      {/* 文件列表 */}
      <section className="section">
        <h2>文件列表 ({displayFiles.length})</h2>
        <div className="file-list">
          {displayFiles.length === 0 ? (
            <p>暂无文件</p>
          ) : (
            displayFiles.map((file) => (
              <div key={file.id} className="file-item">
                <div className="file-header">
                  <h3>{file.filename}</h3>
                  <span className={`status status-${file.status}`}>
                    {file.status}
                  </span>
                </div>
                <div className="file-info">
                  <p><strong>路径:</strong> {file.file_path}</p>
                  {file.duration && (
                    <p><strong>时长:</strong> {file.duration.toFixed(2)}秒</p>
                  )}
                  {file.language && (
                    <p><strong>语言:</strong> {file.language}</p>
                  )}
                  {file.file_size && (
                    <p><strong>大小:</strong> {(file.file_size / 1024 / 1024).toFixed(2)} MB</p>
                  )}
                </div>
                {file.status === 'pending' && (
                  <button
                    onClick={() => transcribeSingle(file.id)}
                    disabled={loading}
                    className="small-btn"
                  >
                    转录此文件
                  </button>
                )}
                {file.transcript_text && (
                  <div className="transcript">
                    <h4>转录文本:</h4>
                    <p>{file.transcript_text}</p>
                  </div>
                )}
                {file.segments && file.segments.length > 0 && (
                  <details>
                    <summary>查看分段 ({file.segments.length})</summary>
                    <div className="segments">
                      {file.segments.map((seg) => (
                        <div key={seg.id} className="segment">
                          <span className="time">
                            [{seg.start_time.toFixed(1)}s - {seg.end_time.toFixed(1)}s]
                          </span>
                          <span className="text">{seg.text}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

export default App
