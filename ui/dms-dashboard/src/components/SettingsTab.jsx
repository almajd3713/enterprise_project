export default function SettingsTab({
  settingsDraft,
  handleSettingsChange,
  handleFeatureToggle,
  saveSettings,
  FEATURE_KEYS,
  settings,
}) {
  return (
    <section className="panel-grid two">
      <article className="panel wide-panel">
        <h2>General Settings</h2>
        <form className="stack" onSubmit={saveSettings}>
          <div className="dual">
            <label className="field">
              <span>Brand Name</span>
              <input
                value={settingsDraft.brandName}
                onChange={(e) => handleSettingsChange('brandName', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Timezone</span>
              <input
                value={settingsDraft.timezone}
                onChange={(e) => handleSettingsChange('timezone', e.target.value)}
              />
            </label>
          </div>

          <div className="dual">
            <label className="field">
              <span>Locale</span>
              <input
                value={settingsDraft.locale}
                onChange={(e) => handleSettingsChange('locale', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Retention Days</span>
              <input
                type="number"
                value={settingsDraft.retentionDays}
                onChange={(e) => handleSettingsChange('retentionDays', Number(e.target.value))}
              />
            </label>
          </div>

          <div className="dual">
            <label className="field">
              <span>Alert Email</span>
              <input
                type="email"
                value={settingsDraft.notifyEmail}
                onChange={(e) => handleSettingsChange('notifyEmail', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Webhook URL</span>
              <input
                value={settingsDraft.notifyWebhook}
                onChange={(e) => handleSettingsChange('notifyWebhook', e.target.value)}
              />
            </label>
          </div>

          <div className="dual">
            <label className="field">
              <span>p95 Threshold (ms)</span>
              <input
                type="number"
                value={settingsDraft.thresholdP95}
                onChange={(e) => handleSettingsChange('thresholdP95', Number(e.target.value))}
              />
            </label>
            <label className="field">
              <span>Error Rate Threshold (%)</span>
              <input
                type="number"
                value={settingsDraft.thresholdErrorRate}
                onChange={(e) => handleSettingsChange('thresholdErrorRate', Number(e.target.value))}
              />
            </label>
          </div>

          <div className="feature-grid">
            {FEATURE_KEYS.map((featureKey) => (
              <label key={featureKey} className="switch">
                <input
                  type="checkbox"
                  checked={Boolean(settingsDraft.features[featureKey])}
                  onChange={(e) => handleFeatureToggle(featureKey, e.target.checked)}
                />
                <span>{featureKey}</span>
              </label>
            ))}
          </div>

          <button className="btn" type="submit">Save Settings</button>
        </form>
      </article>

      <article className="panel">
        <h2>Active Settings Snapshot</h2>
        <pre>{JSON.stringify(settings, null, 2)}</pre>
      </article>
    </section>
  )
}
