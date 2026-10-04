'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { TaskRecord, TaskPriority, TaskStatus, RoleCode } from '@/types/database';
import { formatDate } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import { TableSkeleton, LoadingSpinner } from '@/components/ui/Loading';
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  User,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  X,
  ExternalLink,
  ChevronRight,
  UserCheck,
  Users
} from 'lucide-react';

interface StaffUser {
  id: string;
  full_name: string;
  email: string;
  role: RoleCode;
  role_label: string;
}

interface EmployeeOption {
  id: string;
  employee_id: string;
  full_name: string;
}

interface DocumentOption {
  id: string;
  document_number: string;
  title: string;
  document_type: string;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [summary, setSummary] = useState({
    myOpen: 0,
    assignedToMe: 0,
    createdByMe: 0,
    completed: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);

  // Current authenticated user
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; role: RoleCode; full_name: string } | null>(null);

  // Filters
  const [view, setView] = useState<'my' | 'assigned_by_me' | 'all'>('my');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown reference data for Create Modal
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [employeeList, setEmployeeList] = useState<EmployeeOption[]>([]);
  const [documentList, setDocumentList] = useState<DocumentOption[]>([]);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionType, setActionType] = useState<'CREATE' | 'START' | 'BLOCK' | 'RESUME' | 'COMPLETE' | 'CANCEL' | 'REASSIGN' | null>(null);

  // Create Form State
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createAssignTo, setCreateAssignTo] = useState('me');
  const [createPriority, setCreatePriority] = useState<TaskPriority>('MEDIUM');
  const [createDueDate, setCreateDueDate] = useState('');
  const [createEmployeeId, setCreateEmployeeId] = useState('');
  const [createDocumentId, setCreateDocumentId] = useState('');

  // Reassign in Detail Modal
  const [showReassignDropdown, setShowReassignDropdown] = useState(false);
  const [newAssigneeId, setNewAssigneeId] = useState('');

  // Load current user profile
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(console.error);
  }, []);

  // Fetch tasks
  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('view', view);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (priorityFilter !== 'ALL') params.set('priority', priorityFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetch(`/api/tasks?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
        if (data.summary) {
          setSummary(data.summary);
        }
      } else {
        toast.error('Failed to load tasks');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error loading tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [view, statusFilter, priorityFilter, searchQuery]);

  // Load dropdown resources when opening create modal
  const handleOpenCreateModal = async () => {
    setShowCreateModal(true);
    // Reset form
    setCreateTitle('');
    setCreateDescription('');
    setCreateAssignTo('me');
    setCreatePriority('MEDIUM');
    setCreateDueDate('');
    setCreateEmployeeId('');
    setCreateDocumentId('');

    try {
      const [staffRes, empRes, docRes] = await Promise.all([
        fetch('/api/tasks/staff'),
        fetch('/api/employees'),
        fetch('/api/documents'),
      ]);

      if (staffRes.ok) {
        const s = await staffRes.json();
        setStaffList(s.staff || []);
      }
      if (empRes.ok) {
        const e = await empRes.json();
        setEmployeeList(e || []);
      }
      if (docRes.ok) {
        const d = await docRes.json();
        setDocumentList(d || []);
      }
    } catch (e) {
      console.error('Failed to load reference items for task modal:', e);
    }
  };

  // Submit Create Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) {
      toast.error('Task title is required');
      return;
    }

    setIsSubmitting(true);
    setActionType('CREATE');
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createTitle.trim(),
          description: createDescription.trim() || undefined,
          assign_to: createAssignTo,
          priority: createPriority,
          due_date: createDueDate ? new Date(createDueDate).toISOString() : undefined,
          employee_id: createEmployeeId || undefined,
          document_id: createDocumentId || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Task created successfully');
        setShowCreateModal(false);
        await fetchTasks();
      } else {
        toast.error(data.error || 'Failed to create task');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error creating task');
    } finally {
      setIsSubmitting(false);
      setActionType(null);
    }
  };

  // Update Task Action
  const handleUpdateTaskStatus = async (
    taskId: string,
    newStatus: TaskStatus,
    action?: 'START' | 'BLOCK' | 'RESUME' | 'COMPLETE' | 'CANCEL'
  ) => {
    setIsSubmitting(true);
    if (action) setActionType(action);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Task status updated to ${newStatus.replace('_', ' ')}`);
        if (selectedTask && selectedTask.id === taskId) {
          setSelectedTask(data.task);
        }
        await fetchTasks();
      } else {
        toast.error(data.error || 'Failed to update task status');
      }
    } catch (err: any) {
      toast.error(err.message || 'Network error updating task');
    } finally {
      setIsSubmitting(false);
      setActionType(null);
    }
  };

  // Reassign Task Action
  const handleReassignTask = async (taskId: string) => {
    if (!newAssigneeId) return;
    setIsSubmitting(true);
    setActionType('REASSIGN');
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assign_to: newAssigneeId }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Task reassigned successfully');
        setShowReassignDropdown(false);
        if (selectedTask && selectedTask.id === taskId) {
          setSelectedTask(data.task);
        }
        await fetchTasks();
      } else {
        toast.error(data.error || 'Failed to reassign task');
      }
    } catch (err: any) {
      toast.error(err.message || 'Network error reassigning task');
    } finally {
      setIsSubmitting(false);
      setActionType(null);
    }
  };

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'URGENT':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'MEDIUM':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'LOW':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusBadge = (s: TaskStatus) => {
    switch (s) {
      case 'COMPLETED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'BLOCKED':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'CANCELLED':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'TODO':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const isPrivileged = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'HR_ADMIN';

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <CheckSquare className="h-7 w-7 text-blue-600" />
            Tasks
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Assign, track and manage internal HR document workflows.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Create Task
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">My Open Tasks</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{summary.myOpen}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Active tasks assigned to you</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Assigned to Me</div>
          <div className="text-2xl font-black text-blue-600 mt-1">{summary.assignedToMe}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Total backlog &amp; active tasks</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Created by Me</div>
          <div className="text-2xl font-black text-slate-700 mt-1">{summary.createdByMe}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Delegated &amp; self-assigned tasks</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Completed Tasks</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{summary.completed}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Successfully finished workflows</div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* View Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setView('my')}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
                view === 'my' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              My Tasks
            </button>
            <button
              onClick={() => setView('assigned_by_me')}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
                view === 'assigned_by_me' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Assigned By Me
            </button>
            {isPrivileged && (
              <button
                onClick={() => setView('all')}
                className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
                  view === 'all' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Tasks
              </button>
            )}
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-sm">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search tasks by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        {/* Secondary Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
            <Filter className="h-3.5 w-3.5" />
            <span>Filter By:</span>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="BLOCKED">Blocked</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* Task List Table */}
      {loading ? (
        <TableSkeleton rows={6} columns={8} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {tasks.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <CheckSquare className="h-10 w-10 text-slate-300 mx-auto" />
            <h3 className="font-bold text-slate-800 text-sm">No tasks found</h3>
            <p className="text-xs text-slate-500">
              {searchQuery || statusFilter !== 'ALL' || priorityFilter !== 'ALL'
                ? 'Try adjusting your filters or search criteria.'
                : 'Create a task to get started.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3">Task</th>
                  <th className="px-4 py-3">Assigned To</th>
                  <th className="px-4 py-3">Created By</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Related Context</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {tasks.map((task) => {
                  const isAssignedToCurrent = currentUser?.id === task.assigned_to;
                  return (
                    <tr
                      key={task.id}
                      onClick={() => {
                        setSelectedTask(task);
                        setShowReassignDropdown(false);
                      }}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                    >
                      <td className="px-5 py-3.5 max-w-xs">
                        <div className="font-bold text-slate-900 text-sm truncate">{task.title}</div>
                        {task.description && (
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">{task.description}</div>
                        )}
                        <div className="text-[10px] text-slate-400 mt-1">
                          Created {formatDate(task.created_at)}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-800">
                            {isAssignedToCurrent ? `${task.assigned_to_name || 'Me'} (You)` : (task.assigned_to_name || 'Unassigned')}
                          </span>
                        </div>
                        {task.assigned_to_email && (
                          <div className="text-[10px] text-slate-400 font-mono pl-5">{task.assigned_to_email}</div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="text-slate-800 font-medium">
                          {currentUser?.id === task.created_by ? 'You' : (task.created_by_name || 'Staff')}
                        </div>
                        {task.created_by_email && (
                          <div className="text-[10px] text-slate-400 font-mono">{task.created_by_email}</div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getPriorityBadge(task.priority)}`}>
                          {task.priority}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        {task.due_date ? (
                          <span className="text-slate-700 font-medium">{formatDate(task.due_date)}</span>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadge(task.status)}`}>
                          {task.status.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5">
                          {task.employee_name && (
                            <div className="text-[11px] font-semibold text-slate-800 flex items-center gap-1">
                              <UserCheck className="h-3 w-3 text-slate-400" />
                              <span>{task.employee_name}</span>
                            </div>
                          )}
                          {task.document_number && (
                            <div className="text-[10px] font-mono font-semibold text-blue-600 flex items-center gap-1">
                              <FileText className="h-3 w-3 text-blue-500" />
                              <span>{task.document_number}</span>
                            </div>
                          )}
                          {!task.employee_name && !task.document_number && (
                            <span className="text-slate-400 italic text-[11px]">General workflow</span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTask(task);
                            setShowReassignDropdown(false);
                          }}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          Details
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* ======================================================================= */}
      {/* CREATE TASK MODAL                                                       */}
      {/* ======================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <CheckSquare className="h-5 w-5 text-blue-600" />
                <span>Create New Task</span>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Task Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="e.g. Verify candidate relieving letter credentials"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Provide context or instructions for this task..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Assign To <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={createAssignTo}
                    onChange={(e) => setCreateAssignTo(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 text-xs text-slate-800 font-medium cursor-pointer"
                  >
                    <option value="me">Me ({currentUser?.full_name || 'Current User'})</option>
                    {staffList
                      .filter((s) => s.id !== currentUser?.id)
                      .map((staff) => (
                        <option key={staff.id} value={staff.id}>
                          {staff.full_name} ({staff.role_label})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Priority
                  </label>
                  <select
                    value={createPriority}
                    onChange={(e) => setCreatePriority(e.target.value as TaskPriority)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 text-xs text-slate-800 font-medium cursor-pointer"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={createDueDate}
                  onChange={(e) => setCreateDueDate(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 text-xs text-slate-800 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Related Employee (Optional)
                  </label>
                  <select
                    value={createEmployeeId}
                    onChange={(e) => setCreateEmployeeId(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 text-xs text-slate-800 cursor-pointer"
                  >
                    <option value="">None / General</option>
                    {employeeList.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Related Document (Optional)
                  </label>
                  <select
                    value={createDocumentId}
                    onChange={(e) => setCreateDocumentId(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 text-xs text-slate-800 cursor-pointer"
                  >
                    <option value="">None / General</option>
                    {documentList.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.document_number} — {doc.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-full sm:w-auto px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !createTitle.trim()}
                  aria-busy={isSubmitting && actionType === 'CREATE'}
                  className="w-full sm:w-auto justify-center px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5 text-center"
                >
                  {isSubmitting && actionType === 'CREATE' && (
                    <LoadingSpinner size="xs" variant="white" label="Creating..." />
                  )}
                  <span>{isSubmitting && actionType === 'CREATE' ? 'Creating Task...' : 'Create Task'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* TASK DETAIL MODAL                                                       */}
      {/* ======================================================================= */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadge(selectedTask.status)}`}>
                    {selectedTask.status.replace('_', ' ')}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getPriorityBadge(selectedTask.priority)}`}>
                    {selectedTask.priority}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-900">{selectedTask.title}</h2>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Description */}
            <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200/80 leading-relaxed">
              {selectedTask.description || <span className="text-slate-400 italic">No description provided.</span>}
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs border-y border-slate-100 py-3">
              <div>
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Assigned To:</span>
                <span className="font-bold text-slate-800">
                  {selectedTask.assigned_to_name || 'Staff User'}
                  {currentUser?.id === selectedTask.assigned_to && ' (You)'}
                </span>
                {selectedTask.assigned_to_email && (
                  <div className="text-[10px] text-slate-400 font-mono">{selectedTask.assigned_to_email}</div>
                )}
              </div>

              <div>
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Created By:</span>
                <span className="font-bold text-slate-800">
                  {selectedTask.created_by_name || 'Staff User'}
                  {currentUser?.id === selectedTask.created_by && ' (You)'}
                </span>
                {selectedTask.created_by_email && (
                  <div className="text-[10px] text-slate-400 font-mono">{selectedTask.created_by_email}</div>
                )}
              </div>

              <div>
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Due Date:</span>
                <span className="font-medium text-slate-800">
                  {selectedTask.due_date ? formatDate(selectedTask.due_date) : 'None'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Created On:</span>
                <span className="font-medium text-slate-800">{formatDate(selectedTask.created_at)}</span>
              </div>

              {selectedTask.employee_name && (
                <div>
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Related Employee:</span>
                  <span className="font-bold text-slate-800">{selectedTask.employee_name}</span>
                  <span className="text-[10px] text-slate-500 font-mono block">{selectedTask.employee_code}</span>
                </div>
              )}

              {selectedTask.document_number && (
                <div>
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Related Document:</span>
                  <Link
                    href={`/documents/${selectedTask.document_id}`}
                    className="font-mono font-bold text-blue-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    {selectedTask.document_number}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  <span className="text-[10px] text-slate-500 block truncate">{selectedTask.document_title}</span>
                </div>
              )}
            </div>

            {/* Reassign Panel if expanded */}
            {showReassignDropdown && (
              <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-lg space-y-2 text-xs">
                <span className="font-bold text-blue-900 block">Select New Assignee:</span>
                <div className="flex gap-2">
                  <select
                    value={newAssigneeId}
                    onChange={(e) => setNewAssigneeId(e.target.value)}
                    className="flex-1 p-2 bg-white border border-slate-300 rounded-lg text-xs cursor-pointer"
                  >
                    <option value="">Select staff user...</option>
                    <option value="me">Me (Self-assign)</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} ({s.role_label})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleReassignTask(selectedTask.id)}
                    disabled={!newAssigneeId || isSubmitting}
                    aria-busy={isSubmitting && actionType === 'REASSIGN'}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {isSubmitting && actionType === 'REASSIGN' && (
                      <LoadingSpinner size="xs" variant="white" label="Reassigning..." />
                    )}
                    <span>{isSubmitting && actionType === 'REASSIGN' ? 'Reassigning...' : 'Reassign'}</span>
                  </button>
                  <button
                    onClick={() => setShowReassignDropdown(false)}
                    className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Workflow Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-2">
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {/* Reassign button */}
                {(isPrivileged || selectedTask.created_by === currentUser?.id) && !showReassignDropdown && (
                  <button
                    onClick={async () => {
                      if (staffList.length === 0) {
                        const s = await fetch('/api/tasks/staff').then((r) => r.json());
                        setStaffList(s.staff || []);
                      }
                      setShowReassignDropdown(true);
                    }}
                    className="px-3 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Users className="h-3.5 w-3.5 text-slate-500" />
                    Reassign
                  </button>
                )}

                {/* Cancel Task */}
                {(isPrivileged || selectedTask.created_by === currentUser?.id) && selectedTask.status !== 'CANCELLED' && (
                  <button
                    onClick={() => handleUpdateTaskStatus(selectedTask.id, 'CANCELLED', 'CANCEL')}
                    disabled={isSubmitting}
                    aria-busy={isSubmitting && actionType === 'CANCEL'}
                    className="px-3 py-1.5 text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting && actionType === 'CANCEL' ? (
                      <LoadingSpinner size="xs" variant="red" label="Cancelling..." />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-rose-500" />
                    )}
                    <span>{isSubmitting && actionType === 'CANCEL' ? 'Cancelling...' : 'Cancel Task'}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Start Task */}
                {selectedTask.status === 'TODO' && (
                  <button
                    onClick={() => handleUpdateTaskStatus(selectedTask.id, 'IN_PROGRESS', 'START')}
                    disabled={isSubmitting}
                    aria-busy={isSubmitting && actionType === 'START'}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs inline-flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting && actionType === 'START' ? (
                      <LoadingSpinner size="xs" variant="white" label="Starting..." />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    <span>{isSubmitting && actionType === 'START' ? 'Starting...' : 'Start Task'}</span>
                  </button>
                )}

                {/* Mark Blocked */}
                {(selectedTask.status === 'TODO' || selectedTask.status === 'IN_PROGRESS') && (
                  <button
                    onClick={() => handleUpdateTaskStatus(selectedTask.id, 'BLOCKED', 'BLOCK')}
                    disabled={isSubmitting}
                    aria-busy={isSubmitting && actionType === 'BLOCK'}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting && actionType === 'BLOCK' ? (
                      <LoadingSpinner size="xs" variant="primary" label="Marking Blocked..." />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    )}
                    <span>{isSubmitting && actionType === 'BLOCK' ? 'Marking Blocked...' : 'Mark Blocked'}</span>
                  </button>
                )}

                {/* Resume if Blocked */}
                {selectedTask.status === 'BLOCKED' && (
                  <button
                    onClick={() => handleUpdateTaskStatus(selectedTask.id, 'IN_PROGRESS', 'RESUME')}
                    disabled={isSubmitting}
                    aria-busy={isSubmitting && actionType === 'RESUME'}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting && actionType === 'RESUME' ? (
                      <LoadingSpinner size="xs" variant="white" label="Resuming..." />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                    <span>{isSubmitting && actionType === 'RESUME' ? 'Resuming...' : 'Resume Task'}</span>
                  </button>
                )}

                {/* Mark Completed */}
                {selectedTask.status !== 'COMPLETED' && selectedTask.status !== 'CANCELLED' && (
                  <button
                    onClick={() => handleUpdateTaskStatus(selectedTask.id, 'COMPLETED', 'COMPLETE')}
                    disabled={isSubmitting}
                    aria-busy={isSubmitting && actionType === 'COMPLETE'}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs inline-flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting && actionType === 'COMPLETE' ? (
                      <LoadingSpinner size="xs" variant="white" label="Completing..." />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    <span>{isSubmitting && actionType === 'COMPLETE' ? 'Completing...' : 'Mark Completed'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
