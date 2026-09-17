import type { ReactNode } from 'react'

export function PageShell({
  children,
  footer,
}: {
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col px-5 py-6">
      <div className="flex-1">{children}</div>
      {footer}
    </div>
  )
}

export function PrimaryButton({
  children,
  disabled,
  loading,
  onClick,
  type = 'button',
}: {
  children: ReactNode
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className="w-full rounded-xl bg-blue-600 px-5 py-3.5 text-base font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      {loading ? '…' : children}
    </button>
  )
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 text-base font-medium text-slate-700 transition active:scale-[0.99] disabled:opacity-50"
    >
      {children}
    </button>
  )
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  )
}
