export function normalizeApiBaseUrl(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) {
    return '/api'
  }
  return trimmed.replace(/\/$/, '')
}

export function validateUserInput({ name, email }) {
  const issues = []
  if (!String(name || '').trim()) {
    issues.push('User name is required.')
  }

  const emailValue = String(email || '').trim()
  if (!emailValue) {
    issues.push('User email is required.')
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
    issues.push('User email format is invalid.')
  }

  return issues
}

export function validateSettingsDraft(settingsDraft) {
  const issues = []
  if (!String(settingsDraft.brandName || '').trim()) {
    issues.push('Brand name is required.')
  }
  if (!String(settingsDraft.timezone || '').trim()) {
    issues.push('Timezone is required.')
  }
  if (Number(settingsDraft.retentionDays) <= 0) {
    issues.push('Retention days must be greater than 0.')
  }
  if (Number(settingsDraft.thresholdP95) <= 0) {
    issues.push('p95 threshold must be greater than 0.')
  }
  if (Number(settingsDraft.thresholdErrorRate) < 0) {
    issues.push('Error rate threshold cannot be negative.')
  }

  return issues
}
