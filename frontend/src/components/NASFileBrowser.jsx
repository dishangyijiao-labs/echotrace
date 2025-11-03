import React, { useState, useEffect } from 'react'
import axios from 'axios'
import {
  Folder,
  File,
  Download,
  Upload,
  RefreshCw,
  ArrowLeft,
  Home,
  Search,
  Filter,
  Grid,
  List,
  MoreVertical,
  Eye,
  Trash2,
  Copy,
  Move,
  FolderPlus,
  FileText,
  Image,
  Music,
  Video,
  Archive,
  Code
} from 'lucide-react'

const getFileIcon = (fileName, isDirectory) => {
  if (isDirectory) return Folder
  
  const ext = fileName.split('.').pop()?.toLowerCase()
  
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) return Image
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext)) return Music
  if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) return Video
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return Archive
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'html', 'css'].includes(ext)) return Code
  if (['txt', 'md', 'doc', 'docx', 'pdf'].includes(ext)) return FileText
  
  return File
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('zh-CN')
}

function NASFileBrowser({ connectionId, onClose }) {
  const [currentPath, setCurrentPath] = useState('/')
  const [pathHistory, setPathHistory] = useState(['/'])
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState('list') // 'list' or 'grid'
  const [selectedFiles, setSelectedFiles] = useState(new Set())
  const [sortBy, setSortBy] = useState('name') // 'name', 'size', 'modified'
  const [sortOrder, setSortOrder] = useState('asc') // 'asc' or 'desc'
  const [showHidden, setShowHidden] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})

  useEffect(() => {
    const loadFiles = async (path) => {
      setLoading(true)
      setError('')
      try {
        const response = await axios.get(`/nas/connections/${connectionId}/files/`, {
          params: { path }
        })
        setFiles(response.data.files || [])
      } catch (err) {
        setError('加载文件失败: ' + (err.response?.data?.error || err.message))
      } finally {
        setLoading(false)
      }
    }

    if (connectionId) {
      loadFiles(currentPath)
    }
  }, [connectionId, currentPath])

  const refreshFiles = () => {
    if (connectionId) {
      const loadFiles = async (path) => {
        setLoading(true)
        setError('')
        try {
          const response = await axios.get(`/nas/connections/${connectionId}/files/`, {
            params: { path }
          })
          setFiles(response.data.files || [])
        } catch (err) {
          setError('加载文件失败: ' + (err.response?.data?.error || err.message))
        } finally {
          setLoading(false)
        }
      }
      loadFiles(currentPath)
    }
  }

  const navigateToPath = (path) => {
    setCurrentPath(path)
    setPathHistory(prev => [...prev, path])
    setSelectedFiles(new Set())
    refreshFiles()
  }

  const navigateBack = () => {
    if (pathHistory.length > 1) {
      const newHistory = pathHistory.slice(0, -1)
      setPathHistory(newHistory)
      setCurrentPath(newHistory[newHistory.length - 1])
      setSelectedFiles(new Set())
    }
  }

  const navigateToRoot = () => {
    setCurrentPath('/')
    setPathHistory(['/'])
    setSelectedFiles(new Set())
  }

  const handleFileDoubleClick = (file) => {
    if (file.is_directory) {
      const newPath = currentPath === '/' ? `/${file.name}` : `/${currentPath}/${file.name}`
      navigateToPath(newPath)
    } else {
      // 预览文件或下载
      handlePreviewFile(file)
    }
  }

  const handleFileSelect = (fileName) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev)
      if (newSet.has(fileName)) {
        newSet.delete(fileName)
      } else {
        newSet.add(fileName)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectedFiles.size === filteredFiles.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(filteredFiles.map(f => f.name)))
    }
  }

  const handleDownloadFile = async (file) => {
    try {
      const filePath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`
      const response = await axios.get(`/nas/connections/${connectionId}/download/`, {
        params: { path: filePath },
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', file.name)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.response?.data?.error || '下载文件失败')
    }
  }

  const handlePreviewFile = async (file) => {
    // 简单的文件预览功能
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) {
      // 图片预览
      try {
        const filePath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`
        const response = await axios.get(`/nas/connections/${connectionId}/preview/`, {
          params: { path: filePath },
          responseType: 'blob'
        })
        
        const url = window.URL.createObjectURL(new Blob([response.data]))
        window.open(url, '_blank')
      } catch {
        setError('预览失败')
      }
    } else {
      // 其他文件类型直接下载
      handleDownloadFile(file)
    }
  }

  const handleUploadFiles = async (fileList) => {
    const files = Array.from(fileList)
    
    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('path', currentPath)
      
      try {
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }))
        
        await axios.post(`/nas/connections/${connectionId}/upload/`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            setUploadProgress(prev => ({ ...prev, [file.name]: progress }))
          }
        })
        
        setUploadProgress(prev => {
          const newProgress = { ...prev }
          delete newProgress[file.name]
          return newProgress
        })
      } catch (err) {
        setError(`上传 ${file.name} 失败: ${err.response?.data?.error || err.message}`)
        setUploadProgress(prev => {
          const newProgress = { ...prev }
          delete newProgress[file.name]
          return newProgress
        })
      }
    }
    
    // 重新加载文件列表
    refreshFiles()
  }

  const handleCreateFolder = async () => {
    const folderName = prompt('请输入文件夹名称:')
    if (!folderName) return
    
    try {
      const folderPath = currentPath === '/' ? `/${folderName}` : `${currentPath}/${folderName}`
      await axios.post(`/nas/connections/${connectionId}/mkdir/`, {
        path: folderPath
      })
      refreshFiles()
    } catch (err) {
      setError(err.response?.data?.error || '创建文件夹失败')
    }
  }

  const handleDeleteFiles = async () => {
    if (selectedFiles.size === 0) return
    
    if (!confirm(`确定要删除选中的 ${selectedFiles.size} 个文件/文件夹吗？`)) return
    
    try {
      const filePaths = Array.from(selectedFiles).map(fileName => 
        currentPath === '/' ? `/${fileName}` : `${currentPath}/${fileName}`
      )
      
      await axios.delete(`/nas/connections/${connectionId}/delete/`, {
        data: { paths: filePaths }
      })
      
      setSelectedFiles(new Set())
      refreshFiles()
    } catch (err) {
      setError(err.response?.data?.error || '删除文件失败')
    }
  }

  const filteredFiles = files.filter(file => {
    if (!showHidden && file.name.startsWith('.')) return false
    if (searchTerm && !file.name.toLowerCase().includes(searchTerm.toLowerCase())) return false
    return true
  }).sort((a, b) => {
    let aValue, bValue
    
    switch (sortBy) {
      case 'size':
        aValue = a.size || 0
        bValue = b.size || 0
        break
      case 'modified':
        aValue = new Date(a.modified_time || 0)
        bValue = new Date(b.modified_time || 0)
        break
      default:
        aValue = a.name.toLowerCase()
        bValue = b.name.toLowerCase()
    }
    
    if (a.is_directory && !b.is_directory) return -1
    if (!a.is_directory && b.is_directory) return 1
    
    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
    return 0
  })

  const breadcrumbs = currentPath.split('/').filter(Boolean)

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 工具栏 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <button
            onClick={navigateBack}
            disabled={pathHistory.length <= 1}
            className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            onClick={navigateToRoot}
            className="p-2 rounded-md hover:bg-gray-100"
          >
            <Home className="h-4 w-4" />
          </button>
          <button
            onClick={refreshFiles}
            disabled={loading}
            className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索文件..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <button
            onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
            className="p-2 rounded-md hover:bg-gray-100"
          >
            {viewMode === 'list' ? <Grid className="h-4 w-4" /> : <List className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="file"
            multiple
            onChange={(e) => handleUploadFiles(e.target.files)}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer flex items-center space-x-1"
          >
            <Upload className="h-4 w-4" />
            <span>上传</span>
          </label>
          
          <button
            onClick={handleCreateFolder}
            className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center space-x-1"
          >
            <FolderPlus className="h-4 w-4" />
            <span>新建文件夹</span>
          </button>
          
          {selectedFiles.size > 0 && (
            <button
              onClick={handleDeleteFiles}
              className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center space-x-1"
            >
              <Trash2 className="h-4 w-4" />
              <span>删除</span>
            </button>
          )}
          
          <button
            onClick={onClose}
            className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            关闭
          </button>
        </div>
      </div>

      {/* 面包屑导航 */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center space-x-1 text-sm text-gray-600">
          <span
            onClick={navigateToRoot}
            className="cursor-pointer hover:text-blue-600"
          >
            根目录
          </span>
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              <span>/</span>
              <span
                onClick={() => {
                  const path = '/' + breadcrumbs.slice(0, index + 1).join('/')
                  navigateToPath(path)
                }}
                className="cursor-pointer hover:text-blue-600"
              >
                {crumb}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* 文件列表控制 */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={selectedFiles.size === filteredFiles.length && filteredFiles.length > 0}
              onChange={handleSelectAll}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">全选</span>
          </label>
          
          {selectedFiles.size > 0 && (
            <span className="text-sm text-gray-600">
              已选择 {selectedFiles.size} 项
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">显示隐藏文件</span>
          </label>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value="name">按名称排序</option>
            <option value="size">按大小排序</option>
            <option value="modified">按修改时间排序</option>
          </select>
          
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="text-sm px-2 py-1 border border-gray-300 rounded hover:bg-gray-100"
          >
            {sortOrder === 'asc' ? '升序' : '降序'}
          </button>
        </div>
      </div>

      {/* 上传进度 */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200">
          {Object.entries(uploadProgress).map(([fileName, progress]) => (
            <div key={fileName} className="flex items-center space-x-2 mb-1">
              <span className="text-sm text-blue-700">{fileName}</span>
              <div className="flex-1 bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-sm text-blue-700">{progress}%</span>
            </div>
          ))}
        </div>
      )}

      {/* 错误信息 */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 文件列表 */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600">加载中...</span>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-gray-500">此文件夹为空</p>
          </div>
        ) : viewMode === 'list' ? (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  名称
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  大小
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  修改时间
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredFiles.map((file) => {
                const Icon = getFileIcon(file.name, file.is_directory)
                const isSelected = selectedFiles.has(file.name)
                
                return (
                  <tr
                    key={file.name}
                    className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                    onDoubleClick={() => handleFileDoubleClick(file)}
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleFileSelect(file.name)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <Icon className={`h-5 w-5 ${file.is_directory ? 'text-blue-500' : 'text-gray-400'}`} />
                        <span className="text-sm font-medium text-gray-900">{file.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {file.is_directory ? '-' : formatFileSize(file.size || 0)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {formatDate(file.modified_time)}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center space-x-2">
                        {!file.is_directory && (
                          <>
                            <button
                              onClick={() => handlePreviewFile(file)}
                              className="p-1 rounded hover:bg-gray-100"
                              title="预览"
                            >
                              <Eye className="h-4 w-4 text-gray-400" />
                            </button>
                            <button
                              onClick={() => handleDownloadFile(file)}
                              className="p-1 rounded hover:bg-gray-100"
                              title="下载"
                            >
                              <Download className="h-4 w-4 text-gray-400" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4">
            {filteredFiles.map((file) => {
              const Icon = getFileIcon(file.name, file.is_directory)
              const isSelected = selectedFiles.has(file.name)
              
              return (
                <div
                  key={file.name}
                  className={`p-3 border border-gray-200 rounded-lg hover:shadow-md cursor-pointer ${
                    isSelected ? 'bg-blue-50 border-blue-300' : 'bg-white'
                  }`}
                  onDoubleClick={() => handleFileDoubleClick(file)}
                  onClick={() => handleFileSelect(file.name)}
                >
                  <div className="flex flex-col items-center space-y-2">
                    <Icon className={`h-8 w-8 ${file.is_directory ? 'text-blue-500' : 'text-gray-400'}`} />
                    <span className="text-xs text-center text-gray-900 truncate w-full" title={file.name}>
                      {file.name}
                    </span>
                    {!file.is_directory && (
                      <span className="text-xs text-gray-500">
                        {formatFileSize(file.size || 0)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default NASFileBrowser