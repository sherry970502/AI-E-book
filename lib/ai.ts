import Anthropic from '@anthropic-ai/sdk'
import { setGlobalDispatcher, ProxyAgent } from 'undici'

const MODEL = 'claude-sonnet-4-6'

function makeClient() {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy
  if (proxy) {
    setGlobalDispatcher(new ProxyAgent(proxy))
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

let _client: Anthropic | null = null
function getClient() {
  if (!_client) _client = makeClient()
  return _client
}

export async function callClaude(
  messages: Anthropic.MessageParam[],
  system: string,
  maxTokens = 4096
): Promise<string> {
  const res = await getClient().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages,
  })
  const block = res.content[0]
  return block.type === 'text' ? block.text : ''
}

export async function streamClaude(
  messages: Anthropic.MessageParam[],
  system: string,
  onChunk: (text: string) => void,
  maxTokens = 4096
): Promise<string> {
  const stream = await getClient().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages,
    stream: true,
  })
  let full = ''
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      full += event.delta.text
      onChunk(event.delta.text)
    }
  }
  return full
}

export function parseJSON<T>(text: string, fallback: T): T {
  const match = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/)
  const raw = match ? match[1] : text
  try {
    return JSON.parse(raw) as T
  } catch {
    try {
      const start = raw.indexOf('{') !== -1 ? raw.indexOf('{') : raw.indexOf('[')
      const end = raw.lastIndexOf('}') !== -1 ? raw.lastIndexOf('}') : raw.lastIndexOf(']')
      if (start !== -1 && end !== -1) return JSON.parse(raw.slice(start, end + 1)) as T
    } catch {}
    return fallback
  }
}
