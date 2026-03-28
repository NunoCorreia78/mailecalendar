interface ElectronAPI {
  loginWithGoogle: () => Promise<{ success: boolean; code?: string; error?: string }>;
  testAndSaveManualEmail: (credentials: any) => Promise<{ success: boolean; message?: string; error?: string }>;
  syncEmails: (accountId: number, folder?: string) => Promise<{ success: boolean; error?: string }>;
  getLocalEmails: (folder?: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  getAccount: () => Promise<{ success: boolean; data?: any; error?: string }>;
  toggleFlag: (emailId: string, field: string, status: boolean) => Promise<{ success: boolean; error?: string }>;
  getCalendarEvents: () => Promise<{ success: boolean; data?: any[]; error?: string }>;
  sendEmail: (accountId: number, mailOptions: any) => Promise<{ success: boolean; messageId?: string; error?: string }>;
  executeAction: (emailIds: string[], action: string) => Promise<{ success: boolean; error?: string }>;
  getTodos: () => Promise<{ success: boolean; data?: any[]; error?: string }>;
  addTodo: (task: string) => Promise<{ success: boolean; error?: string }>;
  toggleTodo: (id: number, isCompleted: boolean) => Promise<{ success: boolean; error?: string }>;
  deleteTodo: (id: number) => Promise<{ success: boolean; error?: string }>;
  showNotification: (title: string, body: string) => Promise<{ success: boolean }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
