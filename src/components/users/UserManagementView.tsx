'use client';

import React, { useState, useEffect } from 'react';
import { User, RoleCode, PermissionCode, UserPermissionOverride } from '@/types/database';
import { ROLE_LABELS, PERMISSION_DESCRIPTIONS } from '@/lib/rbac';
import { formatDate } from '@/lib/utils';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Mail,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Shield,
  Key,
  Lock,
  UserX,
  AlertTriangle,
  Building2,
  RefreshCw,
  Search,
  Filter,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Plus
} from 'lucide-react';
import { LoadingSpinner, InlineLoader, TableSkeleton } from '@/components/ui/Loading';

interface Props {
  initialUsers: User[];
  currentUserRole: string;
  currentUserId: string;
}

export function UserManagementView({ initialUsers, currentUserRole, currentUserId }: Props) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);
  const [userActionType, setUserActionType] = useState<'ADD_USER' | 'EDIT_ROLE' | 'EDIT_DEPT' | 'DEACTIVATE' | 'DELETE' | 'RESET_PASS' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    full_name: '',
    email: '',
    department: 'Engineering & Technology',
    role: 'HR_ADMIN' as RoleCode,
    is_active: true,
  });

  const [editRoleModalUser, setEditRoleModalUser] = useState<User | null>(null);
  const [targetRole, setTargetRole] = useState<RoleCode>('HR_ADMIN');

  const [editDeptModalUser, setEditDeptModalUser] = useState<User | null>(null);
  const [targetDept, setTargetDept] = useState('');

  const [deactivateModalUser, setDeactivateModalUser] = useState<User | null>(null);
  const [deactivationReason, setDeactivationReason] = useState('');

  const [deleteModalUser, setDeleteModalUser] = useState<User | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const [permissionModalUser, setPermissionModalUser] = useState<User | null>(null);
  const [userPermissions, setUserPermissions] = useState<{
    basePermissions: PermissionCode[];
    overrides: UserPermissionOverride[];
    effectivePermissions: PermissionCode[];
  } | null>(null);
  const [permLoading, setPermLoading] = useState(false);
  const [removeConfirmModal, setRemoveConfirmModal] = useState<{
    code: PermissionCode;
    description: string;
    isBase: boolean;
    overrideType: 'GRANT' | 'DENY';
  } | null>(null);
  const [overrideActionLoading, setOverrideActionLoading] = useState(false);

  // One-time Temporary Password Modal
  const [tempPasswordModal, setTempPasswordModal] = useState<{ email: string; tempPassword: string; title: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const isSuperAdmin = currentUserRole === 'SUPER_ADMIN';

  // Synchronize component state with fresh server-rendered initialUsers
  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setUserActionType('ADD_USER');
    setMessage(null);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create system user.');

      setMessage({ type: 'success', text: `System user ${data.user.full_name} created successfully.` });
      setAddUserModalOpen(false);

      if (data.user?.tempPassword) {
        setTempPasswordModal({
          email: data.user.email,
          tempPassword: data.user.tempPassword,
          title: 'System User Created — One-Time Temporary Password',
        });
      }

      setNewUser({
        full_name: '',
        email: '',
        department: 'Engineering & Technology',
        role: 'HR_ADMIN',
        is_active: true,
      });
      fetchUsers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
      setUserActionType(null);
    }
  };

  const handleResetPassword = async (targetUser: User) => {
    if (!window.confirm(`Are you sure you want to reset the password for ${targetUser.full_name} (${targetUser.email})? A new temporary password will be generated and will force a password change upon their next login.`)) {
      return;
    }

    setLoading(true);
    setUserActionType('RESET_PASS');
    setMessage(null);
    try {
      const res = await fetch(`/api/users/${targetUser.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset user password.');

      setTempPasswordModal({
        email: data.email || targetUser.email,
        tempPassword: data.tempPassword,
        title: 'Password Reset — One-Time Temporary Password',
      });
      fetchUsers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
      setUserActionType(null);
    }
  };

  const handleResetMfa = async (targetUser: User) => {
    if (!window.confirm(`Are you sure you want to reset Multi-Factor Authentication (TOTP MFA) for ${targetUser.full_name} (${targetUser.email})? This will invalidate their authenticator secret, delete existing recovery codes, and terminate any active sessions. They will be required to configure a new authenticator upon their next login.`)) {
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/auth/mfa/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: targetUser.id,
          reason: `Admin MFA reset requested by ${currentUserRole} via User Management console`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset MFA for user.');

      setMessage({ type: 'success', text: `MFA reset successfully for ${targetUser.email}. User must re-enroll on next login.` });
      fetchUsers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!editRoleModalUser) return;
    setLoading(true);
    setUserActionType('EDIT_ROLE');
    setMessage(null);
    try {
      const res = await fetch(`/api/users/${editRoleModalUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: targetRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change role.');

      setMessage({ type: 'success', text: `Role updated for ${editRoleModalUser.full_name}.` });
      setEditRoleModalUser(null);
      fetchUsers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
      setUserActionType(null);
    }
  };

  const handleUpdateDept = async () => {
    if (!editDeptModalUser || !targetDept.trim()) return;
    setLoading(true);
    setUserActionType('EDIT_DEPT');
    setMessage(null);
    try {
      const res = await fetch(`/api/users/${editDeptModalUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department: targetDept.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update department.');

      setMessage({ type: 'success', text: `Department updated for ${editDeptModalUser.full_name}.` });
      setEditDeptModalUser(null);
      fetchUsers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
      setUserActionType(null);
    }
  };

  const handleToggleActive = async (targetUser: User, makeActive: boolean) => {
    if (!makeActive) {
      setDeactivateModalUser(targetUser);
      setDeactivationReason('');
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/users/${targetUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to activate user.');

      setMessage({ type: 'success', text: `User ${targetUser.full_name} activated successfully.` });
      fetchUsers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivateModalUser || !deactivationReason.trim()) return;
    setLoading(true);
    setUserActionType('DEACTIVATE');
    setMessage(null);
    try {
      const res = await fetch(`/api/users/${deactivateModalUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_active: false,
          deactivation_reason: deactivationReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to deactivate user.');

      setMessage({ type: 'success', text: `User ${deactivateModalUser.full_name} deactivated.` });
      setDeactivateModalUser(null);
      fetchUsers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
      setUserActionType(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalUser || !deleteReason.trim()) return;
    setLoading(true);
    setUserActionType('DELETE');
    setMessage(null);
    try {
      const res = await fetch(`/api/users/${deleteModalUser.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deleteReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user.');

      setMessage({ type: 'success', text: `User ${deleteModalUser.full_name} deleted and archived.` });
      setDeleteModalUser(null);
      fetchUsers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
      setUserActionType(null);
    }
  };

  const openPermissionsModal = async (targetUser: User) => {
    setPermissionModalUser(targetUser);
    setPermLoading(true);
    setRemoveConfirmModal(null);
    try {
      const res = await fetch(`/api/users/${targetUser.id}/permissions`);
      if (res.ok) {
        const data = await res.json();
        setUserPermissions(data.permissions);
      } else {
        const errData = await res.json().catch(() => ({}));
        setMessage({ type: 'error', text: errData.error || 'Failed to load user permissions.' });
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Error connecting to permissions service.' });
    } finally {
      setPermLoading(false);
    }
  };

  const handleSetPermissionOverride = async (code: PermissionCode, isGranted: boolean) => {
    if (!permissionModalUser) return;
    setOverrideActionLoading(true);
    try {
      const res = await fetch(`/api/users/${permissionModalUser.id}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission_code: code, is_granted: isGranted }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to update permission override.' });
      } else {
        setUserPermissions(data.permissions);
        setMessage({
          type: 'success',
          text: `Permission override ${isGranted ? 'granted' : 'denied'} for ${code}.`,
        });
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Network error while updating permission.' });
    } finally {
      setOverrideActionLoading(false);
    }
  };

  const handleConfirmRemoveOverride = async () => {
    if (!permissionModalUser || !removeConfirmModal) return;
    const { code } = removeConfirmModal;
    setOverrideActionLoading(true);
    try {
      const res = await fetch(`/api/users/${permissionModalUser.id}/permissions?permission_code=${code}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to remove permission override.' });
      } else {
        setUserPermissions(data.permissions);
        setMessage({
          type: 'success',
          text: `Permission override removed for ${code}. Role default restored.`,
        });
        setRemoveConfirmModal(null);
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Network error while resetting permission.' });
    } finally {
      setOverrideActionLoading(false);
    }
  };

  // Filtered list
  const filteredUsers = users.filter((u) => {
    if (u.deletion_status === 'DELETED') return false;
    const matchesSearch =
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.department || '').toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const allAvailablePermissions = Object.keys(PERMISSION_DESCRIPTIONS) as PermissionCode[];

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Users className="h-7 w-7 text-blue-600" />
            System User Directory
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Authorized administrative personnel, departmental assignments, and server-side RBAC clearance
          </p>
        </div>

        {/* Add User Button (Requirement 4: ONLY SUPER_ADMIN) */}
        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => setAddUserModalOpen(true)}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition shadow-xs self-start sm:self-auto"
          >
            <UserPlus className="h-4 w-4" />
            <span>+ Add System User</span>
          </button>
        )}
      </div>

      {message && (
        <div className={`p-4 rounded-xl border text-xs flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="h-4 w-4 shrink-0 text-red-600" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or department..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="p-2 border border-slate-300 rounded-lg text-xs outline-none bg-white font-medium"
          >
            <option value="ALL">All Assigned Roles</option>
            <option value="SUPER_ADMIN">Super Administrator</option>
            <option value="HR_ADMIN">HR Administrator</option>
            <option value="DOCUMENT_ADMIN">Document Administrator</option>
            <option value="PAYROLL_ADMIN">Payroll Administrator</option>
            <option value="VIEWER">Auditor / Viewer</option>
          </select>
          <button
            type="button"
            onClick={fetchUsers}
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 transition"
            title="Refresh Users"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3">User & Email</th>
                <th className="px-4 py-3">Assigned Role</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Account Status</th>
                <th className="px-4 py-3">Clearance Scope</th>
                {isSuperAdmin && <th className="px-4 py-3 text-right">Administrative Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading && filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 6 : 5} className="p-0">
                    <TableSkeleton rows={4} columns={isSuperAdmin ? 6 : 5} />
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 6 : 5} className="px-5 py-8 text-center text-slate-400">
                    No users found matching your search.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                const roleInfo = ROLE_LABELS[u.role] || { name: u.role, badgeColor: 'bg-slate-100 text-slate-800' };
                const isSelf = u.id === currentUserId;
                const isProtectedAdmin = u.role === 'SUPER_ADMIN' || u.email.toLowerCase() === 'admin@in.varsaka.com' || u.email.toLowerCase() === 'admin@varsaka.com';

                return (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                        <span>{u.full_name}</span>
                        {isSelf && (
                          <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-bold">
                            YOU
                          </span>
                        )}
                        {isProtectedAdmin && (
                          <span
                            className="inline-flex items-center gap-1 text-[9px] bg-amber-50 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
                            title="Protected System Administrator — role, department, deactivation and deletion are restricted."
                          >
                            <Lock className="h-2.5 w-2.5 text-amber-700" />
                            Protected
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                        <Mail className="h-3 w-3" />
                        {u.email}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${roleInfo.badgeColor}`}>
                        {isProtectedAdmin && <Lock className="h-2.5 w-2.5" />}
                        {roleInfo.name}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-slate-700 font-medium">
                      <span className="inline-flex items-center gap-1">
                        {u.department || 'General'}
                        {isProtectedAdmin && (
                          <span title="Protected System Administration department">
                            <Lock className="h-3 w-3 text-slate-400" />
                          </span>
                        )}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px]">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </span>
                      ) : (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 text-red-700 font-semibold bg-red-50 px-2 py-0.5 rounded border border-red-200 text-[10px]">
                            <XCircle className="h-3 w-3" />
                            Inactive
                          </span>
                          {u.deactivation_reason && (
                            <span className="block text-[9px] text-slate-400 italic max-w-xs truncate" title={u.deactivation_reason}>
                              {u.deactivation_reason}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-slate-600">
                      <button
                        type="button"
                        onClick={() => openPermissionsModal(u)}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold hover:underline"
                      >
                        <Key className="h-3 w-3" />
                        <span>{u.permissions.length} Permissions</span>
                      </button>
                    </td>

                    {isSuperAdmin && (
                      <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                        {isProtectedAdmin ? (
                          <>
                            {/* Safe Actions for Protected Super Administrator */}
                            <button
                              type="button"
                              onClick={() => openPermissionsModal(u)}
                              className="px-2.5 py-1 border border-blue-200 bg-blue-50/50 hover:bg-blue-100 text-blue-700 rounded text-[11px] font-bold transition inline-flex items-center gap-1"
                            >
                              <Key className="h-3 w-3" />
                              <span>View Permissions</span>
                            </button>

                            <a
                              href={`/audit-logs?user=${encodeURIComponent(u.email)}`}
                              className="px-2.5 py-1 border border-slate-200 hover:bg-slate-100 rounded text-[11px] font-semibold text-slate-700 transition inline-flex items-center gap-1"
                            >
                              <Shield className="h-3 w-3 text-slate-500" />
                              <span>View Audit</span>
                            </a>

                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-slate-500 font-semibold text-[11px] cursor-not-allowed select-none"
                              title="Protected System Administrator — role, department, deactivation and deletion are restricted."
                            >
                              <Lock className="h-3 w-3 text-slate-400" />
                              <span>Protected</span>
                            </span>
                          </>
                        ) : (
                          <>
                            {/* Standard Controls for Non-Protected Users */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditRoleModalUser(u);
                                setTargetRole(u.role);
                              }}
                              className="px-2.5 py-1 border border-slate-200 hover:bg-slate-100 rounded text-[11px] font-semibold text-slate-700 transition"
                            >
                              Role
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setEditDeptModalUser(u);
                                setTargetDept(u.department || 'General');
                              }}
                              className="px-2.5 py-1 border border-slate-200 hover:bg-slate-100 rounded text-[11px] font-semibold text-slate-700 transition"
                            >
                              Dept
                            </button>

                            <button
                              type="button"
                              onClick={() => openPermissionsModal(u)}
                              className="px-2.5 py-1 border border-blue-200 bg-blue-50/50 hover:bg-blue-100 text-blue-700 rounded text-[11px] font-bold transition"
                            >
                              Permissions
                            </button>

                            {isSuperAdmin && (
                              <button
                                type="button"
                                onClick={() => handleResetPassword(u)}
                                className="px-2.5 py-1 border border-purple-200 bg-purple-50/70 hover:bg-purple-100 text-purple-700 rounded text-[11px] font-bold transition flex items-center gap-1"
                                title="Reset password and issue new temporary credential"
                              >
                                <Key className="h-3 w-3" />
                                Reset Pass
                              </button>
                            )}

                            {isSuperAdmin && (
                              <button
                                type="button"
                                onClick={() => handleResetMfa(u)}
                                className="px-2.5 py-1 border border-amber-200 bg-amber-50/70 hover:bg-amber-100 text-amber-700 rounded text-[11px] font-bold transition flex items-center gap-1"
                                title="Reset TOTP MFA and invalidate existing sessions"
                              >
                                <ShieldCheck className="h-3 w-3" />
                                Reset MFA
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleToggleActive(u, !u.is_active)}
                              className={`px-2.5 py-1 rounded text-[11px] font-bold transition ${
                                u.is_active
                                  ? 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                  : 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              }`}
                            >
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setDeleteModalUser(u);
                                setDeleteReason('');
                              }}
                              className="px-2.5 py-1 border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 rounded text-[11px] font-bold transition"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. ADD SYSTEM USER MODAL (Requirement 4)                                  */}
      {/* ========================================================================= */}
      {addUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3 border-b pb-3 border-slate-100">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                <UserPlus className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">+ Add System User</h3>
                <p className="text-xs text-slate-500">
                  Secure invitation without manual password creation.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Full Legal Name *</label>
                <input
                  type="text"
                  required
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                  placeholder="e.g. Priyanshu Sharma"
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Corporate Email Address *</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="name@varsaka.com"
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Department</label>
                <input
                  type="text"
                  value={newUser.department}
                  onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                  placeholder="e.g. Engineering & Technology"
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Assigned Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as RoleCode })}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none bg-white font-medium"
                  >
                    <option value="HR_ADMIN">HR Administrator</option>
                    <option value="DOCUMENT_ADMIN">Document Administrator</option>
                    <option value="PAYROLL_ADMIN">Payroll Administrator</option>
                    <option value="VIEWER">Auditor / Viewer</option>
                    <option value="SUPER_ADMIN">Super Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Account Status</label>
                  <select
                    value={newUser.is_active ? 'active' : 'inactive'}
                    onChange={(e) => setNewUser({ ...newUser, is_active: e.target.value === 'active' })}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none bg-white font-medium"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-900 leading-relaxed">
                The user account is securely initialized through the Supabase Authentication layer. No passwords are exposed or manually configured.
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setAddUserModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2 border rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  aria-busy={loading && userActionType === 'ADD_USER'}
                  aria-disabled={loading}
                  className="w-full sm:w-auto px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {loading && userActionType === 'ADD_USER' && <LoadingSpinner size="xs" variant="white" />}
                  <span>{loading && userActionType === 'ADD_USER' ? 'Creating User...' : 'Create System User'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CHANGE ROLE MODAL (Requirement 5A)                                     */}
      {/* ========================================================================= */}
      {editRoleModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Change Assigned Role</h3>
            <p className="text-xs text-slate-500">
              Select new security clearance for <strong>{editRoleModalUser.full_name}</strong>.
            </p>

            <div className="space-y-2 text-xs">
              <label className="font-semibold text-slate-700 block">Security Role</label>
              <select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value as RoleCode)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium text-xs"
              >
                <option value="SUPER_ADMIN">Super Administrator</option>
                <option value="HR_ADMIN">HR Administrator</option>
                <option value="DOCUMENT_ADMIN">Document Administrator</option>
                <option value="PAYROLL_ADMIN">Payroll Administrator</option>
                <option value="VIEWER">Auditor / Viewer</option>
              </select>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={loading}
                onClick={() => setEditRoleModalUser(null)}
                className="w-full sm:w-auto px-4 py-2 border rounded-lg text-xs font-semibold text-slate-700 disabled:opacity-50 text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                aria-busy={loading && userActionType === 'EDIT_ROLE'}
                aria-disabled={loading}
                onClick={handleUpdateRole}
                className="w-full sm:w-auto px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {loading && userActionType === 'EDIT_ROLE' && <LoadingSpinner size="xs" variant="white" />}
                <span>{loading && userActionType === 'EDIT_ROLE' ? 'Saving Role...' : 'Save Role'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CHANGE DEPARTMENT MODAL (Requirement 5B)                               */}
      {/* ========================================================================= */}
      {editDeptModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Change Department</h3>
            <p className="text-xs text-slate-500">
              Assign new department for <strong>{editDeptModalUser.full_name}</strong>.
            </p>

            <div className="space-y-2 text-xs">
              <label className="font-semibold text-slate-700 block">Department Name</label>
              <input
                type="text"
                value={targetDept}
                onChange={(e) => setTargetDept(e.target.value)}
                placeholder="e.g. Finance & Operations"
                className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={loading}
                onClick={() => setEditDeptModalUser(null)}
                className="w-full sm:w-auto px-4 py-2 border rounded-lg text-xs font-semibold text-slate-700 disabled:opacity-50 text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading || !targetDept.trim()}
                aria-busy={loading && userActionType === 'EDIT_DEPT'}
                aria-disabled={loading || !targetDept.trim()}
                onClick={handleUpdateDept}
                className="w-full sm:w-auto px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {loading && userActionType === 'EDIT_DEPT' && <LoadingSpinner size="xs" variant="white" />}
                <span>{loading && userActionType === 'EDIT_DEPT' ? 'Saving Department...' : 'Save Department'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. DEACTIVATE USER MODAL (Requirement 6)                                  */}
      {/* ========================================================================= */}
      {deactivateModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3 border-b pb-3 border-slate-100">
              <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Deactivate System User</h3>
                <p className="text-xs text-slate-500">
                  Suspends login access for <strong>{deactivateModalUser.full_name}</strong> while preserving audit history.
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="font-semibold text-slate-700 block">
                Mandatory Reason for Deactivation *
              </label>
              <textarea
                rows={3}
                value={deactivationReason}
                onChange={(e) => setDeactivationReason(e.target.value)}
                placeholder="e.g. Employee left organization, role retired, security audit review..."
                className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-600"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={loading}
                onClick={() => setDeactivateModalUser(null)}
                className="w-full sm:w-auto px-4 py-2 border rounded-lg text-xs font-semibold text-slate-700 disabled:opacity-50 text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading || !deactivationReason.trim()}
                aria-busy={loading && userActionType === 'DEACTIVATE'}
                aria-disabled={loading || !deactivationReason.trim()}
                onClick={handleConfirmDeactivate}
                className="w-full sm:w-auto px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {loading && userActionType === 'DEACTIVATE' && <LoadingSpinner size="xs" variant="white" />}
                <span>{loading && userActionType === 'DEACTIVATE' ? 'Deactivating...' : 'Confirm Deactivation'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. DELETE USER MODAL (Requirement 7)                                      */}
      {/* ========================================================================= */}
      {deleteModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3 border-b pb-3 border-slate-100">
              <div className="p-2.5 bg-red-100 text-red-700 rounded-xl shrink-0">
                <UserX className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete System User</h3>
                <p className="text-xs text-slate-500">
                  Safely archives <strong>{deleteModalUser.full_name}</strong> ({deleteModalUser.email}).
                </p>
              </div>
            </div>

            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 leading-relaxed">
              Historical document issuances, audit logs, and approval signatures generated by this user are permanently preserved for compliance. The account will be marked DELETED.
            </div>

            <div className="space-y-2 text-xs">
              <label className="font-semibold text-slate-700 block">
                Mandatory Deletion Reason *
              </label>
              <textarea
                rows={3}
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="e.g. Account lifecycle termination, duplicate administrative profile..."
                className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={loading}
                onClick={() => setDeleteModalUser(null)}
                className="w-full sm:w-auto px-4 py-2 border rounded-lg text-xs font-semibold text-slate-700 disabled:opacity-50 text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading || !deleteReason.trim()}
                aria-busy={loading && userActionType === 'DELETE'}
                aria-disabled={loading || !deleteReason.trim()}
                onClick={handleConfirmDelete}
                className="w-full sm:w-auto px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {loading && userActionType === 'DELETE' && <LoadingSpinner size="xs" variant="white" />}
                <span>{loading && userActionType === 'DELETE' ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. GRANULAR PERMISSION MANAGEMENT SCREEN (Requirement 5C, 5D, 5E)         */}
      {/* ========================================================================= */}
      {permissionModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full p-4 sm:p-6 space-y-4 max-h-[90vh] flex flex-col">
            
            <div className="flex items-start justify-between gap-2 border-b pb-3 border-slate-100">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <Key className="h-5 w-5 text-blue-600 shrink-0" />
                  <span className="truncate">Granular Permission: {permissionModalUser.full_name}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  Assigned Role: <span className="font-bold text-slate-800">{permissionModalUser.role}</span> • Department: <span className="font-bold text-slate-800">{permissionModalUser.department || 'General'}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPermissionModalUser(null)}
                className="px-3 py-1.5 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 shrink-0"
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto flex-1 pr-1">
              {permLoading ? (
                <div className="py-12 flex justify-center">
                  <InlineLoader text="Loading server-side permission records..." size="md" />
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full min-w-[620px] text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px] sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5">Permission Code</th>
                      <th className="px-4 py-2.5">Description</th>
                      <th className="px-4 py-2.5">Source</th>
                      <th className="px-4 py-2.5 text-center">Effective Status</th>
                      {isSuperAdmin && <th className="px-4 py-2.5 text-right">Override Control</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allAvailablePermissions.map((code) => {
                      const isBase = userPermissions?.basePermissions?.includes(code) || false;
                      const override = userPermissions?.overrides?.find((o) => o.permission_code === code);
                      const isEffective = userPermissions?.effectivePermissions?.includes(code) || false;

                      // Visual differentiation: Role base vs User override
                      let sourceBadge: React.ReactNode;
                      if (override) {
                        if (override.is_granted) {
                          sourceBadge = (
                            <span className="text-[10px] px-2 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-900 font-bold inline-flex items-center gap-1 shadow-2xs">
                              <Sparkles className="h-3 w-3 text-amber-600" />
                              Grant Override
                            </span>
                          );
                        } else {
                          sourceBadge = (
                            <span className="text-[10px] px-2 py-0.5 rounded border border-red-300 bg-red-50 text-red-900 font-bold inline-flex items-center gap-1 shadow-2xs">
                              <AlertCircle className="h-3 w-3 text-red-600" />
                              Deny Override
                            </span>
                          );
                        }
                      } else if (isBase) {
                        sourceBadge = (
                          <span className="text-[10px] px-2 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-800 font-medium inline-flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3 text-blue-600" />
                            In Role ({permissionModalUser.role})
                          </span>
                        );
                      } else {
                        sourceBadge = (
                          <span className="text-[10px] px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-500 font-medium inline-flex items-center gap-1">
                            Not in Role
                          </span>
                        );
                      }

                      return (
                        <tr key={code} className={`hover:bg-slate-50/70 transition-colors ${override ? 'bg-amber-50/20' : ''}`}>
                          <td className="px-4 py-2.5 font-mono font-bold text-slate-900 text-[11px]">
                            {code}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600 text-[11px]">
                            {PERMISSION_DESCRIPTIONS[code]}
                          </td>
                          <td className="px-4 py-2.5">
                            {sourceBadge}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {isEffective ? (
                              <span className="inline-flex items-center gap-1 text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 text-[10px] shadow-2xs">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                Granted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-slate-500 font-semibold bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 text-[10px]">
                                <XCircle className="h-3 w-3 text-slate-400" />
                                Denied
                              </span>
                            )}
                          </td>
                          {isSuperAdmin && (
                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                              {permissionModalUser.role === 'SUPER_ADMIN' ? (
                                <span className="text-[10px] text-slate-400 italic">Super Admin All-Access</span>
                              ) : permissionModalUser.id === currentUserId ? (
                                <span className="text-[10px] text-slate-400 italic">Self-modification blocked</span>
                              ) : override ? (
                                <button
                                  type="button"
                                  disabled={overrideActionLoading}
                                  onClick={() =>
                                    setRemoveConfirmModal({
                                      code,
                                      description: PERMISSION_DESCRIPTIONS[code],
                                      isBase,
                                      overrideType: override.is_granted ? 'GRANT' : 'DENY',
                                    })
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 border border-amber-300 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-900 rounded-md text-[10px] font-bold transition shadow-2xs cursor-pointer"
                                  title="Remove temporary user-level override and reset to role default"
                                >
                                  <RotateCcw className="h-3 w-3 text-amber-700" />
                                  Remove Override
                                </button>
                              ) : isBase ? (
                                <div className="inline-flex items-center gap-2">
                                  <span className="text-[11px] text-slate-400 font-medium">Inherited from Role</span>
                                  <button
                                    type="button"
                                    disabled={overrideActionLoading}
                                    onClick={() => handleSetPermissionOverride(code, false)}
                                    className="px-2 py-0.5 border border-red-200 bg-red-50/60 hover:bg-red-100 text-red-700 rounded text-[10px] font-semibold transition cursor-pointer"
                                    title="Explicitly deny this permission for this user"
                                  >
                                    Deny Override
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={overrideActionLoading}
                                  onClick={() => handleSetPermissionOverride(code, true)}
                                  className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-md text-[10px] font-bold shadow-2xs transition cursor-pointer"
                                  title="Temporarily grant this permission to this user"
                                >
                                  <Plus className="h-3 w-3" />
                                  Grant
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
              <span>All permission grants and revocations are evaluated server-side and recorded in the audit log.</span>
              <button
                type="button"
                onClick={() => setPermissionModalUser(null)}
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold text-center"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6B. REMOVE PERMISSION OVERRIDE CONFIRMATION MODAL (PART 6)                 */}
      {/* ========================================================================= */}
      {removeConfirmModal && permissionModalUser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3 border-b pb-3 border-slate-100">
              <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl shrink-0">
                <RotateCcw className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Remove Permission Override?</h3>
                <p className="text-xs text-slate-500">
                  Reset permission to role-derived default for <strong>{permissionModalUser.full_name}</strong>.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
              <div>
                <span className="text-slate-500 font-semibold block text-[11px] uppercase tracking-wider">Permission:</span>
                <span className="font-mono font-bold text-slate-900 text-xs block mt-0.5">
                  {removeConfirmModal.code}
                </span>
                <span className="text-slate-600 text-[11px] block">
                  {removeConfirmModal.description}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                <div>
                  <span className="text-slate-500 font-semibold block text-[10px] uppercase">Current State:</span>
                  <span className={`text-xs font-bold block mt-0.5 ${
                    removeConfirmModal.overrideType === 'GRANT' ? 'text-emerald-700' : 'text-red-700'
                  }`}>
                    {removeConfirmModal.overrideType === 'GRANT' ? 'Granted by User Override' : 'Denied by User Override'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block text-[10px] uppercase">After Removal:</span>
                  <span className={`text-xs font-bold block mt-0.5 ${
                    removeConfirmModal.isBase ? 'text-emerald-700' : 'text-slate-600'
                  }`}>
                    {removeConfirmModal.isBase
                      ? `Granted — inherited from ${permissionModalUser.role} role`
                      : `Denied — inherited from ${permissionModalUser.role} role`}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
              Removing this override will delete the explicit user-level override and immediately restore the user&apos;s inherited role default.
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={overrideActionLoading}
                onClick={() => setRemoveConfirmModal(null)}
                className="w-full sm:w-auto px-4 py-2 border rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={overrideActionLoading}
                aria-busy={overrideActionLoading}
                aria-disabled={overrideActionLoading}
                onClick={handleConfirmRemoveOverride}
                className="w-full sm:w-auto px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                {overrideActionLoading ? <LoadingSpinner size="xs" variant="white" /> : <RotateCcw className="h-3.5 w-3.5" />}
                <span>{overrideActionLoading ? 'Removing...' : 'Remove Override'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. ONE-TIME TEMPORARY PASSWORD DISPLAY MODAL                              */}
      {/* ========================================================================= */}
      {tempPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3 border-b pb-3 border-slate-100">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl shrink-0">
                <Key className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{tempPasswordModal.title}</h3>
                <p className="text-xs text-slate-500">
                  A secure temporary credential has been generated.
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <span className="font-semibold text-slate-500 block mb-1">Email:</span>
                <span className="font-mono text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg block font-semibold">
                  {tempPasswordModal.email}
                </span>
              </div>

              <div>
                <span className="font-semibold text-slate-500 block mb-1">Temporary Password:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg flex-1 tracking-wider select-all">
                    {tempPasswordModal.tempPassword}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(tempPasswordModal.tempPassword);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="px-3 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-bold transition shrink-0"
                  >
                    {copied ? 'Copied!' : 'Copy Password'}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 leading-relaxed font-medium">
                ⚠️ <strong>Warning:</strong> This temporary password will only be displayed once. Send it securely to the user. It will force a password change upon their first login.
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setTempPasswordModal(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold transition text-xs"
              >
                Done &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
