import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * The last line of defence.
 *
 * A throw during render unmounts the whole tree, which reads to the player as
 * the page going blank with no way back but a reload. Whatever else is wrong,
 * they should at least be told, and the draft is still in local storage.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("El builder se rompio al renderizar", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="result-box" role="alert">
        <strong>El builder se rompio</strong>
        <p>Tu borrador quedo guardado. Recarga la pagina para seguir.</p>
        <p>{this.state.error.message}</p>
        <button className="btn btn-next" onClick={() => window.location.reload()} type="button">
          RECARGAR
        </button>
      </div>
    );
  }
}
