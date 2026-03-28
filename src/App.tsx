import { useState, useEffect } from 'react'
import Calendar from './components/Calendar'
import EmailList from './components/EmailList'
import TodoList from './components/TodoList'
import { Inbox, CalendarDays, Settings, Mail, RefreshCw, Server, CheckSquare, Edit2, Send, AlertOctagon, Trash2, Archive, Moon, Sun, FileText } from 'lucide-react'
function App() {
  const [activeTab, setActiveTab] = useState('settings')
  const [activeFolder, setActiveFolder] = useState('INBOX')
  const [authStatus, setAuthStatus] = useState<{message: string, isError: boolean} | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)

  // Credentials state
  const [imapHost, setImapHost] = useState('')
  const [imapPort, setImapPort] = useState('993')
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState('465')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [googleClientId, setGoogleClientId] = useState('')
  const [googleClientSecret, setGoogleClientSecret] = useState('')
  const [accountId, setAccountId] = useState<number | null>(null)

  useEffect(() => {
    let unmounted = false;
    const checkAccount = async () => {
       try {
         if (window.electronAPI && (window.electronAPI as any).getAccount) {
            const res = await (window.electronAPI as any).getAccount();
            if (res && res.success && res.data) {
               if(!unmounted) {
                  setImapHost(res.data.imap_host || '');
                  setImapPort(res.data.imap_port?.toString() || '993');
                  setSmtpHost(res.data.smtp_host || '');
                  setSmtpPort(res.data.smtp_port?.toString() || '465');
                  setEmail(res.data.email || '');
                  setPassword(res.data.password || '');
                  setGoogleClientId(res.data.google_client_id || '');
                  setGoogleClientSecret(res.data.google_client_secret || '');
                  setAccountId(res.data.id || null);
                  setActiveTab('email');
               }
            } else {
               if(!unmounted) setActiveTab('settings');
            }
         }
       } catch (e) {
         if(!unmounted) setActiveTab('settings');
       } finally {
         if(!unmounted) setIsInitializing(false);
       }
    };
    
    checkAccount();
    const fallback = setTimeout(() => { if(!unmounted) setIsInitializing(false); }, 2500);
    return () => { unmounted = true; clearTimeout(fallback); };
  }, []);

  useEffect(() => {
     if (isDark) document.documentElement.setAttribute('data-theme', 'dark');
     else document.documentElement.removeAttribute('data-theme');
  }, [isDark]);

  useEffect(() => {
     const interval = setInterval(async () => {
         if (window.electronAPI && (window.electronAPI as any).syncEmails) {
             try {
                const accountRes = await (window.electronAPI as any).getAccount();
                if (accountRes.data && accountRes.data.id) {
                    const res = await (window.electronAPI as any).syncEmails(accountRes.data.id, 'INBOX');
                    if (res && res.newCount > 0) {
                        (window.electronAPI as any).showNotification("Workspace Notificação", `Tem ${res.newCount} novas mensagens na Caixa de Entrada!`);
                        window.dispatchEvent(new Event('background-sync-done'));
                    }
                }
             } catch(e) {}
         }
     }, 2 * 60 * 1000); // 2 minutes
     return () => clearInterval(interval);
  }, []);

  const handleImapLogin = async () => {
    if (!imapHost || !imapPort || !email || !password) {
      setAuthStatus({ message: 'Preencha todos os campos obrigatórios (IMAP, Email, Senha).', isError: true })
      return
    }

    setAuthStatus({ message: 'A ligar aos servidores. Por favor aguarde...', isError: false })
    setIsLoading(true)

    try {
      if (window.electronAPI && (window.electronAPI as any).saveAccount) {
        const res = await (window.electronAPI as any).saveAccount({ email, password, imapHost, imapPort, smtpHost, smtpPort, calendarUrl: '' });
        if (res.success) {
          setAuthStatus({ message: '✅ Conta configurada com sucesso!', isError: false })
        } else {
          setAuthStatus({ message: '❌ Erro: ' + res.error, isError: true })
        }
      } else {
        setAuthStatus({ message: '⚠️ Modo Web Puro. Funcionalidade requer a App Desktop.', isError: true })
      }
    } catch (e: any) {
      setAuthStatus({ message: '❌ Erro Crítico: ' + e.message, isError: true })
    } finally {
      setIsLoading(false)
    }
  }

  if (isInitializing) {
     return <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
        <Mail size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
        <h2 style={{ fontSize: '1.2rem', fontWeight: 500 }}>A montar o seu Workspace...</h2>
     </div>
  }

  return (
    <>
      <aside className="sidebar">
        <h1 style={{ marginBottom: '1.5rem' }}>
          <div style={{ padding: '8px', backgroundColor: '#e24037', borderRadius: '10px', display: 'flex', color: 'white', boxShadow: '0 4px 10px rgba(226, 64, 55, 0.3)' }}>
            <Mail size={18} />
          </div>
          Workspace
        </h1>

        <button 
          onClick={() => { setActiveTab('email'); setTimeout(() => window.dispatchEvent(new Event('open-compose')), 50); }} 
          style={{ 
            marginBottom: '16px', marginLeft: '8px', backgroundColor: 'var(--accent-light)', color: '#001d35', 
            border: 'none', borderRadius: '16px', padding: '16px 24px',
            fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '16px',
            cursor: 'pointer', transition: 'all 0.2s', width: 'fit-content'
          }}
          onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--accent-light-hover)'}
          onMouseOut={e => e.currentTarget.style.backgroundColor = 'var(--accent-light)'}
        >
          <Edit2 size={20} />
          Compor
        </button>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div 
            className={`nav-item ${activeTab === 'email' && activeFolder === 'INBOX' ? 'active' : ''}`}
            onClick={() => { setActiveTab('email'); setActiveFolder('INBOX'); }}
          >
            <Inbox size={20} />
            Caixa de Entrada
          </div>
          <div 
            className={`nav-item ${activeTab === 'email' && activeFolder === '[Gmail]/Sent Mail' ? 'active' : ''}`}
            onClick={() => { setActiveTab('email'); setActiveFolder('[Gmail]/Sent Mail'); }}
            style={{ marginLeft: '16px', fontSize: '0.9rem', padding: '8px 16px' }}
          >
            <Send size={16} /> Enviados
          </div>
          <div 
            className={`nav-item ${activeTab === 'email' && activeFolder === '[Gmail]/Spam' ? 'active' : ''}`}
            onClick={() => { setActiveTab('email'); setActiveFolder('[Gmail]/Spam'); }}
            style={{ marginLeft: '16px', fontSize: '0.9rem', padding: '8px 16px' }}
          >
            <AlertOctagon size={16} /> Spam
          </div>
          <div 
            className={`nav-item ${activeTab === 'email' && activeFolder === '[Gmail]/Trash' ? 'active' : ''}`}
            onClick={() => { setActiveTab('email'); setActiveFolder('[Gmail]/Trash'); }}
            style={{ marginLeft: '16px', fontSize: '0.9rem', padding: '8px 16px' }}
          >
            <Trash2 size={16} /> Lixo
          </div>
          <div 
            className={`nav-item ${activeTab === 'email' && activeFolder === '[Gmail]/Drafts' ? 'active' : ''}`}
            onClick={() => { setActiveTab('email'); setActiveFolder('[Gmail]/Drafts'); }}
            style={{ marginLeft: '16px', fontSize: '0.9rem', padding: '8px 16px' }}
          >
            <FileText size={16} /> Rascunhos
          </div>
          <div 
            className={`nav-item ${activeTab === 'email' && activeFolder === 'Archive' ? 'active' : ''}`}
            onClick={() => { setActiveTab('email'); setActiveFolder('Archive'); }}
            style={{ marginLeft: '16px', fontSize: '0.9rem', padding: '8px 16px', marginBottom: '16px' }}
          >
            <Archive size={16} /> Arquivados
          </div>

          <div 
            className={`nav-item ${activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveTab('calendar')}
          >
            <CalendarDays size={20} />
            Agenda Profissional
          </div>
          <div 
            className={`nav-item ${activeTab === 'todos' ? 'active' : ''}`}
            onClick={() => setActiveTab('todos')}
          >
            <CheckSquare size={20} />
            Tarefas Pessoais
          </div>

          <div 
            className="nav-item"
            onClick={() => setIsDark(!isDark)}
            style={{ marginTop: 'auto', marginBottom: '8px' }}
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
            {isDark ? 'Tema Claro' : 'Tema Escuro'}
          </div>

          <div 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
            style={{ marginBottom: '16px' }}
          >
            <Settings size={20} />
            Definições
          </div>
        </nav>
      </aside>
      <main className="main-content">
        {activeTab !== 'email' && (
          <header className="header" style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {activeTab === 'calendar' && 'Calendário Mensal'}
              {activeTab === 'todos' && 'Gestor de Tarefas'}
              {activeTab === 'settings' && 'Definições do Sistema'}
            </h2>
          </header>
        )}
        <section className="content">
          {activeTab === 'email' && <EmailList currentFolder={activeFolder} />}
          {activeTab === 'calendar' && <Calendar />}
          {activeTab === 'todos' && <TodoList />}
          {activeTab === 'settings' && (
            <div style={{ height: '100%', overflowY: 'auto', paddingRight: '8px' }}>
              <div style={{ maxWidth: '850px', margin: '0 auto', paddingBottom: '60px', animation: 'fadeIn 0.4s ease-out' }}>
              <div style={{ marginBottom: '2.5rem' }}>
                <h3 style={{ color: 'var(--text-primary)', fontSize: '1.85rem', fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Server className="text-accent" size={28} color="var(--accent)" />
                  Configuração Manual
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginTop: '8px', lineHeight: 1.6 }}>Ligue qualquer conta IMAP/SMTP ou CalDAV (Sapo, Gmail, Domínio Próprio). Os dados são guardados e encriptados localmente no seu dispositivo.</p>
              </div>
              
              <div style={{ 
                padding: '2.5rem', backgroundColor: 'var(--bg-secondary)', 
                borderRadius: '24px', border: '1px solid var(--border)', 
                boxShadow: 'var(--shadow-lg)'
              }}>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                     <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.15rem', fontWeight: 600 }}>
                       Servidor de Entrada (IMAP)
                     </h4>
                     <input type="text" value={imapHost} onChange={(e) => setImapHost(e.target.value)} placeholder="Ex: imap.gmail.com" className="modern-input" />
                     <input type="number" value={imapPort} onChange={(e) => setImapPort(e.target.value)} placeholder="Porta (Ex: 993)" className="modern-input" />
                   </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                     <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.15rem', fontWeight: 600 }}>
                       Servidor de Saída (SMTP)
                     </h4>
                     <input type="text" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="Ex: smtp.gmail.com" className="modern-input" />
                     <input type="number" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="Porta (Ex: 465 ou 587)" className="modern-input" />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '2.5rem' }}>
                   <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.15rem', fontWeight: 600 }}>A sua Conta & Autenticação</h4>
                   <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="O seu E-mail" className="modern-input" />
                   <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Palavra-passe (ou App Password no caso da Google)" className="modern-input" />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '3rem' }}>
                   <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.15rem', fontWeight: 600 }}>Motor Bidirecional (Google Calendar OAuth 2.0)</h4>
                   <p style={{ margin: 0, fontSize: '0.90rem', color: 'var(--text-secondary)' }}>A ligação ao calendário requer Chaves OAuth para permissões de Escrita/Leitura sem atrasos. Crie o seu Client ID e Secret na Google Cloud Console.</p>
                   <input type="text" value={googleClientId} onChange={(e) => setGoogleClientId(e.target.value)} placeholder="Client ID da Google" className="modern-input" />
                   <input type="password" value={googleClientSecret} onChange={(e) => setGoogleClientSecret(e.target.value)} placeholder="Client Secret da Google" className="modern-input" />
                   
                   <button 
                      onClick={async () => {
                         if (window.electronAPI && (window.electronAPI as any).saveGoogleCredentials) {
                             await (window.electronAPI as any).saveGoogleCredentials(googleClientId, googleClientSecret);
                             await (window.electronAPI as any).startGoogleAuth();
                         }
                      }}
                      style={{ padding: '14px 28px', backgroundColor: '#4285F4', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, fontSize: '1.05rem', marginTop: '8px' }}
                   >
                     🚀 Autenticar & Ativar Google Calendar
                   </button>
                </div>
                
                <button 
                  onClick={handleImapLogin}
                  disabled={isLoading}
                  style={{ 
                    padding: '14px 28px', backgroundColor: isLoading ? 'var(--text-secondary)' : 'var(--accent)', color: 'white', 
                    border: 'none', borderRadius: '12px', cursor: isLoading ? 'not-allowed' : 'pointer', 
                    fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '12px',
                    fontSize: '1.1rem', transition: 'all 0.2s', boxShadow: 'var(--shadow-md)',
                    width: '100%', justifyContent: 'center'
                  }}
                  onMouseOver={e => {
                    if (!isLoading) {
                      e.currentTarget.style.backgroundColor = 'var(--accent-hover)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }
                  }}
                  onMouseOut={e => {
                    if (!isLoading) {
                      e.currentTarget.style.backgroundColor = 'var(--accent)';
                      e.currentTarget.style.transform = 'none';
                    }
                  }}
                >
                  <RefreshCw size={20} className={isLoading ? "spin" : ""} />
                  {isLoading ? 'A ligar aos servidores...' : 'Guardar & Testar Conexão'}
                </button>

                {/* Cache Reset Tool */}
                <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: 'rgba(239,68,68,0.05)', borderRadius: '16px', border: '1px dashed rgba(239,68,68,0.3)' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 600 }}>🔄 Diagnóstico & Reparação</h4>
                  <p style={{ margin: '0 0 16px 0', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Se os emails aparecem todos como "lidos" mesmo tendo não lidos no servidor, limpe a cache local. A app irá ressincronizar tudo com o estado correto do servidor IMAP.
                  </p>
                  <button
                    onClick={async () => {
                      if (!confirm('Limpar todos os emails em cache e ressincronizar? Os emails voltarão com o estado correto do servidor.')) return;
                      if (window.electronAPI && (window.electronAPI as any).clearEmailCache) {
                        const r = await (window.electronAPI as any).clearEmailCache();
                        if (r.success) {
                          setAuthStatus({ message: `✅ Cache limpa (${r.cleared} emails removidos). Vá à Caixa de Entrada e clique em Sincronizar.`, isError: false });
                        }
                      }
                    }}
                    style={{ padding: '10px 20px', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    🗑️ Limpar Cache de Emails & Ressincronizar
                  </button>
                  <button
                    onClick={async () => {
                      if (!accountId) { setAuthStatus({ message: 'Nenhuma conta configurada.', isError: true }); return; }
                      setAuthStatus({ message: 'A auditar servidor IMAP...', isError: false });
                      if (window.electronAPI && (window.electronAPI as any).auditUnread) {
                        const r = await (window.electronAPI as any).auditUnread(accountId);
                        if (r.success) {
                          setAuthStatus({ message: `📊 Diag: O servidor IMAP reporta exatamente ${r.count} email(s) não lido(s). ${r.count > 0 ? `Ex: ${r.subjects.slice(0,3).join(', ')}` : ''}`, isError: false });
                        } else {
                          setAuthStatus({ message: `Erro ao auditar IMAP: ${r.error}`, isError: true });
                        }
                      }
                    }}
                    style={{ marginLeft: '12px', padding: '10px 20px', backgroundColor: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    📡 Auditar Estado Real do Servidor
                  </button>
                </div>
                
                {authStatus && (
                  <div style={{ 
                    marginTop: '2rem', padding: '1.25rem', 
                    backgroundColor: authStatus.isError ? 'rgba(239, 68, 68, 0.1)' : 'var(--accent-light)', 
                    borderRadius: '12px', 
                    color: authStatus.isError ? '#ef4444' : 'var(--accent)', 
                    border: `1px solid ${authStatus.isError ? 'rgba(239, 68, 68, 0.3)' : 'var(--accent)'}`, 
                    fontWeight: 500, display: 'flex', alignItems: 'flex-start', gap: '12px',
                    animation: 'fadeIn 0.3s ease-out'
                  }}>
                    <span style={{flex: 1}}>{authStatus.message}</span>
                  </div>
                )}
              </div>
              </div>
            </div>
          )}
        </section>
      </main>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </>
  )
}

export default App
