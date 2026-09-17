import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { logout } from '../lib/api'

export function AppHeader({ onLoggedOut }: { onLoggedOut: () => void }) {
  const navigate = useNavigate()
  const mutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      onLoggedOut()
      navigate('/login')
    },
  })

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="text-left"
      >
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
          Doctor Panel
        </p>
        <h1 className="text-base font-semibold text-slate-900">
          Spine Assessment Review
        </h1>
      </button>
      <button
        type="button"
        onClick={() => mutation.mutate()}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
      >
        Sign out
      </button>
    </header>
  )
}
