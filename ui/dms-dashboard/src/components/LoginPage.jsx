import { normalizeApiBaseUrl } from '../utils/validators'

export default function LoginPage({
  apiBaseUrl,
  setApiBaseUrl,
  loginUsername,
  setLoginUsername,
  loginPassword,
  setLoginPassword,
  loginBusy,
  loginError,
  handleLogin,
}) {
  return (
    <div className="app-shell">
      <main className="workspace">
        <section className="panel-grid one">
          <article className="panel" style={{ maxWidth: 460, margin: '4rem auto' }}>
            <h2>Sign In</h2>
            <p>Login with a configured user to load tabs and permissions from the gateway.</p>
            <form className="stack top-gap" onSubmit={handleLogin}>
              <label className="field">
                <span>Gateway API Base URL</span>
                <input
                  value={apiBaseUrl}
                  onChange={(e) => setApiBaseUrl(normalizeApiBaseUrl(e.target.value))}
                  placeholder="http://localhost:8080/api"
                />
              </label>
              <label className="field">
                <span>Username</span>
                <input
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  autoComplete="username"
                />
              </label>
              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              {loginError ? <p className="toast err">{loginError}</p> : null}
              <button className="btn" type="submit" disabled={loginBusy}>
                {loginBusy ? 'Signing in...' : 'Sign In'}
              </button>
              <p className="small-note">
                Demo users: admin/admin123, operator/operator123, analyst/analyst123
              </p>
            </form>
          </article>
        </section>
      </main>
    </div>
  )
}
