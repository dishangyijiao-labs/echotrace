/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

const AuthContext = createContext({})

const parseStoredUser = (rawUser) => {
  if (!rawUser) return null
  try {
    return JSON.parse(rawUser)
  } catch {
    return null
  }
}

const extractAuthPayload = (response) => {
  const payload = response?.data ?? {}
  const data = payload.data ?? payload

  return {
    user: data?.user ?? null,
    access: data?.access ?? data?.token ?? data?.access_token ?? null,
    refresh: data?.refresh ?? data?.refresh_token ?? null
  }
}

const resolveErrorMessage = (error, fallbackMessage) => {
  const apiError = error?.response?.data?.error
  if (!apiError) {
    return fallbackMessage
  }

  if (typeof apiError.message === 'string' && apiError.message.trim().length > 0) {
    return apiError.message
  }

  const { details } = apiError
  if (!details) {
    return fallbackMessage
  }

  if (typeof details === 'string') {
    return details
  }

  if (Array.isArray(details)) {
    return details[0] || fallbackMessage
  }

  if (typeof details === 'object') {
    const [firstKey] = Object.keys(details)
    if (firstKey) {
      const value = details[firstKey]
      if (Array.isArray(value)) {
        return value[0] || fallbackMessage
      }
      if (typeof value === 'string') {
        return value
      }
    }
  }

  return fallbackMessage
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const persistAuthSession = ({ access, refresh, user: userData }) => {
    if (!access || !userData) {
      throw new Error('Invalid authentication response')
    }

    localStorage.setItem('token', access)
    localStorage.setItem('user', JSON.stringify(userData))

    if (refresh) {
      localStorage.setItem('refreshToken', refresh)
    } else {
      localStorage.removeItem('refreshToken')
    }

    setUser(userData)
  }

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token')
      const storedUser = parseStoredUser(localStorage.getItem('user'))

      if (storedUser) {
        setUser(storedUser)
      }

      if (!storedToken) {
        localStorage.removeItem('user')
        setLoading(false)
        return
      }

      try {
        const response = await axios.get('/auth/me/')
        const userData = response?.data?.data ?? response?.data?.user ?? null

        if (userData) {
          setUser(userData)
          localStorage.setItem('user', JSON.stringify(userData))
        }
      } catch {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        localStorage.removeItem('refreshToken')
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    initAuth()
  }, [])

  const signIn = async (email, password) => {
    try {
      const response = await axios.post('/auth/signin/', {
        email,
        password
      })

      const authData = extractAuthPayload(response)
      persistAuthSession(authData)

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: resolveErrorMessage(error, '登录失败')
      }
    }
  }

  const register = async (name, email, password, passwordConfirm) => {
    try {
      // 生成唯一用户名：使用邮箱前缀 + 时间戳
      const emailPrefix = email.split('@')[0]
      const timestamp = Date.now().toString().slice(-6) // 取最后6位时间戳
      const username = `${emailPrefix}_${timestamp}`
      
      const response = await axios.post('/auth/register/', {
        username: username,
        first_name: name,
        email,
        password,
        password_confirm: passwordConfirm ?? password,
        role: 'viewer'
      })

      const authData = extractAuthPayload(response)
      persistAuthSession(authData)

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: resolveErrorMessage(error, '注册失败')
      }
    }
  }

  const signOut = () => {
    try {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('refreshToken')
      setUser(null)
    } catch (error) {
      console.error('Error in signOut:', error)
    }
  }

  const updateUser = (userData) => {
    setUser(userData)
    localStorage.setItem('user', JSON.stringify(userData))
  }

  const value = {
    user,
    loading,
    signIn,
    register,
    signOut,
    updateUser,
    isAdmin: user?.is_admin === true,
    isAuthenticated: !!user
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
