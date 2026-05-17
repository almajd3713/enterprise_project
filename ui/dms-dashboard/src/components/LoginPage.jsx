export default function LoginPage({
  loginUsername,
  setLoginUsername,
  loginPassword,
  setLoginPassword,
  loginBusy,
  loginError,
  handleLogin,
}) {
  return (
    <div className="auth-shell">
      <section className="auth-panel">
        <p className="brand-eyebrow">Enterprise Reel</p>
        <h1>DMS Control Center</h1>
        <p className="auth-subtitle">
          Sign in with your account to access document workflows, admin controls, and observability dashboards.
        </p>
        <form className="stack top-gap" onSubmit={handleLogin}>
          <label className="field">
            <span>Username</span>
            <input
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              autoComplete="username"
              placeholder="admin"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </label>
          {loginError ? <p className="toast err">{loginError}</p> : null}
          <button className="btn" type="submit" disabled={loginBusy}>
            {loginBusy ? 'Signing in...' : 'Sign In'}
          </button>

        </form>
      </section>
    </div>
  )
}
