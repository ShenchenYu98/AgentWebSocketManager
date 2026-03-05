import { SDKRequest, SDKResponse, StreamChunk } from "./types"

export function createRequest(
  type: string,
  payload?: any,
  sessionId?: string
): SDKRequest {
  return {
    type,
    sessionId,
    payload,
  }
}

export function parseMessage(data: string): SDKRequest | SDKResponse | StreamChunk | null {
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

export function isStreamMessage(msg: any): msg is StreamChunk {
  return msg && msg.type === "stream"
}

export function isResponse(msg: any): msg is SDKResponse {
  return msg && msg.requestId && (msg.status === "success" || msg.status === "error")
}

export function isRequest(msg: any): msg is SDKRequest {
  return msg && msg.type && !msg.status
}