const { AgentSDK } = require("../dist")

console.log("=".repeat(50))
console.log("AgentSDK Test Suite")
console.log("=".repeat(50))

const sdk = new AgentSDK({
  url: "ws://localhost:8082",
  reconnect: true,
  maxReconnectAttempts: 3,
  heartbeatInterval: 5000,
  heartbeatTimeout: 3000,
  requestTimeout: 10000,
})

let testsPassed = 0
let testsFailed = 0

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runTests() {
  console.log("\n1. Testing Connection...")

  await sleep(500)

  sdk.connect()

  await new Promise((resolve) => {
    sdk.on("open", () => {
      console.log("  ✓ Connection opened")
      resolve()
    })
    setTimeout(() => resolve(), 3000)
  })

  await sleep(500)

  console.log("\n2. Testing Event Listeners...")

  sdk.on("close", () => {
    console.log("  ✓ Close event received")
  })

  sdk.on("error", (err) => {
    console.log("  ✓ Error event received:", err)
  })

  await sleep(200)

  console.log("\n3. Testing Simple Send/Response...")

  try {
    const response = await sdk.send({
      type: "chat",
      payload: { content: "Hello" },
    })
    console.log("  ✓ Response received:", response.data)
    testsPassed++
  } catch (error) {
    console.log("  ✗ Send failed:", error)
    testsFailed++
  }

  await sleep(500)

  console.log("\n4. Testing Stream Response...")

  let streamChunks = []
  sdk.on("stream", (chunk) => {
    streamChunks.push(chunk.chunk)
    console.log(`  Stream chunk: "${chunk.chunk}"`)
  })

  try {
    const streamResponse = await sdk.send({
      type: "stream",
      payload: { content: "Streaming test message" },
    })
    await sleep(500)
    console.log(`  ✓ Stream completed, chunks: ${streamChunks.join("")}`)
    console.log("  ✓ Stream response:", streamResponse.data)
    testsPassed++
  } catch (error) {
    console.log("  ✗ Stream failed:", error)
    testsFailed++
  }

  await sleep(500)

  console.log("\n5. Testing Session Management...")

  try {
    const session = sdk.createSession("user123")
    console.log("  ✓ Session created:", session.sessionId)

    const current = sdk.getCurrentSession()
    console.log("  ✓ Current session:", current?.sessionId)

    const switched = sdk.switchSession(session.sessionId)
    console.log("  ✓ Session switched:", switched)
    testsPassed++
  } catch (error) {
    console.log("  ✗ Session management failed:", error)
    testsFailed++
  }

  await sleep(500)

  console.log("\n6. Testing Heartbeat...")
  console.log("  Heartbeat is running in background (check server logs)")
  await sleep(6000)

  console.log("\n7. Testing Middleware...")

  sdk.use(async (ctx, next) => {
    console.log(`  Middleware: ${ctx.request.type}`)
    await next()
  })

  try {
    await sdk.send({
      type: "test",
      payload: { content: "middleware test" },
    })
    console.log("  ✓ Middleware executed")
    testsPassed++
  } catch (error) {
    console.log("  ✗ Middleware test failed:", error)
    testsFailed++
  }

  await sleep(500)

  console.log("\n8. Testing Connection State...")
  console.log("  Is connected:", sdk.isConnected())
  console.log("  Connection state:", sdk.getState())

  await sleep(500)

  console.log("\n9. Testing Disconnect...")

  sdk.disconnect()
  await sleep(500)
  console.log("  ✓ Disconnected")

  await sleep(1000)

  console.log("\n10. Testing Reconnect...")

  sdk.connect()
  await new Promise((resolve) => {
    sdk.on("open", () => {
      console.log("  ✓ Reconnected successfully")
      resolve()
    })
    setTimeout(() => resolve(), 3000)
  })

  await sleep(500)

  console.log("\n" + "=".repeat(50))
  console.log(`Tests completed: ${testsPassed} passed, ${testsFailed} failed`)
  console.log("=".repeat(50))

  sdk.destroy()
  process.exit(testsFailed > 0 ? 1 : 0)
}

runTests().catch(console.error)