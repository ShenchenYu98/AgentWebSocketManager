export interface SDKOptions {
  url: string
  token?: string
  reconnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
  heartbeatInterval?: number
  heartbeatTimeout?: number
  requestTimeout?: number
  protocols?: string | string[]
}

export interface SDKRequest {
  requestId?: string
  type: string
  sessionId?: string
  payload?: any
}

export interface SDKResponse {
  requestId: string
  status: "success" | "error"
  data?: any
  error?: string
}

export interface StreamChunk {
  requestId: string
  type: "stream"
  chunk: string
  done?: boolean
}

export interface Session {
  sessionId: string
  userId?: string
  status: "active" | "closed"
  metadata?: Record<string, any>
}

export type ConnectionState = "INIT" | "CONNECTING" | "OPEN" | "CLOSED" | "RECONNECTING"

export interface WSOptions {
  url: string
  token?: string
  protocols?: string | string[]
}

export interface PendingRequest {
  resolve: (value: SDKResponse) => void
  reject: (reason?: any) => void
  timeoutId: ReturnType<typeof setTimeout>
}

export type SDKEvent =
  | "open"
  | "close"
  | "error"
  | "message"
  | "stream"
  | "sessionChanged"
  | "reconnecting"
  | "reconnected"
  | "tokenExpired"

export type EventHandler = (data?: any) => void