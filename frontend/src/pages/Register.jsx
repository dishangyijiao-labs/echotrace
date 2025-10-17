import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react'

function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { register } = useAuth()
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

    if (formData.password !== formData.confirmPassword) {
      setError('密码不匹配')
      setLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError('密码长度至少为6位')
      setLoading(false)
      return
    }

    const result = await register(formData.name, formData.email, formData.password, formData.confirmPassword)

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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h2>创建新账户</h2>
          <p>
            或者{' '}
            <Link to="/signin" className="auth-link">
              登录现有账户
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
              <label htmlFor="name" className="form-label">
                姓名
              </label>
              <div className="auth-input-wrapper">
                <User className="auth-input-icon" />
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  className="auth-input"
                  placeholder="请输入姓名"
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>
            </div>

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
                  autoComplete="new-password"
                  required
                  className="auth-input"
                  placeholder="请输入密码（至少6位）"
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

            <div className="auth-field">
              <label htmlFor="confirmPassword" className="form-label">
                确认密码
              </label>
              <div className="auth-input-wrapper">
                <Lock className="auth-input-icon" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className="auth-input"
                  placeholder="请再次输入密码"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="auth-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? '隐藏确认密码' : '显示确认密码'}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="auth-toggle-icon" />
                  ) : (
                    <Eye className="auth-toggle-icon" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <label className="auth-checkbox auth-terms" htmlFor="agree-terms">
            <input
              id="agree-terms"
              name="agree-terms"
              type="checkbox"
              required
            />
            <span>
              我同意{' '}
              <a href="#" className="auth-link">
                服务条款
              </a>
              {' '}和{' '}
              <a href="#" className="auth-link">
                隐私政策
              </a>
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="auth-submit"
          >
            {loading ? (
              <span className="auth-submit-loading">
                <span className="spinner" />
                注册中...
              </span>
            ) : (
              '创建账户'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Register
