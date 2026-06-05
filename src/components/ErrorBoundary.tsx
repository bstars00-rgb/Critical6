import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

// Catches render/query errors in a page so one failure shows a message instead
// of white-screening the whole app. The sidebar/nav stays usable.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: unknown) {
    console.error('[ErrorBoundary]', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card p-6">
          <h2 className="text-base font-semibold text-red-600">문제가 발생했습니다 / Something went wrong</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            이 화면을 불러오는 중 오류가 났습니다. 새로고침하거나 다른 메뉴로 이동해 보세요.
          </p>
          <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-slate-100 dark:bg-slate-900 p-3 text-[11px] text-slate-600 dark:text-slate-300">
            {String(this.state.error?.message ?? this.state.error)}
          </pre>
          <button className="btn-outline mt-3" onClick={() => this.setState({ error: null })}>
            다시 시도 / Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
