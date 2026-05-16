export default function UsersTab({
  // forms
  handleCreateUser,
  newUserName, setNewUserName,
  newUserEmail, setNewUserEmail,
  newUserPassword, setNewUserPassword,
  newUserRole, setNewUserRole,
  handleChangeMyPassword,
  newPasswordCurrent, setNewPasswordCurrent,
  newPasswordNext, setNewPasswordNext,
  handleCreateDepartment,
  newDepartmentName, setNewDepartmentName,
  handleCreateCategory,
  newCategoryName, setNewCategoryName,
  // list
  users, filteredUsers, loadingUsers,
  userQuery, setUserQuery,
  userRoleFilter, setUserRoleFilter,
  userStateFilter, setUserStateFilter,
  userSortBy, setUserSortBy,
  userSortDir, setUserSortDir,
  clearUserFilters, loadUsers,
  // actions
  updateUserRoleLocal, toggleUserActive, handleResetUserPassword,
  // constants
  ROLES, ROLE_PERMISSIONS, normalizeRole
}) {
  return (
    <section className="panel-grid two">
      <article className="panel">
        <h2>Create User</h2>
        <form className="stack" onSubmit={handleCreateUser}>
          <label className="field">
            <span>Name</span>
            <input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
          </label>
          <label className="field">
            <span>Email</span>
            <input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Initial Password</span>
            <input
              type="password"
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              placeholder="Minimum 8 characters"
            />
          </label>
          <label className="field">
            <span>Role</span>
            <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)}>
              {ROLES.map((candidate) => (
                <option key={candidate} value={candidate}>{candidate}</option>
              ))}
            </select>
          </label>
          <button className="btn" type="submit">Create User</button>
        </form>

        <h3 className="top-gap">Change My Password</h3>
        <form className="stack" onSubmit={handleChangeMyPassword}>
          <label className="field">
            <span>Current Password</span>
            <input
              type="password"
              value={newPasswordCurrent}
              onChange={(e) => setNewPasswordCurrent(e.target.value)}
            />
          </label>
          <label className="field">
            <span>New Password</span>
            <input
              type="password"
              value={newPasswordNext}
              onChange={(e) => setNewPasswordNext(e.target.value)}
            />
          </label>
          <button className="btn secondary" type="submit">Change My Password</button>
        </form>

        <h3 className="top-gap">Create Department</h3>
        <form className="stack" onSubmit={handleCreateDepartment}>
          <label className="field">
            <span>Department Name</span>
            <input value={newDepartmentName} onChange={(e) => setNewDepartmentName(e.target.value)} />
          </label>
          <button className="btn secondary" type="submit">Create Department</button>
        </form>

        <h3 className="top-gap">Create Category</h3>
        <form className="stack" onSubmit={handleCreateCategory}>
          <label className="field">
            <span>Category Name</span>
            <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
          </label>
          <button className="btn secondary" type="submit">Create Category</button>
        </form>

      </article>

      <article className="panel">
        <div className="panel-head">
          <h2>User List</h2>
          <p className="result-meta">
            Showing {filteredUsers.length} of {users.length} users
          </p>
        </div>

        <div className="toolbar-row">
          <label className="field inline compact grow">
            <span>Search</span>
            <input
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Search by name, email, or role"
            />
          </label>
          <label className="field inline compact">
            <span>Role</span>
            <select value={userRoleFilter} onChange={(e) => setUserRoleFilter(e.target.value)}>
              <option value="all">All roles</option>
              {ROLES.map((candidate) => (
                <option key={candidate} value={candidate}>{candidate}</option>
              ))}
            </select>
          </label>
          <label className="field inline compact">
            <span>State</span>
            <select value={userStateFilter} onChange={(e) => setUserStateFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          <label className="field inline compact">
            <span>Sort By</span>
            <select value={userSortBy} onChange={(e) => setUserSortBy(e.target.value)}>
              <option value="name">Username</option>
              <option value="email">Email</option>
              <option value="role">Role</option>
            </select>
          </label>
          <label className="field inline compact">
            <span>Order</span>
            <select value={userSortDir} onChange={(e) => setUserSortDir(e.target.value)}>
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
          <button className="btn ghost" type="button" onClick={clearUserFilters}>Reset</button>
          <button className="btn secondary" type="button" onClick={loadUsers}>Refresh Users</button>
        </div>

        {loadingUsers ? <p>Loading users...</p> : null}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Username</th><th>Email</th><th>Role</th><th>State</th><th>Last Login</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr><td colSpan={6}>No users match the selected filters.</td></tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>{user.email}</td>
                    <td>
                      <select
                        value={normalizeRole(user.role)}
                        onChange={(e) => updateUserRoleLocal(user.id, e.target.value)}
                      >
                        {ROLES.map((candidate) => (
                          <option key={candidate} value={candidate}>{candidate}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        className={user.active ? 'chip unflagged' : 'chip flagged'}
                        type="button"
                        onClick={() => toggleUserActive(user.id, user.active)}
                      >
                        {user.active ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '-'}</td>
                    <td>
                      <button className="chip action" type="button" onClick={() => handleResetUserPassword(user.id)}>
                        Reset Password
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="panel wide-panel">
        <h2>Permission Matrix</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Role</th><th>Tabs Allowed</th></tr>
            </thead>
            <tbody>
              {Object.entries(ROLE_PERMISSIONS).map(([permRole, permissions]) => (
                <tr key={permRole}>
                  <td>{permRole}</td>
                  <td>{permissions.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  )
}
