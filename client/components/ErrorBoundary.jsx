"use client";

import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("Deck PA crashed:", error, info);
  }
  handleReset = () => this.setState({ hasError: false, error: null });
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed bottom-5 right-5 z-50 max-w-[320px] rounded-2xl border border-error bg-card p-4 shadow-xl">
          <p className="text-sm font-medium text-error">PA had a hiccup</p>
          <p className="mt-1 text-xs text-text-soft break-all">{String(this.state.error?.message || this.state.error || "Unknown")}</p>
          <button onClick={this.handleReset} className="mt-2 rounded-full bg-signal px-3 py-1 text-xs font-medium text-white">Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
