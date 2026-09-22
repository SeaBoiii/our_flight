import { Component, type ReactNode } from 'react';

type ExperienceBoundaryProps = { children: ReactNode; fallback: ReactNode };

export class ExperienceBoundary extends Component<ExperienceBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
