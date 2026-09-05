import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Crash guard.
 *
 * React unmounts the entire tree on an uncaught render error, which leaves a
 * blank white page — the single worst thing that can happen mid-demo, because it
 * looks like nothing was ever built. This turns that into a readable panel with
 * a recovery path, and prints the real error to the console for us.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Clinch UI crash:', error, info.componentStack)
  }

  componentDidMount() {
    // Clear the error when the route changes.
    //
    // Without this, one broken screen latches the boundary for the whole
    // session: every subsequent page renders the error panel even though it is
    // perfectly healthy. During testing that made a single bad component look
    // like fourteen broken ones, and on stage it would turn one stumble into a
    // dead app.
    window.addEventListener('popstate', this.clear)
    window.addEventListener('clinch:navigate', this.clear)
  }

  componentWillUnmount() {
    window.removeEventListener('popstate', this.clear)
    window.removeEventListener('clinch:navigate', this.clear)
  }

  clear = () => {
    if (this.state.error) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-[100dvh] bg-bg grid place-items-center px-6">
        <div className="max-w-[46ch] rounded-2xl bg-surface ring-1 ring-black/[.06] shadow-lift p-7
                        flex flex-col gap-3.5">
          <img src="/CLINCH_LOGO_TRANSPARENT.png" alt="Clinch" className="h-6 w-auto self-start" />
          <h1 className="font-display text-[19px] font-bold text-fg">This screen hit an error</h1>
          <p className="text-[13.5px] leading-relaxed text-fg-2">
            The rest of the workspace is unaffected. Reloading usually clears it; if not,
            resetting the demo data restores a known-good state.
          </p>
          <code className="rounded-lg bg-surface-2 px-3 py-2 font-mono text-[11.5px] text-fg-2 break-words">
            {this.state.error.message}
          </code>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => window.location.reload()}
              className="rounded-full bg-fg text-white px-4 py-2 font-display text-[12.5px] font-semibold"
            >
              Reload
            </button>
            <button
              onClick={() => { this.setState({ error: null }); window.location.assign('/app/quotations') }}
              className="rounded-full ring-1 ring-black/[.08] bg-surface px-4 py-2
                         font-display text-[12.5px] font-semibold text-fg"
            >
              Back to quotations
            </button>
          </div>
        </div>
      </div>
    )
  }
}
