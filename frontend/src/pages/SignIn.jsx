import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'

function SignIn() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })

    if (error) setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn(formData.email, formData.password)

    if (result.success) {
      navigate('/dashboard')
    } else {
      setError(result.error)
    }

    setLoading(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <header className="auth-header">
          <div className="auth-logo">
            <svg className="auth-logo-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2>登录您的账户</h2>
          <p>
            或者{' '}
            <Link to="/register" className="auth-link">
              创建新账户
            </Link>
          </p>
        </header>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <div className="auth-fields">
            <div className="auth-field">
              <label htmlFor="email" className="form-label">
                邮箱地址
              </label>
              <div className="auth-input-wrapper">
                <Mail className="auth-input-icon" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="auth-input"
                  placeholder="请输入邮箱地址"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="password" className="form-label">
                密码
              </label>
              <div className="auth-input-wrapper">
                <Lock className="auth-input-icon" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="auth-input"
                  placeholder="请输入密码"
                  value={formData.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="auth-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                >
                  {showPassword ? (
                    <EyeOff className="auth-toggle-icon" />
                  ) : (
                    <Eye className="auth-toggle-icon" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="auth-meta">
            <label className="auth-checkbox" htmlFor="remember-me">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
              />
              <span>记住我</span>
            </label>

            <a href="#" className="auth-link">
              忘记密码？
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="auth-submit"
          >
            {loading ? (
              <span className="auth-submit-loading">
                <span className="spinner" />
                登录中...
              </span>
            ) : (
              '登录'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

export default SignIn
