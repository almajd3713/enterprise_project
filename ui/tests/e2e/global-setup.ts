import type { FullConfig } from '@playwright/test'

export default async function globalSetup(_config: FullConfig) {
  const enabled = process.env.E2E_FAIL_FAST_PRECHECK ?? 'true'
  if (enabled.toLowerCase() === 'false') return

  const gateway = process.env.PLAYWRIGHT_GATEWAY_BASE ?? 'http://localhost:8080'
  const health = `${gateway}/actuator/health`

  let res: Response
  try {
    res = await fetch(health)
  } catch (err) {
    throw new Error(`E2E precheck failed: cannot reach gateway at ${health}. ${String(err)}`)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`E2E precheck failed: ${health} returned ${res.status}. ${body}`)
  }
}
