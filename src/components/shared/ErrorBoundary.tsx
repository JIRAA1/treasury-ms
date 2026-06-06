'use client'

import React from 'react'
import ApiErrorState from './ApiErrorState'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <ApiErrorState
          title="เกิดข้อผิดพลาด"
          message={this.state.error?.message ?? 'ระบบพบปัญหาที่ไม่คาดคิด กรุณารีเฟรชหน้า'}
          onRetry={() => this.setState({ hasError: false, error: undefined })}
        />
      )
    }
    return this.props.children
  }
}
