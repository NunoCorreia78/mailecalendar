const { contextBridge, ipcRenderer } = require('electron');

// Expor rotinas seguras para o front-end (React)
contextBridge.exposeInMainWorld('electronAPI', {
  loginWithGoogle: () => ipcRenderer.invoke('auth:google'),
  testAndSaveManualEmail: (credentials) => ipcRenderer.invoke('auth:manual', credentials),
  syncEmails: (accountId, folder) => ipcRenderer.invoke('sync-emails', accountId, folder),
  getLocalEmails: (folder) => ipcRenderer.invoke('get-local-emails', folder),
  getAccount: () => ipcRenderer.invoke('get-account'),
  toggleFlag: (emailId, field, status) => ipcRenderer.invoke('toggle-flag', emailId, field, status),
  getCalendarEvents: () => ipcRenderer.invoke('get-calendar-events'),
  addLocalEvent: (title, start, end) => ipcRenderer.invoke('add-local-event', title, start, end),
  updateLocalEvent: (id, start, end) => ipcRenderer.invoke('update-local-event', id, start, end),
  sendEmail: (accountId, mailOptions) => ipcRenderer.invoke('send-email', accountId, mailOptions),
  executeAction: (emailIds, action) => ipcRenderer.invoke('execute-action', emailIds, action),
  getTodos: () => ipcRenderer.invoke('get-todos'),
  addTodo: (task) => ipcRenderer.invoke('add-todo', task),
  toggleTodo: (id, isCompleted) => ipcRenderer.invoke('toggle-todo', id, isCompleted),
  deleteTodo: (id) => ipcRenderer.invoke('delete-todo', id),
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', title, body),
  searchContacts: (query) => ipcRenderer.invoke('search-contacts', query),
  syncCalendarContent: () => ipcRenderer.invoke('sync-calendar-content'),
  saveGoogleCredentials: (id, secret) => ipcRenderer.invoke('save-google-credentials', id, secret),
  startGoogleAuth: () => ipcRenderer.invoke('start-google-auth'),
  clearEmailCache: () => ipcRenderer.invoke('clear-email-cache'),
  auditUnread: (accountId) => ipcRenderer.invoke('audit-unread', accountId),
  saveAccount: (data) => ipcRenderer.invoke('save-account', data),
});
