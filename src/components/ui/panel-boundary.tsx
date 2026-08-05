"use client";

// PanelBoundary — a small React error boundary for EMBEDDED widgets.
//
// Drop it around any self-contained client panel (HIRA suggestions, the CAPA
// assistant, agent cards, charts) that fetches its own data or renders data of
// an uncertain shape. If that panel throws during render, the boundary catches
// it and shows a compact "this section couldn't load" card INSTEAD of letting
// the error propagate up and white-screen the whole page.
//
// This is defence-in-depth: the underlying data bugs should still be fixed at
// the source, but one fragile widget should never take down an entire page.

import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

type Props = {
  children: ReactNode;
  /** Short label for what failed, e.g. "HIRA suggestions". */
  label?: string;
  /** Custom fallback. When omitted, a default compact card is shown. */
  fallback?: ReactNode;
};

type State = { hasError: boolean; message?: string };

export class PanelBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown) {
    // Surface in the console for debugging without crashing the page.
    // eslint-disable-next-line no-console
    console.error(`[PanelBoundary${this.props.label ? ` · ${this.props.label}` : ""}]`, error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
        <div>
          <div className="font-medium">
            {this.props.label ? `${this.props.label} couldn’t load` : "This section couldn’t load"}
          </div>
          <div className="text-xs text-amber-800 mt-0.5">
            The rest of the page is unaffected. Try refreshing — if it keeps happening, report it.
          </div>
        </div>
      </div>
    );
  }
}
