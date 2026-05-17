import { useState } from 'react'

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
  departments,
  categories,
  loadDepartments,
  loadCategories,
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
  startEditUser,
  cancelEditUser,
  saveEditedUser,
  editingUserId,
  editingUserRole, setEditingUserRole,
  editingUserActive, setEditingUserActive,
  editingUserPassword, setEditingUserPassword,
  editingUserDepartments, setEditingUserDepartments,
  requestDeleteUser, confirmDeleteUser, cancelDeleteUser, pendingDeleteUserId,
  userActionBusy,
  handleUpdateDepartment, handleDeleteDepartment,
  handleUpdateCategory, handleDeleteCategory,
  // constants
  ROLES, ROLE_PERMISSIONS, normalizeRole
}) {
  const editingUser = users.find((u) => u.id === editingUserId) || null
  const [editingDepartmentId, setEditingDepartmentId] = useState(null)
  const [editingDepartmentName, setEditingDepartmentName] = useState('')
  const [pendingDeleteDepartmentId, setPendingDeleteDepartmentId] = useState(null)
  const [editingCategoryId, setEditingCategoryId] = useState(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [pendingDeleteCategoryId, setPendingDeleteCategoryId] = useState(null)

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
        <div className="top-gap admin-mgmt-card">
          <div className="panel-head">
            <h3>Departments ({departments.length})</h3>
            <button className="btn ghost compact" type="button" onClick={loadDepartments}>Refresh</button>
          </div>
          <div className="table-wrap admin-mini-table">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.length === 0 ? (
                  <tr><td colSpan={3}>No departments found.</td></tr>
                ) : (
                  departments.map((department) => (
                    <tr key={department.id}>
                      <td>#{department.id}</td>
                      <td>{department.name}</td>
                      <td>
                        {editingDepartmentId === department.id ? (
                          <>
                            <input
                              value={editingDepartmentName}
                              onChange={(e) => setEditingDepartmentName(e.target.value)}
                              placeholder="Department name"
                            />
                            <button className="chip action" type="button" onClick={() => handleUpdateDepartment(department.id, editingDepartmentName)}>
                              Save
                            </button>
                            <button className="chip action" type="button" onClick={() => setEditingDepartmentId(null)}>
                              Cancel
                            </button>
                          </>
                        ) : pendingDeleteDepartmentId === department.id ? (
                          <>
                            <button className="chip flagged action" type="button" onClick={() => handleDeleteDepartment(department.id)}>
                              Confirm Delete
                            </button>
                            <button className="chip action" type="button" onClick={() => setPendingDeleteDepartmentId(null)}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="chip action"
                              type="button"
                              onClick={() => {
                                setEditingDepartmentId(department.id)
                                setEditingDepartmentName(department.name || '')
                                setPendingDeleteDepartmentId(null)
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="chip flagged action"
                              type="button"
                              onClick={() => {
                                setPendingDeleteDepartmentId(department.id)
                                setEditingDepartmentId(null)
                              }}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="chip-row top-gap">
            {departments.length === 0 ? (
              <span className="chip">Create your first department above.</span>
            ) : (
              departments.map((department) => (
                <span className="chip" key={`d-${department.id}`}>
                  {department.name}
                </span>
              ))
            )}
          </div>
        </div>

        <h3 className="top-gap">Create Category</h3>
        <form className="stack" onSubmit={handleCreateCategory}>
          <label className="field">
            <span>Category Name</span>
            <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
          </label>
          <button className="btn secondary" type="submit">Create Category</button>
        </form>
        <div className="top-gap admin-mgmt-card">
          <div className="panel-head">
            <h3>Categories ({categories.length})</h3>
            <button className="btn ghost compact" type="button" onClick={loadCategories}>Refresh</button>
          </div>
          <div className="table-wrap admin-mini-table">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr><td colSpan={3}>No categories found.</td></tr>
                ) : (
                  categories.map((category) => (
                    <tr key={category.id}>
                      <td>#{category.id}</td>
                      <td>{category.name}</td>
                      <td>
                        {editingCategoryId === category.id ? (
                          <>
                            <input
                              value={editingCategoryName}
                              onChange={(e) => setEditingCategoryName(e.target.value)}
                              placeholder="Category name"
                            />
                            <button className="chip action" type="button" onClick={() => handleUpdateCategory(category.id, editingCategoryName)}>
                              Save
                            </button>
                            <button className="chip action" type="button" onClick={() => setEditingCategoryId(null)}>
                              Cancel
                            </button>
                          </>
                        ) : pendingDeleteCategoryId === category.id ? (
                          <>
                            <button className="chip flagged action" type="button" onClick={() => handleDeleteCategory(category.id)}>
                              Confirm Delete
                            </button>
                            <button className="chip action" type="button" onClick={() => setPendingDeleteCategoryId(null)}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="chip action"
                              type="button"
                              onClick={() => {
                                setEditingCategoryId(category.id)
                                setEditingCategoryName(category.name || '')
                                setPendingDeleteCategoryId(null)
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="chip flagged action"
                              type="button"
                              onClick={() => {
                                setPendingDeleteCategoryId(category.id)
                                setEditingCategoryId(null)
                              }}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="chip-row top-gap">
            {categories.length === 0 ? (
              <span className="chip">Create your first category above.</span>
            ) : (
              categories.map((category) => (
                <span className="chip" key={`c-${category.id}`}>
                  {category.name}
                </span>
              ))
            )}
          </div>
        </div>

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

        {editingUser && (
          <div className="admin-mgmt-card top-gap">
            <div className="panel-head">
              <h3>Edit User: {editingUser.username}</h3>
              <button className="btn ghost compact" type="button" onClick={cancelEditUser}>Close</button>
            </div>
            <div className="dual">
              <label className="field">
                <span>Username</span>
                <input value={editingUser.username || ''} disabled />
              </label>
              <label className="field">
                <span>Email</span>
                <input value={editingUser.email || ''} disabled />
              </label>
              <label className="field">
                <span>Role</span>
                <select value={editingUserRole} onChange={(e) => setEditingUserRole(e.target.value)}>
                  {ROLES.map((candidate) => (
                    <option key={candidate} value={candidate}>{candidate}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>State</span>
                <select value={editingUserActive ? 'active' : 'disabled'} onChange={(e) => setEditingUserActive(e.target.value === 'active')}>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </label>
            </div>
            <div className="top-gap">
              <span className="small-note">Assigned Departments</span>
              <div className="chip-row top-gap">
                {departments.length === 0 ? (
                  <span className="chip">No departments available.</span>
                ) : (
                  departments.map((department) => {
                    const checked = editingUserDepartments.includes(Number(department.id))
                    return (
                      <label className="chip action" key={`edit-user-dept-${department.id}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const depId = Number(department.id)
                            if (e.target.checked) {
                              setEditingUserDepartments((prev) => [...new Set([...prev, depId])])
                            } else {
                              setEditingUserDepartments((prev) => prev.filter((id) => Number(id) !== depId))
                            }
                          }}
                        />
                        <span>{department.name}</span>
                      </label>
                    )
                  })
                )}
              </div>
            </div>
            <label className="field top-gap">
              <span>Optional new password</span>
              <input
                type="password"
                placeholder="Leave empty to keep unchanged"
                value={editingUserPassword}
                onChange={(e) => setEditingUserPassword(e.target.value)}
              />
            </label>
            <p className="small-note">Username/email update endpoints are not yet exposed by backend; role/state/password/department assignment are editable here.</p>
            <div className="toolbar-row top-gap">
              <button className="btn" type="button" onClick={saveEditedUser} disabled={userActionBusy}>
                {userActionBusy ? 'Saving...' : 'Save Changes'}
              </button>
              <button className="btn ghost" type="button" onClick={cancelEditUser} disabled={userActionBusy}>
                Cancel
              </button>
            </div>
          </div>
        )}

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
                      <button className="chip action" type="button" onClick={() => startEditUser(user)} disabled={userActionBusy}>
                        Edit
                      </button>
                      <button className="chip action" type="button" onClick={() => handleResetUserPassword(user.id)} disabled={userActionBusy}>
                        Reset Password
                      </button>
                      {pendingDeleteUserId === user.id ? (
                        <>
                          <button className="chip flagged action" type="button" onClick={() => confirmDeleteUser(user)} disabled={userActionBusy}>
                            Confirm Delete
                          </button>
                          <button className="chip action" type="button" onClick={cancelDeleteUser} disabled={userActionBusy}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button className="chip flagged action" type="button" onClick={() => requestDeleteUser(user)} disabled={userActionBusy}>
                          Delete
                        </button>
                      )}
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
