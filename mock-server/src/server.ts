import { WebSocketServer, WebSocket } from "ws"

const PORT = 8082
const wss = new WebSocketServer({ port: PORT })

const clients = new Map<WebSocket, ClientState>()

interface ClientState {
  id: string
  sessionId?: string
  messageCount: number
  lastPing?: number
}

interface ServerOptions {
  delay?: number
  streamMode?: "sync" | "async"
  errorRate?: number
  disconnectAfter?: number
}

let serverOptions: ServerOptions = {
  delay: 100,
  streamMode: "async",
  errorRate: 0,
}

function generateRequestId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function send(ws: WebSocket, data: any): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data))
  }
}

async function handleMessage(ws: WebSocket, data: any): Promise<void> {
  const client = clients.get(ws)
  if (!client) return

  client.messageCount++

  await new Promise((resolve) => setTimeout(resolve, serverOptions.delay || 0))

  if ((serverOptions.errorRate ?? 0) > 0 && Math.random() < (serverOptions.errorRate ?? 0)) {
    send(ws, {
      requestId: data.requestId,
      status: "error",
      error: "Simulated server error",
    })
    return
  }

  switch (data.type) {
    case "ping":
      send(ws, { 
        requestId: data.requestId,
        type: "pong", 
        timestamp: Date.now() 
      })
      break

    case "chat":
      handleChat(ws, data)
      break

    case "stream":
      handleStreamChat(ws, data)
      break

    case "createSession":
      const sessionId = generateRequestId()
      client.sessionId = sessionId
      send(ws, {
        requestId: data.requestId,
        status: "success",
        data: { sessionId },
      })
      break

    case "switchSession":
      client.sessionId = data.payload?.sessionId
      send(ws, {
        requestId: data.requestId,
        status: "success",
        data: { sessionId: client.sessionId },
      })
      break

    case "closeSession":
      client.sessionId = undefined
      send(ws, {
        requestId: data.requestId,
        status: "success",
      })
      break

    default:
      send(ws, {
        requestId: data.requestId,
        status: "success",
        data: { echo: data },
      })
  }
}

function handleChat(ws: WebSocket, data: any): void {
  const response = {
    requestId: data.requestId,
    status: "success",
    data: {
      message: `Echo: ${data.payload?.content || "Hello"}`,
      timestamp: Date.now(),
    },
  }
  send(ws, response)
}

async function handleStreamChat(ws: WebSocket, data: any): Promise<void> {
  const content = data.payload?.content || "Hello"
  const chunks = content.split("")
  const requestId = data.requestId || generateRequestId()

  for (let i = 0; i < chunks.length; i++) {
    send(ws, {
      requestId,
      type: "stream",
      chunk: chunks[i],
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  send(ws, {
    requestId,
    type: "stream",
    chunk: "",
    done: true,
  })

  send(ws, {
    requestId,
    status: "success",
    data: { message: "Stream completed" },
  })
}

function handleConnection(ws: WebSocket): void {
  const clientId = generateRequestId()
  clients.set(ws, {
    id: clientId,
    messageCount: 0,
  })

  console.log(`[Server] Client connected: ${clientId}`)

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message.toString())
      console.log(`[Server] Received:`, data.type)
      await handleMessage(ws, data)
    } catch (error) {
      console.error("[Server] Error processing message:", error)
    }
  })

  ws.on("close", (code, reason) => {
    const client = clients.get(ws)
    console.log(`[Server] Client disconnected: ${client?.id}, code: ${code}, reason: ${reason.toString()}`)
    clients.delete(ws)
  })

  ws.on("error", (error) => {
    console.error("[Server] Client error:", error)
  })

  if (serverOptions.disconnectAfter && serverOptions.disconnectAfter > 0) {
    setTimeout(() => {
      console.log(`[Server] Force disconnecting client: ${clientId}`)
      ws.close(4000, "Server force disconnect")
    }, serverOptions.disconnectAfter)
  }
}

wss.on("connection", handleConnection)

wss.on("listening", () => {
  console.log(`[Server] WebSocket server started on ws://localhost:${PORT}`)
})

console.log(`
===========================================
  WebSocket Mock Server
  Port: ${PORT}
===========================================
  Commands:
    /delay <ms>     - Set response delay
    /stream <mode>  - Set stream mode (sync/async)
    /error <rate>   - Set error rate (0-1)
    /disconnect <ms>- Force disconnect after ms
    /stats          - Show server stats
    /reset          - Reset all options
    /close          - Close server
===========================================
`)

process.stdin.on("data", (data) => {
  const input = data.toString().trim()
  const [cmd, arg] = input.split(" ")

  switch (cmd) {
    case "/delay":
      serverOptions.delay = parseInt(arg) || 0
      console.log(`[Server] Response delay: ${serverOptions.delay}ms`)
      break
    case "/stream":
      serverOptions.streamMode = arg as "sync" | "async"
      console.log(`[Server] Stream mode: ${serverOptions.streamMode}`)
      break
    case "/error":
      serverOptions.errorRate = parseFloat(arg) || 0
      console.log(`[Server] Error rate: ${serverOptions.errorRate}`)
      break
    case "/disconnect":
      serverOptions.disconnectAfter = parseInt(arg) || 0
      console.log(`[Server] Disconnect after: ${serverOptions.disconnectAfter}ms`)
      break
    case "/stats":
      console.log(`[Server] Active clients: ${clients.size}`)
      clients.forEach((state, ws) => {
        console.log(`  - ${state.id}: ${state.messageCount} messages`)
      })
      console.log(`  Options:`, serverOptions)
      break
    case "/reset":
      serverOptions = { delay: 100, streamMode: "async", errorRate: 0 }
      console.log("[Server] Options reset")
      break
    case "/close":
      console.log("[Server] Shutting down...")
      wss.close()
      process.exit(0)
      break
    default:
      console.log("Unknown command")
  }
})