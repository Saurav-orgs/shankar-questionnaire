import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { checkSession } from './lib/api'
import { Dashboard } from './routes/Dashboard'
import { Login } from './routes/Login'
import { PatientDetail } from './routes/PatientDetail'

type AuthState = 'checking' | 'authed' | 'anon'

export default function App() {
  const [auth, setAuth] = useState<AuthState>('checking')

  useEffect(() => {
    let active = true
    void checkSession().then((ok) => {
      if (active) setAuth(ok ? 'authed' : 'anon')
    })
    return () => {
      active = false
    }
  }, [])

  if (auth === 'checking') {
    return (
      <div className="flex min-h-full items-center justify-center text-slate-400">
        Loading…
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          auth === 'authed' ? (
            <Navigate to="/" replace />
          ) : (
            <Login onAuthed={() => setAuth('authed')} />
          )
        }
      />
      <Route
        path="/"
        element={
          <Guard authed={auth === 'authed'}>
            <Dashboard onLoggedOut={() => setAuth('anon')} />
          </Guard>
        }
      />
      <Route
        path="/patients/:id"
        element={
          <Guard authed={auth === 'authed'}>
            <PatientDetail onLoggedOut={() => setAuth('anon')} />
          </Guard>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function Guard({ authed, children }: { authed: boolean; children: React.ReactNode }) {
  const navigate = useNavigate()
  useEffect(() => {
    if (!authed) navigate('/login', { replace: true })
  }, [authed, navigate])
  if (!authed) return null
  return <>{children}</>
}
