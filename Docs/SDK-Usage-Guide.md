## WebSocket Agent SDK 使用指南

本项目提供一个用于 **Agent 前端与服务端 WebSocket 会话管理** 的 SDK，封装了连接管理、请求/响应分发、会话管理、心跳保活、自动重连、中间件链及事件总线等能力。

本文档介绍如何在浏览器和 Node.js 环境中集成和使用该 SDK。

---

## 安装与引入

- **安装**

```bash
npm install webSocketManager
```

- **在 Node.js / 前端打包环境中使用**

```ts
import AgentSDK, {
  AgentSDK as AgentSDKClass,
  ConnectionManager,
  MessageDispatcher,
  SessionManager,
  HeartbeatManager,
  ReconnectManager,
  EventBus,
  MiddlewareChain,
  Middleware,
  MiddlewareContext,
  MiddlewareNext,
  SDKOptions,
  SDKRequest,
  SDKResponse,
  Session,
  ConnectionState,
  StreamChunk,
  createRequest,
  parseMessage,
  isStreamMessage,
  isResponse,
  isRequest,
  generateUUID,
  logger,
  createLogger,
} from "webSocketManager"
```

- **在浏览器中通过全局变量使用**

打包后，在浏览器环境中会自动将 `AgentSDK` 挂载到 `window.AgentSDK`：

```js
const sdk = new window.AgentSDK({
  url: "ws://localhost:8082",
})
```

---

## 核心概念与类型

- **SDKOptions**

```ts
interface SDKOptions {
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
```

- **SDKRequest / SDKResponse**

```ts
interface SDKRequest {
  requestId?: string
  type: string
  sessionId?: string
  payload?: any
}

interface SDKResponse {
  requestId: string
  status: "success" | "error"
  data?: any
  error?: string
}
```

- **Session**

```ts
interface Session {
  sessionId: string
  userId?: string
  status: "active" | "closed"
  metadata?: Record<string, any>
}
```

- **事件类型**

```ts
type SDKEvent =
  | "open"
  | "close"
  | "error"
  | "message"
  | "stream"
  | "sessionChanged"
  | "reconnecting"
  | "reconnected"
  | "tokenExpired"
```

---

## 快速开始

### 1. 创建 SDK 实例

```ts
import AgentSDK, { SDKOptions } from "webSocketManager"

const options: SDKOptions = {
  url: "ws://localhost:8082",
  token: "your-token",
  reconnect: true,
  reconnectInterval: 1000,
  maxReconnectAttempts: 5,
  heartbeatInterval: 20000,
  heartbeatTimeout: 10000,
  requestTimeout: 20000,
}

const sdk = new AgentSDK(options)
```

### 2. 建立连接与监听事件

```ts
// 连接
sdk.connect()

// 连接成功
sdk.on("open", () => {
  console.log("[SDK] connected")
})

// 连接关闭
sdk.on("close", () => {
  console.log("[SDK] closed")
})

// 错误
sdk.on("error", (err) => {
  console.error("[SDK] error", err)
})

// 普通消息（非请求响应/非流式）
sdk.on("message", (msg) => {
  console.log("[SDK] message", msg)
})

// 流式消息
sdk.on("stream", (chunk) => {
  console.log("[SDK] stream chunk", chunk)
})
```

---

## 发送请求与处理响应

`AgentSDK.send` 会：

- 自动生成 `requestId`
- 自动填充当前会话 `sessionId`
- 通过中间件链处理请求
- 通过 `MessageDispatcher` 等待对应的响应

```ts
import { SDKRequest, SDKResponse } from "webSocketManager"

async function sendChat(content: string) {
  const request: SDKRequest = {
    type: "chat",
    payload: {
      content,
    },
  }

  const res: SDKResponse = await sdk.send(request)

  if (res.status === "success") {
    console.log("chat result:", res.data)
  } else {
    console.error("chat error:", res.error)
  }
}
```

也可以使用工具函数 `createRequest`：

```ts
import { createRequest } from "webSocketManager"

const req = createRequest("chat", { content: "Hello" })
const res = await sdk.send(req)
```

---

## 会话管理（SessionManager）

`AgentSDK` 内部通过 `SessionManager` 管理会话，并在发送请求时自动附带当前 `sessionId`。

- **创建会话**

```ts
const session = sdk.createSession("user-123")
console.log("new session:", session.sessionId)
```

- **获取当前会话**

```ts
const current = sdk.getCurrentSession()
```

- **切换会话**

```ts
const ok = sdk.switchSession("target-session-id")
if (!ok) {
  console.warn("switch session failed")
}
```

- **获取所有会话**

```ts
const sessions = sdk.getAllSessions()
```

- **关闭会话**

```ts
// 关闭当前会话
sdk.closeSession()

// 或显式关闭指定会话
sdk.closeSession("session-id")
```

当会话切换时，会触发 `sessionChanged` 事件：

```ts
sdk.on("sessionChanged", (sessionId) => {
  console.log("session changed:", sessionId)
})
```

---

## 流式消息（Stream）

当服务端返回的消息满足 `StreamChunk` 结构（`type: "stream"`）时，SDK 会将其识别为流式消息，并通过 `stream` 事件分发：

```ts
sdk.on("stream", (chunk) => {
  // chunk: { requestId, type: "stream", chunk, done? }
  process.stdout.write(chunk.chunk)

  if (chunk.done) {
    console.log("\n[stream finished]")
  }
})
```

在发送流式请求时，通常约定 `type: "stream"`，由服务端按字符/分片返回：

```ts
await sdk.send({
  type: "stream",
  payload: { content: "Hello, streaming" },
})
```

---

## 中间件（MiddlewareChain）

SDK 提供类似 Koa 的中间件机制，可对请求进行统一处理，例如日志、鉴权、打点等。

- **中间件类型**

```ts
type Middleware = (
  context: MiddlewareContext,
  next: MiddlewareNext
) => Promise<void>

interface MiddlewareContext {
  request: SDKRequest
  timestamp: number
}
```

- **注册中间件**

```ts
// 简单日志中间件
sdk.use(async (ctx, next) => {
  console.log("[middleware] before send:", ctx.request.type, ctx.request)
  await next()
  console.log("[middleware] after send:", ctx.request.type)
})
```

中间件会在每次调用 `sdk.send` 时按注册顺序执行。

---

## 自动重连与心跳

SDK 内置：

- **HeartbeatManager**：定期发送 `ping` 请求，超时则关闭连接
- **ReconnectManager**：在非手动断开且开启 `reconnect` 时执行自动重连

相关事件：

- **`reconnecting`**：开始重连
- **`reconnected`**：重连成功
- **`tokenExpired`**：可用于上层处理鉴权过期（具体逻辑由业务约定）

示例：

```ts
sdk.on("reconnecting", () => {
  console.log("reconnecting ...")
})

sdk.on("reconnected", () => {
  console.log("reconnected")
})
```

---

## Token 更新

当鉴权 Token 失效或刷新时，可以动态更新：

```ts
sdk.updateToken("new-token")
```

SDK 会更新内部配置并通知底层连接管理器在后续连接/重连中使用新的 Token。

---

## 连接状态与销毁

- **检查连接状态**

```ts
const connected = sdk.isConnected()
const state = sdk.getState() // "INIT" | "CONNECTING" | "OPEN" | "CLOSED" | "RECONNECTING"
```

- **手动断开连接**

```ts
sdk.disconnect(1000, "manual close")
```

- **销毁 SDK 实例**

```ts
sdk.destroy()
```

销毁会：

- 停止心跳
- 清理未完成请求
- 移除所有事件监听器
- 关闭连接并清理会话

---

## 日志与工具函数

- **日志**

```ts
import { logger, createLogger } from "webSocketManager"

logger.info("something")

const customLogger = createLogger("MyModule")
customLogger.warn("warn message")
```

- **UUID 工具**

```ts
import { generateUUID } from "webSocketManager"

const id = generateUUID()
```

---

## 使用 Mock Server 进行本地调试

项目内置了一个基于 `ws` 的 **Mock WebSocket Server**，用于本地联调与压测。

- **启动 Mock Server**

```bash
cd mock-server
npm install
npm run dev
```

默认监听 `ws://localhost:8082`，可与 `SDKOptions.url` 保持一致。

- **控制台命令**

在 Mock Server 进程中可通过命令动态调整行为：

- **`/delay <ms>`**: 设置响应延迟
- **`/stream <mode>`**: 设置流模式（`sync` / `async`）
- **`/error <rate>`**: 设置错误率 \(0-1\)
- **`/disconnect <ms>`**: 在指定毫秒后强制断开客户端
- **`/stats`**: 查看当前连接状态与统计
- **`/reset`**: 重置所有配置
- **`/close`**: 关闭服务器

这有助于测试 SDK 在网络异常、抖动、错误率上升等情况下的行为。

---

## 最佳实践建议

- **统一封装业务 API**：基于 `sdk.send` 封装具体业务方法（如 `sendChat`、`createAgentSession` 等），避免在业务层直接操作底层请求结构。
- **使用中间件做横切逻辑**：例如埋点、日志、请求重写、鉴权检查等。
- **利用事件总线**：通过 `sdk.on` 监听连接/会话/流式事件，将 UI 状态更新与网络状态解耦。
- **在页面卸载前销毁 SDK**：如在 React 的 `useEffect` 清理函数或 `window.beforeunload` 中调用 `sdk.destroy()`，避免内存泄漏。

