import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import {
  ArrowLeft,
  Search,
  Download,
  Edit,
  Save,
  X,
  Clock,
  FolderOpen,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Copy,
  Check
} from 'lucide-react'

function TranscriptDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  // 基础状态
  const [transcript, setTranscript] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // 搜索相关状态
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1)
  
  // 编辑相关状态
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  
  // NAS目录相关状态
  const [nasDirectories, setNasDirectories] = useState([])
  const [copiedPath, setCopiedPath] = useState('')

  // 加载转录详情
  const loadTranscript = useCallback(async () => {
    try {
      setLoading(true)
      const response = await axios.get(`/transcripts/${id}/`)
      setTranscript(response.data)
      setEditContent(response.data.content || '')
      
      // 模拟NAS目录数据（实际应该从API获取）
      setNasDirectories([
        {
          id: 1,
          name: '主存储NAS',
          path: `/nas/storage/media/${response.data.filename}`,
          url: `smb://nas.company.com/storage/media/${response.data.filename}`,
          type: 'smb'
        },
        {
          id: 2,
          name: '备份NAS',
          path: `/nas/backup/media/${response.data.filename}`,
          url: `smb://backup-nas.company.com/backup/media/${response.data.filename}`,
          type: 'smb'
        }
      ])
    } catch (err) {
      console.error('Failed to load transcript:', err)
      setError('加载转录详情失败')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadTranscript()
  }, [loadTranscript])

  // 提取时间戳的辅助函数
  const extractTimestamp = (content, matchIndex) => {
    // 从匹配位置向前查找最近的时间戳
    const beforeMatch = content.substring(0, matchIndex)
    const lines = beforeMatch.split('\n')
    
    // 从后往前查找包含时间戳的行
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]
      const timestampMatch = line.match(/^\[(\d{2}:\d{2}:\d{2})\]/)
      if (timestampMatch) {
        return timestampMatch[1] // 返回时间戳字符串，如 "00:01:23"
      }
    }
    
    return null // 如果没找到时间戳
  }

  // 搜索功能通过useEffect实现防抖
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!searchTerm.trim() || !transcript?.content) {
        setSearchResults([])
        setCurrentSearchIndex(-1)
        return
      }

      const content = transcript.content
      const term = searchTerm.trim()
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      const matches = []
      let match

      while ((match = regex.exec(content)) !== null) {
        const timestamp = extractTimestamp(content, match.index)
        
        matches.push({
          index: match.index,
          length: match[0].length, // 使用实际匹配文本的长度
          context: content.substring(
            Math.max(0, match.index - 50),
            Math.min(content.length, match.index + match[0].length + 50)
          ),
          timestamp: timestamp, // 添加时间戳信息
          nasPath: transcript.nas_path || null, // 添加NAS路径信息
          nasConnection: transcript.nas_directories?.[0]?.name || null // 添加NAS连接名称
        })
        
        // 防止无限循环：如果匹配长度为0，手动推进位置
        if (match[0].length === 0) {
          regex.lastIndex = match.index + 1
        }
      }

      setSearchResults(matches)
      setCurrentSearchIndex(matches.length > 0 ? 0 : -1)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchTerm, transcript?.content])

  // 高亮显示搜索结果
  const highlightText = useMemo(() => {
    if (!transcript?.content || !searchTerm.trim()) {
      return transcript?.content || ''
    }

    const content = transcript.content
    const term = searchTerm.trim()
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    
    let matchCount = 0
    return content.split(regex).map((part, index) => {
      // 检查这个部分是否是匹配的搜索词
      const isMatch = new RegExp(`^${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(part)
      
      if (isMatch) {
        const isCurrentMatch = matchCount === currentSearchIndex
        matchCount++
        return (
          <mark
            key={index}
            className={`${
              isCurrentMatch 
                ? 'bg-yellow-300 text-yellow-900 ring-2 ring-yellow-400' 
                : 'bg-yellow-100 text-yellow-800'
            } px-1 rounded`}
            id={isCurrentMatch ? 'current-search-result' : undefined}
          >
            {part}
          </mark>
        )
      }
      return part
    })
  }, [transcript?.content, searchTerm, currentSearchIndex])

  // 搜索导航
  const navigateSearch = (direction) => {
    if (searchResults.length === 0) return

    let newIndex
    if (direction === 'next') {
      newIndex = currentSearchIndex < searchResults.length - 1 ? currentSearchIndex + 1 : 0
    } else {
      newIndex = currentSearchIndex > 0 ? currentSearchIndex - 1 : searchResults.length - 1
    }

    setCurrentSearchIndex(newIndex)
    
    // 滚动到当前搜索结果
    setTimeout(() => {
      const element = document.getElementById('current-search-result')
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 100)
  }

  // 编辑功能
  const startEditing = () => {
    setIsEditing(true)
    setEditContent(transcript.content || '')
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setEditContent(transcript.content || '')
  }

  const saveEdit = async () => {
    try {
      setSaving(true)
      await axios.patch(`/transcripts/${id}/`, {
        content: editContent
      })
      
      // 重新加载数据
      await loadTranscript()
      setIsEditing(false)
    } catch (err) {
      console.error('Failed to save transcript:', err)
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  // 下载功能
  const downloadTranscript = async () => {
    try {
      const response = await axios.get(`/transcripts/${id}/download/`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${transcript.filename}.txt`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      console.error('Failed to download transcript:', err)
      alert('下载失败，请重试')
    }
  }

  // 复制NAS路径
  const copyNasPath = async (path) => {
    try {
      await navigator.clipboard.writeText(path)
      setCopiedPath(path)
      setTimeout(() => setCopiedPath(''), 2000)
    } catch (err) {
      console.error('Failed to copy path:', err)
    }
  }

  // 格式化时长
  const formatDuration = (seconds) => {
    if (!seconds) return '未知'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !transcript) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-red-500 text-lg mb-4">{error || '转录不存在'}</div>
          <Link
            to="/results"
            className="inline-flex items-center px-4 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回转录列表
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* 头部导航 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Link
            to="/results"
            className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回列表
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{transcript.filename}</h1>
            <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
              <span className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                时长: {formatDuration(transcript.duration)}
              </span>
              <span>语言: {transcript.language || 'zh-CN'}</span>
              <span>版本: v{transcript.version}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={downloadTranscript}
            className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            下载
          </button>
          {!isEditing && (
            <button
              onClick={startEditing}
              className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Edit className="w-4 h-4 mr-2" />
              编辑
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 侧边栏 */}
        <div className="lg:col-span-1 space-y-6">
          {/* 搜索框 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">关键字搜索</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索转录内容..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {searchTerm.trim() && (
              <div className="mt-3 space-y-3">
                <div className="text-sm text-gray-600">
                  找到 {searchResults.length} 个结果
                  {searchResults.length > 0 && (
                    <span className="ml-2">
                      ({currentSearchIndex + 1}/{searchResults.length})
                    </span>
                  )}
                </div>
                
                {searchResults.length > 0 && (
                  <>
                    {/* 当前搜索结果的详细信息 */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="text-xs text-blue-600 font-medium mb-1">当前结果</div>
                      {searchResults[currentSearchIndex]?.timestamp && (
                        <div className="flex items-center text-sm text-gray-700 mb-1">
                          <Clock className="w-3 h-3 mr-1" />
                          时间: {searchResults[currentSearchIndex].timestamp}
                        </div>
                      )}
                      {searchResults[currentSearchIndex]?.nasConnection && (
                        <div className="flex items-center text-sm text-gray-700 mb-1">
                          <FolderOpen className="w-3 h-3 mr-1" />
                          NAS: {searchResults[currentSearchIndex].nasConnection}
                        </div>
                      )}
                      {searchResults[currentSearchIndex]?.nasPath && (
                        <div className="text-xs text-gray-600 font-mono bg-white p-1 rounded border">
                          {searchResults[currentSearchIndex].nasPath}
                        </div>
                      )}
                    </div>
                    
                    {/* 导航按钮 */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => navigateSearch('prev')}
                        className="flex items-center px-2 py-1 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                      >
                        <ChevronUp className="w-3 h-3 mr-1" />
                        上一个
                      </button>
                      <button
                        onClick={() => navigateSearch('next')}
                        className="flex items-center px-2 py-1 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                      >
                        <ChevronDown className="w-3 h-3 mr-1" />
                        下一个
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* NAS目录链接 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">NAS目录位置</h3>
            <div className="space-y-3">
              {nasDirectories.map((nas) => (
                <div key={nas.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{nas.name}</h4>
                    <span className="text-xs text-gray-500 uppercase">{nas.type}</span>
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-2 font-mono bg-gray-50 p-2 rounded">
                    {nas.path}
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => copyNasPath(nas.path)}
                      className="flex items-center px-2 py-1 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                    >
                      {copiedPath === nas.path ? (
                        <>
                          <Check className="w-3 h-3 mr-1" />
                          已复制
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 mr-1" />
                          复制路径
                        </>
                      )}
                    </button>
                    <a
                      href={nas.url}
                      className="flex items-center px-2 py-1 text-xs text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      打开
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 主内容区 */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">转录内容</h2>
                {isEditing && (
                  <div className="flex space-x-3">
                    <button
                      onClick={cancelEditing}
                      disabled={saving}
                      className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      <X className="w-4 h-4 mr-2" />
                      取消
                    </button>
                    <button
                      onClick={saveEdit}
                      disabled={saving || editContent.trim() === ''}
                      className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          保存中...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          保存
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-6">
              {isEditing ? (
                <textarea
                  className="w-full h-96 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono text-sm"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="编辑转录内容..."
                />
              ) : (
                <div className="prose max-w-none">
                  <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-gray-800">
                    {highlightText}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TranscriptDetail