import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import axios from 'axios'

// Components
import Layout from './components/Layout'
import SignIn from './pages/SignIn'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import TaskQueue from './pages/TaskQueue'
import Results from './pages/Results'
import Resources from './pages/Resources'
import Scheduler from './pages/Scheduler'
import Settings from './pages/Settings'
import Users from './pages/Users'
import Activity from './pages/Activity'

// Context
import { AuthProvider, useAuth } from './context/AuthContext'

// Styles
import './styles/globals.css'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8001/api'

// Configure axios defaults
axios.defaults.baseURL = API_BASE
axios.defaults.headers.common['Content-Type'] = 'application/json'

// Add request interceptor to include auth token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Add response interceptor to handle auth errors
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/signin'
    }
    return Promise.reject(error)
  }
)

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-emerald-500"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/signin" replace />
  }

  return children
}

function AdminRoute({ children }) {
  const { user, loading, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-emerald-500"></div>
      </div>
    )
  }

  if (!user || !isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/signin"
        element={user ? <Navigate to="/dashboard" replace /> : <SignIn />}
      />
      <Route
        path="/register"
        element={user ? <Navigate to="/dashboard" replace /> : <Register />}
      />

      {/* Protected routes */}
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="tasks" element={<TaskQueue />} />
        <Route path="results" element={<Results />} />
        <Route path="resources" element={<Resources />} />
        <Route path="scheduler" element={<Scheduler />} />
        <Route path="activity" element={<Activity />} />

        {/* Admin only routes */}
        <Route path="settings" element={<AdminRoute><Settings /></AdminRoute>} />
        <Route path="users" element={<AdminRoute><Users /></AdminRoute>} />
      </Route>

      {/* Catch all route */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="App">
          <AppRoutes />
        </div>
      </AuthProvider>
    </Router>
  )
}

export default App
