import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { login } from '../lib/api'

export function Login({ onAuthed }: { onAuthed: () => void }) {
  const navigate = useNavigate()
  const [passcode, setPasscode] = useState('')

  const mutation = useMutation({
    mutationFn: () => login(passcode),
    onSuccess: () => {
      onAuthed()
      navigate('/')
    },
  })

  return (
    <div className="flex min-h-full items-center justify-center px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          mutation.mutate()
        }}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
          Doctor Panel
        </p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">
          Spine Assessment Review
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter the clinic passcode to continue.
        </p>

        <label className="mt-6 block text-sm font-medium text-slate-700">
          Passcode
          <input
            type="password"
            autoFocus
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </label>

        {mutation.isError && (
          <p className="mt-3 text-sm text-red-600">
            Incorrect passcode. Please try again.
          </p>
        )}

        <button
          type="submit"
          disabled={mutation.isPending || !passcode}
          className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition disabled:bg-slate-300"
        >
          {mutation.isPending ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="mt-6 text-xs text-slate-400">
          Draft triage logic — pending clinical review.
        </p>
      </form>
    </div>
  )
}
