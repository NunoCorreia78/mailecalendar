import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Star, RefreshCw, Mail, CheckSquare, Square, Pin, Trash2, Archive, AlertOctagon, ChevronLeft, X, Reply, Forward, AlignLeft, AlignCenter, AlignRight, Link2, Type, FileText } from 'lucide-react';

export default function EmailList({ currentFolder }: { currentFolder: string }) {
  const [emails, setEmails] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  
  const [activeEmail, setActiveEmail] = useState<any | null>(null);

  // States for new features
  const [filterType, setFilterType] = useState('all'); // 'all' | 'unread' | 'starred' | 'pinned'
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, emailId: string } | null>(null);
  const [visibleCount, setVisibleCount] = useState(100);

  // Global click to close context menu
  useEffect(() => {
    const closeContext = () => setContextMenu(null);
    window.addEventListener('click', closeContext);
    return () => window.removeEventListener('click', closeContext);
  }, []);

  // Compose State
  const [isComposing, setIsComposing] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sending, setSending] = useState(false);

  // References
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const loadLocalEmails = async (folder = currentFolder) => {
    try {
      if (window.electronAPI && (window.electronAPI as any).getLocalEmails) {
        const res = await (window.electronAPI as any).getLocalEmails(folder);
        if (res.success && res.data) setEmails(res.data);
      }
    } catch(e) {}
  };

  const handleSync = async (folder = currentFolder) => {
    setSyncing(true);
    setError(null);
    try {
      if (window.electronAPI && (window.electronAPI as any).getAccount) {
        const accRes = await (window.electronAPI as any).getAccount();
        if (accRes.success && accRes.data) {
          const syncRes = await (window.electronAPI as any).syncEmails(accRes.data.id, folder);
          if (syncRes.success) await loadLocalEmails(folder);
          else setError(syncRes.error);
        } else setError('Nenhuma conta configurada. Guarde os dados na aba lateral primeiro.');
      }
    } catch(e: any) { setError(e.message); } 
    finally { setSyncing(false); }
  };

  useEffect(() => {
    loadLocalEmails(currentFolder);
    setVisibleCount(100);
    const handler = () => loadLocalEmails(currentFolder);
    window.addEventListener('background-sync-done', handler);

    // Sync in background — don't block UI
    handleSync(currentFolder);
    setSelectedIds(new Set());
    setActiveEmail(null);

    const handleOpenCompose = () => {
       setComposeTo(''); setComposeSubject(''); setComposeBody('');
       setIsComposing(true);
    };
    window.addEventListener('open-compose', handleOpenCompose);
    return () => {
      window.removeEventListener('background-sync-done', handler);
      window.removeEventListener('open-compose', handleOpenCompose);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolder]);

  const filteredEmails = useMemo(() => {
    let result = emails;
    if (filterType === 'unread') result = result.filter(e => !e.is_read || e.is_read === 0 || e.is_read === false || e.is_read === null);
    else if (filterType === 'starred') result = result.filter(e => e.is_important === 1 || e.is_important === true);
    else if (filterType === 'pinned') result = result.filter(e => e.is_pinned === 1 || e.is_pinned === true);

    if (!searchQuery) return result;
    const lowerQ = searchQuery.toLowerCase();
    return result.filter(e => e.subject?.toLowerCase().includes(lowerQ) || e.sender?.toLowerCase().includes(lowerQ) || e.snippet?.toLowerCase().includes(lowerQ));
  }, [emails, searchQuery, filterType]);

  const folderLabel = currentFolder === 'INBOX' ? 'Caixa de Entrada'
    : currentFolder === '[Gmail]/Sent Mail' ? 'Enviados'
    : currentFolder === '[Gmail]/Drafts' ? 'Rascunhos'
    : currentFolder === '[Gmail]/Spam' ? 'Spam'
    : currentFolder === '[Gmail]/Trash' ? 'Lixo'
    : currentFolder === 'Archive' ? 'Arquivo' : currentFolder;

  const unreadCount = emails.filter(e => !e.is_read || e.is_read === 0 || e.is_read === false || e.is_read === null).length;

  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEmails.length && filteredEmails.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredEmails.map(e => e.id)));
  };

  const executeFlag = async (id: string, field: string, currentValue: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      if (window.electronAPI && (window.electronAPI as any).toggleFlag) {
         const res = await (window.electronAPI as any).toggleFlag(id, field, !currentValue);
         if (res.success) {
            setEmails(prev => prev.map(m => m.id === id ? { ...m, [field]: !currentValue ? 1 : 0 } : m));
            if (activeEmail && activeEmail.id === id) setActiveEmail({...activeEmail, [field]: !currentValue ? 1 : 0});
         }
      }
    } catch(err) {}
  };

  const executeLocalMove = async (ids: string[], targetFolder: string) => {
     if (ids.length === 0) return;
     try {
       if (window.electronAPI && (window.electronAPI as any).executeAction) {
          await (window.electronAPI as any).executeAction(ids, targetFolder);
          setSelectedIds(new Set());
          loadLocalEmails(currentFolder);
          if (activeEmail && ids.includes(activeEmail.id)) setActiveEmail(null);
       }
     } catch(e) {}
  };

  const handleSend = async () => {
    if (!composeTo || !composeBody) { alert('Preencha os campos obrigatórios.'); return; }
    setSending(true);
    try {
       if (window.electronAPI && (window.electronAPI as any).getAccount) {
         const accRes = await (window.electronAPI as any).getAccount();
         if (accRes.success && accRes.data) {
            const res = await (window.electronAPI as any).sendEmail(accRes.data.id, {
                to: composeTo,
                subject: composeSubject,
                html: composeBody.replace(/\n/g, '<br>')
            });
            if (res.success) {
               if (window.electronAPI.showNotification) {
                 window.electronAPI.showNotification('Sucesso', 'E-mail enviado à velocidade da luz.');
               }
               setIsComposing(false);
               setComposeTo(''); setComposeSubject(''); setComposeBody('');
            } else alert(res.error);
         }
       }
    } catch(err: any) { alert(err.message); }
    setSending(false);
  };

  const handleSaveDraft = () => {
     if (window.electronAPI && (window.electronAPI as any).showNotification) {
         (window.electronAPI as any).showNotification('Rascunho Gravado', 'O seu e-mail foi guardado com sucesso.');
     }
     setIsComposing(false);
     setComposeTo(''); setComposeSubject(''); setComposeBody('');
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    let n = name;
    if (n.includes('<')) n = n.split('<')[0].trim();
    if (n.includes('@') && !n.includes(' ')) n = n.split('@')[0];
    const parts = n.split(' ').filter(p => p.length > 0);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return '?';
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
  };

  const openReply = (mail: any) => {
     let to = mail.sender;
     if (to.includes('<')) to = to.split('<')[1].split('>')[0];
     setComposeTo(to);
     setComposeSubject(`Re: ${mail.subject}`);
     setComposeBody(`\n\n\n--- Em ${formatTime(mail.timestamp)}, ${mail.sender} escreveu:\n\n${mail.snippet}`);
     setIsComposing(true);
  };

  const openForward = (mail: any) => {
     setComposeTo('');
     setComposeSubject(`Fwd: ${mail.subject}`);
     setComposeBody(`\n\n\n--- Mensagem Reencaminhada ---\nDe: ${mail.sender}\nData: ${formatTime(mail.timestamp)}\nAssunto: ${mail.subject}\n\n${mail.snippet}`);
     setIsComposing(true);
  };

  const iframeContent = (html: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { color-scheme: light dark; }
        body { font-family: 'Inter', -apple-system, sans-serif; padding: 16px 32px; margin: 0; background-color: white; color: #222; }
        img { max-width: 100%; height: auto; }
        a { color: #4f46e5; text-decoration: none; }
      </style>
    </head>
    <body>${html}</body>
    </html>
  `;

  if (activeEmail) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', animation: 'fadeIn 0.3s ease-out', position: 'relative' }}
        onContextMenu={(e) => {
          // Only show context menu if not right-clicking on a link or interactive element
          const target = e.target as HTMLElement;
          if (!target.closest('button') && !target.closest('a') && !target.closest('iframe')) {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, emailId: activeEmail.id });
          }
        }}
      >
         <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', padding: '24px 32px', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', border: '1px solid var(--border)' }}>
             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', marginBottom: '24px', borderBottom: '1px solid var(--bg-tertiary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                  <button onClick={() => setActiveEmail(null)} className="action-btn" style={{ padding: '8px', borderRadius: '50%', backgroundColor: 'var(--bg-secondary)' }}><ChevronLeft size={24} /></button>
                </div>
                {/* Context Actions */}
                <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-tertiary)', padding: '6px', borderRadius: '30px' }}>
                   <button title="Fixar" className="action-btn" onClick={() => executeFlag(activeEmail.id, 'is_pinned', activeEmail.is_pinned === 1)}><Pin size={18} fill={activeEmail.is_pinned ? 'currentColor' : 'none'} /></button>
                   <button title="Marcar com estrela" className="action-btn" onClick={() => executeFlag(activeEmail.id, 'is_important', activeEmail.is_important === 1)} style={{ color: activeEmail.is_important ? '#fbbc04' : undefined }}><Star size={18} fill={activeEmail.is_important ? '#fbbc04' : 'none'} /></button>
                   <div style={{ width: '1px', backgroundColor: 'var(--border)', margin: '4px 2px' }} />
                   <button title="Arquivar" className="action-btn" onClick={() => executeLocalMove([activeEmail.id], 'Archive')}><Archive size={18} /></button>
                   <button title="Marcar como Spam" className="action-btn" onClick={() => executeLocalMove([activeEmail.id], 'Spam')}><AlertOctagon size={18} /></button>
                   <button title="Eliminar" className="action-btn" onClick={() => executeLocalMove([activeEmail.id], 'Trash')}><Trash2 size={18} /></button>
                </div>
             </div>
         
         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', paddingLeft: '24px' }}>
             <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 400, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                 {activeEmail.subject}
                 <span style={{ display: 'flex', gap: '4px', opacity: 0.6 }}>
                     <Pin onClick={() => executeFlag(activeEmail.id, 'is_pinned', activeEmail.is_pinned === 1)} size={22} fill={activeEmail.is_pinned ? 'var(--text-primary)' : 'transparent'} style={{ cursor: 'pointer', color: 'var(--text-primary)' }} />
                     <Star onClick={() => executeFlag(activeEmail.id, 'is_important', activeEmail.is_important === 1)} size={22} fill={activeEmail.is_important ? '#fbbc04' : 'transparent'} style={{ cursor: 'pointer', color: activeEmail.is_important ? '#fbbc04' : 'var(--text-primary)' }} />
                 </span>
             </h2>
         </div>

         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingLeft: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: '500' }}>{getInitials(activeEmail.sender)}</div>
                <div>
                   <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {activeEmail.sender} 
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 400 }}>{formatTime(activeEmail.timestamp)}</span>
                   </div>
                   <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>para mim <span style={{fontSize:'0.6rem'}}>▼</span></div>
                </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', paddingRight: '24px' }}>
                <button className="pill-btn" title="Responder" onClick={() => openReply(activeEmail)}><Reply size={16} style={{marginRight: '8px'}} /> Responder</button>
                <button className="pill-btn" title="Reencaminhar" onClick={() => openForward(activeEmail)}><Forward size={16} style={{marginRight: '8px'}} /> Reencaminhar</button>
            </div>
         </div>

         <div style={{ flex: 1, backgroundColor: 'white', overflow: 'hidden', display: 'flex', borderRadius: '12px', border: '1px solid var(--border)' }}>
             <iframe 
                ref={iframeRef}
                title="Conteudo de Email"
                sandbox="allow-same-origin allow-popups allow-scripts"
                srcDoc={iframeContent(activeEmail.html_body || activeEmail.snippet)}
                style={{ width: '100%', height: '100%', border: 'none', flex: 1, backgroundColor: 'white' }}
             />
         </div>
         </div>

         {isComposing && <Composer closeModal={() => setIsComposing(false)} to={composeTo} setTo={setComposeTo} subject={composeSubject} setSubject={setComposeSubject} body={composeBody} setBody={setComposeBody} send={handleSend} sending={sending} onSaveDraft={handleSaveDraft} />}

         {/* Context menu on reading view */}
         {contextMenu && contextMenu.emailId === activeEmail.id && (
           <div style={{ position: 'fixed', top: `${Math.min(contextMenu.y, window.innerHeight - 250)}px`, left: `${Math.min(contextMenu.x, window.innerWidth - 200)}px`, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 1000, minWidth: '200px', padding: '8px 0', animation: 'fadeIn 0.15s ease-out' }} onClick={(e) => e.stopPropagation()}>
             <div className="ctx-item" onClick={() => { executeFlag(activeEmail.id, 'is_read', activeEmail.is_read === 1); setContextMenu(null); }}>
               <Mail size={14} style={{ marginRight: '8px' }} /> {activeEmail.is_read ? 'Marcar como Não Lida' : 'Marcar como Lida'}
             </div>
             <div className="ctx-item" onClick={() => { executeFlag(activeEmail.id, 'is_important', activeEmail.is_important === 1); setContextMenu(null); }}>
               <Star size={14} style={{ marginRight: '8px' }} /> {activeEmail.is_important ? 'Remover Estrela' : 'Adicionar Estrela'}
             </div>
             <div className="ctx-item" onClick={() => { executeFlag(activeEmail.id, 'is_pinned', activeEmail.is_pinned === 1); setContextMenu(null); }}>
               <Pin size={14} style={{ marginRight: '8px' }} /> {activeEmail.is_pinned ? 'Desafixar' : 'Fixar'}
             </div>
             <div className="ctx-item" onClick={() => { openReply(activeEmail); setContextMenu(null); }}>
               <Reply size={14} style={{ marginRight: '8px' }} /> Responder
             </div>
             <div className="ctx-item" onClick={() => { openForward(activeEmail); setContextMenu(null); }}>
               <Forward size={14} style={{ marginRight: '8px' }} /> Reencaminhar
             </div>
             <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '4px 0' }} />
             <div className="ctx-item" onClick={() => { executeLocalMove([activeEmail.id], 'Archive'); setContextMenu(null); }}>
               <Archive size={14} style={{ marginRight: '8px' }} /> Arquivar
             </div>
             <div className="ctx-item ctx-item-danger" onClick={() => { executeLocalMove([activeEmail.id], 'Trash'); setContextMenu(null); }}>
               <Trash2 size={14} style={{ marginRight: '8px' }} /> Eliminar
             </div>
           </div>
         )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', animation: 'fadeIn 0.4s ease-out', position: 'relative' }}>

      {/* ── Row 1: Title + bulk actions + sync ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{folderLabel}</h2>
          {unreadCount > 0 && (
            <span style={{ fontSize: '0.75rem', fontWeight: 700, backgroundColor: 'var(--accent)', color: 'white', borderRadius: '20px', padding: '2px 9px', letterSpacing: '0.02em' }}>{unreadCount}</span>
          )}
          {/* Bulk action buttons (slide in when selection active) */}
          <div style={{ display: 'flex', gap: '2px', opacity: selectedIds.size > 0 ? 1 : 0, transform: selectedIds.size > 0 ? 'translateX(0)' : 'translateX(-8px)', pointerEvents: selectedIds.size > 0 ? 'auto' : 'none', transition: 'all 0.2s ease', backgroundColor: 'var(--bg-tertiary)', padding: '3px', borderRadius: '24px' }}>
            <button title="Arquivar" className="action-btn" onClick={() => executeLocalMove(Array.from(selectedIds), 'Archive')}><Archive size={16} /></button>
            <button title="Spam" className="action-btn" onClick={() => executeLocalMove(Array.from(selectedIds), 'Spam')}><AlertOctagon size={16} /></button>
            <button title="Eliminar" className="action-btn" onClick={() => executeLocalMove(Array.from(selectedIds), 'Trash')}><Trash2 size={16} /></button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {filteredEmails.length > 0 && (
            <div onClick={toggleSelectAll} style={{ color: selectedIds.size === filteredEmails.length ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', padding: '6px', borderRadius: '6px', transition: 'all 0.15s' }} title="Selecionar todos">
              {selectedIds.size === filteredEmails.length ? <CheckSquare size={17} /> : <Square size={17} />}
            </div>
          )}
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500, paddingRight: '4px' }}>{filteredEmails.length} {filteredEmails.length === 1 ? 'mensagem' : 'mensagens'}</span>
          <button className="action-btn" title="Sincronizar" onClick={() => handleSync(currentFolder)} disabled={syncing} style={{ borderRadius: '10px' }}>
            <RefreshCw size={17} className={syncing ? 'spin' : ''} color={syncing ? 'var(--accent)' : 'var(--text-secondary)'} />
          </button>
        </div>
      </div>

      {/* ── Row 2: Filters + Search ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
        {/* Filter chips */}
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          {(['all', 'unread', 'starred', 'pinned'] as const).map(f => {
            const active = filterType === f;
            return (
              <button key={f} onClick={() => setFilterType(f)} style={{
                padding: '6px 14px', borderRadius: '20px', border: active ? 'none' : '1px solid var(--border)',
                cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.18s',
                backgroundColor: active ? 'var(--accent)' : 'transparent',
                color: active ? 'white' : 'var(--text-secondary)',
                boxShadow: active ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
              }}>
                {f === 'all' ? 'Todos' : f === 'unread' ? `Não lidos${unreadCount > 0 ? ` (${unreadCount})` : ''}` : f === 'starred' ? '⭐ Estrela' : '📌 Fixados'}
              </button>
            );
          })}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Search */}
        <div style={{ position: 'relative', width: '260px' }}>
          <Search size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Pesquisar mensagens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: '9px 16px 9px 38px', width: '100%', backgroundColor: 'var(--bg-tertiary)', border: '1px solid transparent', borderRadius: '24px', fontSize: '0.88rem', outline: 'none', color: 'var(--text-primary)', transition: 'all 0.2s', boxSizing: 'border-box' }}
            onFocus={e => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.border = '1px solid var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(66,133,244,0.15)'; }}
            onBlur={e => { e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; e.currentTarget.style.border = '1px solid transparent'; e.currentTarget.style.boxShadow = 'none'; }}
          />
        </div>
      </div>

      {error && <div style={{ padding: '12px', backgroundColor: '#fcf1f1', color: '#c53030', borderRadius: '12px', fontSize: '0.90rem' }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
        {filteredEmails.slice(0, visibleCount).map(mail => {
          let cleanName = mail.sender;
          const match = /^"?(.*?)"?\s*</.exec(mail.sender);
          if (match && match[1]) cleanName = match[1].trim();
          else if (mail.sender.includes('<')) cleanName = mail.sender.split('<')[0].trim();
          cleanName = cleanName.replace(/(^"|"$)/g, '');
          if (!cleanName || cleanName === '') cleanName = mail.sender;
          
          return (
            <div key={mail.id} onClick={() => { if (!mail.is_read) executeFlag(mail.id, 'is_read', false); setActiveEmail(mail); }}
               onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, emailId: mail.id }); }}
               style={{ minHeight: '56px', backgroundColor: mail.is_read ? 'transparent' : 'white', borderBottom: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'box-shadow 0.1s, background-color 0.1s', position: 'relative', color: mail.is_read ? 'var(--text-secondary)' : 'var(--text-primary)', padding: '6px 0' }}
               onMouseOver={e=>{ e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; e.currentTarget.style.boxShadow = 'inset 1px 0 0 var(--border), inset -1px 0 0 var(--border), 0 1px 2px 0 rgba(60,64,67,0.3)'; e.currentTarget.style.zIndex = '1'; }}
               onMouseOut={e=>{ e.currentTarget.style.backgroundColor = mail.is_read ? 'transparent' : 'white'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.zIndex = '0'; }}
            >
               <div onClick={(e) => toggleSelection(mail.id, e)} style={{ color: selectedIds.has(mail.id) ? 'var(--text-primary)' : 'var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 12px 0 16px' }}>
                  {selectedIds.has(mail.id) ? <CheckSquare size={18} /> : <Square size={18} />}
               </div>
               
               <div style={{ display: 'flex', alignItems: 'center', paddingRight: '12px' }}>
                  <Star onClick={(e) => executeFlag(mail.id, 'is_important', mail.is_important === 1, e)} size={18} fill={mail.is_important ? '#fbbc04' : 'transparent'} style={{ color: mail.is_important ? '#fbbc04' : 'var(--border)' }} />
               </div>
               
               <div style={{ width: '168px', flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.9rem', paddingRight: '16px', fontWeight: mail.is_read ? 400 : 700 }}>
                   {cleanName}
               </div>
               
               <div style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.9rem', display: 'flex', alignItems: 'center' }}>
                   <span style={{ fontWeight: mail.is_read ? 400 : 700, marginRight: '6px' }}>{mail.subject || '(Sem assunto)'}</span>
                   <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>- {mail.snippet}</span>
               </div>
               
               <div style={{ width: '80px', flexShrink: 0, textAlign: 'right', fontSize: '0.85rem', paddingRight: '16px', fontWeight: mail.is_read ? 400 : 700 }}>
                   {formatTime(mail.timestamp)}
               </div>
            </div>
          );
        })}
        {visibleCount < filteredEmails.length && (
          <div style={{ textAlign: 'center', padding: '16px' }}>
            <button onClick={() => setVisibleCount(v => v + 100)} style={{ padding: '8px 24px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '20px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Mostrar mais ({filteredEmails.length - visibleCount} restantes)
            </button>
          </div>
        )}
        {filteredEmails.length === 0 && !syncing && (
           <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '50px' }}>
              <Mail size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
              <p style={{ fontSize: '1.2rem', fontWeight: 500 }}>Perfeito. Não tens e-mails por ler nesta caixa!</p>
           </div>
        )}
      </div>

      {isComposing && <Composer closeModal={() => setIsComposing(false)} to={composeTo} setTo={setComposeTo} subject={composeSubject} setSubject={setComposeSubject} body={composeBody} setBody={setComposeBody} send={handleSend} sending={sending} onSaveDraft={handleSaveDraft} />}

      {/* Context Menu (list view) */}
      {contextMenu && (
        <div style={{ position: 'fixed', top: `${Math.min(contextMenu.y, window.innerHeight - 280)}px`, left: `${Math.min(contextMenu.x, window.innerWidth - 200)}px`, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 1000, minWidth: '200px', padding: '8px 0', animation: 'fadeIn 0.15s ease-out' }} onClick={(e) => e.stopPropagation()}>
          {(() => { const em = emails.find(e => e.id === contextMenu.emailId); if (!em) return null; return (<>
            <div className="ctx-item" onClick={() => { executeFlag(em.id, 'is_read', em.is_read === 1); setContextMenu(null); }}>
              <Mail size={14} style={{ marginRight: '8px' }} /> {em.is_read ? 'Marcar como Não Lida' : 'Marcar como Lida'}
            </div>
            <div className="ctx-item" onClick={() => { executeFlag(em.id, 'is_important', em.is_important === 1); setContextMenu(null); }}>
              <Star size={14} style={{ marginRight: '8px' }} /> {em.is_important ? 'Remover Estrela' : 'Adicionar Estrela'}
            </div>
            <div className="ctx-item" onClick={() => { executeFlag(em.id, 'is_pinned', em.is_pinned === 1); setContextMenu(null); }}>
              <Pin size={14} style={{ marginRight: '8px' }} /> {em.is_pinned ? 'Desafixar' : 'Fixar'}
            </div>
            <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '4px 0' }} />
            <div className="ctx-item" onClick={() => { executeLocalMove([contextMenu.emailId], 'Archive'); setContextMenu(null); }}>
              <Archive size={14} style={{ marginRight: '8px' }} /> Arquivar
            </div>
            <div className="ctx-item" onClick={() => { executeLocalMove([contextMenu.emailId], 'Spam'); setContextMenu(null); }}>
              <AlertOctagon size={14} style={{ marginRight: '8px' }} /> Marcar como Spam
            </div>
            <div className="ctx-item ctx-item-danger" onClick={() => { executeLocalMove([contextMenu.emailId], 'Trash'); setContextMenu(null); }}>
              <Trash2 size={14} style={{ marginRight: '8px' }} /> Eliminar
            </div>
          </>); })()}
        </div>
      )}

      <style>{`
        .action-btn { background: transparent; border: none; padding: 10px; border-radius: 50%; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; }
        .action-btn:hover { background-color: var(--border); color: var(--text-primary); }
        .pill-btn { background: transparent; border: 1px solid var(--border); border-radius: 20px; padding: 8px 20px; font-size: 0.9rem; font-weight: 600; color: var(--text-secondary); cursor: pointer; transition: all 0.15s ease; display: flex; align-items: center; }
        .pill-btn:hover { background-color: var(--bg-tertiary); color: var(--text-primary); }
        .ctx-item { padding: 9px 16px; font-size: 0.9rem; color: var(--text-primary); cursor: pointer; display: flex; align-items: center; transition: background-color 0.1s; }
        .ctx-item:hover { background-color: var(--accent); color: white; }
        .ctx-item-danger:hover { background-color: #ea4335 !important; color: white !important; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

function Composer({ closeModal, to, setTo, subject, setSubject, body, setBody, send, sending, onSaveDraft }: any) {
   const [suggestions, setSuggestions] = useState<any[]>([]);
   const handleTo = async (v: string) => {
      setTo(v);
      if (v.length > 1 && window.electronAPI && (window.electronAPI as any).searchContacts) {
          try {
             const res = await (window.electronAPI as any).searchContacts(v);
             if (res && res.data) setSuggestions(res.data);
          } catch(e) {}
      } else { setSuggestions([]); }
   };

   return (
      <div style={{
         position: 'absolute', bottom: '0', right: '40px', width: '560px', backgroundColor: 'var(--bg-secondary)',
         boxShadow: '0 8px 32px rgba(0,0,0,0.15)', borderRadius: '16px 16px 0 0', display: 'flex', flexDirection: 'column',
         border: '1px solid var(--border)', zIndex: 100, overflow: 'hidden'
      }}>
         <div style={{ backgroundColor: '#f2f6fc', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>Nova Mensagem</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
               <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', borderRadius: '4px' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='#e2e8f0'} onMouseOut={e=>e.currentTarget.style.backgroundColor='transparent'}><X size={18} /></button>
            </div>
         </div>
         <div style={{ padding: '0 16px', display: 'flex', borderBottom: '1px solid var(--border)', alignItems: 'center', position: 'relative' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', width: 'auto', marginRight: '16px' }}>Para</span>
            <input type="email" value={to} onChange={(e: any)=>handleTo(e.target.value)} style={{ flex: 1, border: 'none', padding: '12px 0', outline: 'none', fontSize: '0.95rem', backgroundColor: 'transparent', color: 'var(--text-primary)' }} />
            {suggestions.length > 0 && (
               <div style={{ position: 'absolute', top: '100%', left: '50px', right: '16px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: 'var(--shadow-md)', zIndex: 10, maxHeight: '200px', overflowY: 'auto' }}>
                  {suggestions.map((s: any, i: number) => (
                      <div key={i} onClick={() => { setTo(s.email); setSuggestions([]); }} style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border)' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='var(--bg-tertiary)'} onMouseOut={e=>e.currentTarget.style.backgroundColor='transparent'}>
                         <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{s.name}</div>
                         <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.email}</div>
                      </div>
                  ))}
               </div>
            )}
         </div>
         <div style={{ padding: '0 16px', display: 'flex', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
            <input type="text" placeholder="Assunto" value={subject} onChange={(e: any)=>setSubject(e.target.value)} style={{ flex: 1, border: 'none', padding: '12px 0', outline: 'none', fontSize: '0.95rem', backgroundColor: 'transparent', color: 'var(--text-primary)' }} />
         </div>
         <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: '8px', padding: '8px 16px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-tertiary)', flexWrap: 'wrap' }}>
               <button onClick={(e) => { e.preventDefault(); document.execCommand('bold', false); }} style={{ fontWeight: 800, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', color: 'var(--text-secondary)' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='var(--border)'} onMouseOut={e=>e.currentTarget.style.backgroundColor='transparent'}>B</button>
               <button onClick={(e) => { e.preventDefault(); document.execCommand('italic', false); }} style={{ fontStyle: 'italic', fontFamily: 'serif', padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px', color: 'var(--text-secondary)' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='var(--border)'} onMouseOut={e=>e.currentTarget.style.backgroundColor='transparent'}>I</button>
               <button onClick={(e) => { e.preventDefault(); document.execCommand('underline', false); }} style={{ textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', color: 'var(--text-secondary)' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='var(--border)'} onMouseOut={e=>e.currentTarget.style.backgroundColor='transparent'}>U</button>
               <div style={{ width: '1px', backgroundColor: 'var(--border)', margin: '0 4px' }}></div>
               
               <button onClick={(e) => { e.preventDefault(); document.execCommand('fontSize', false, '5'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', color: 'var(--text-secondary)' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='var(--border)'} onMouseOut={e=>e.currentTarget.style.backgroundColor='transparent'} title="Cabeçalho"><Type size={16} /></button>
               <input type="color" title="Cor" onChange={(e) => { document.execCommand('foreColor', false, e.target.value); }} style={{ padding: '0', cursor: 'pointer', borderRadius: '4px', border: 'none', background: 'transparent', width: '24px', height: '24px', alignSelf: 'center' }} />
               <button onClick={(e) => { e.preventDefault(); const url = prompt('URL:'); if (url) document.execCommand('createLink', false, url); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', color: 'var(--text-secondary)' }} title="Inserir Link"><Link2 size={16} /></button>
               <div style={{ width: '1px', backgroundColor: 'var(--border)', margin: '0 4px' }}></div>

               <button onClick={(e) => { e.preventDefault(); document.execCommand('justifyLeft', false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', color: 'var(--text-secondary)' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='var(--border)'} onMouseOut={e=>e.currentTarget.style.backgroundColor='transparent'}><AlignLeft size={16} /></button>
               <button onClick={(e) => { e.preventDefault(); document.execCommand('justifyCenter', false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', color: 'var(--text-secondary)' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='var(--border)'} onMouseOut={e=>e.currentTarget.style.backgroundColor='transparent'}><AlignCenter size={16} /></button>
               <button onClick={(e) => { e.preventDefault(); document.execCommand('justifyRight', false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', color: 'var(--text-secondary)' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='var(--border)'} onMouseOut={e=>e.currentTarget.style.backgroundColor='transparent'}><AlignRight size={16} /></button>
               <div style={{ width: '1px', backgroundColor: 'var(--border)', margin: '0 4px' }}></div>

               <button onClick={(e) => { e.preventDefault(); document.execCommand('insertUnorderedList', false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', color: 'var(--text-secondary)' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='var(--border)'} onMouseOut={e=>e.currentTarget.style.backgroundColor='transparent'}>• Lista</button>
            </div>
            <div 
               contentEditable
               spellCheck={true}
               lang="pt-PT"
               suppressContentEditableWarning
               style={{ flex: 1, minHeight: '300px', padding: '16px', border: 'none', outline: 'none', fontSize: '1rem', color: 'var(--text-primary)', overflowY: 'auto', lineHeight: 1.6 }}
               onBlur={e => setBody(e.currentTarget.innerHTML)}
               onInput={e => setBody(e.currentTarget.innerHTML)}
               ref={node => { if (node && node.innerHTML === '' && body) { node.innerHTML = body; } }}
            />
         </div>
         <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
               <button onClick={onSaveDraft} style={{
                  padding: '10px 24px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '24px',
                  cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem'
               }} title="Guardar Rascunho">
                  <FileText size={16} /> Rascunho
               </button>
               <button onClick={send} disabled={sending} style={{
                  padding: '10px 24px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '24px',
                  cursor: sending ? 'not-allowed' : 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem'
               }}>
                  {sending ? 'A Enviar...' : 'Enviar'}
                  {sending && <RefreshCw size={14} className="spin" />}
               </button>
            </div>
            <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '8px', borderRadius: '50%' }}><Trash2 size={20} /></button>
         </div>
      </div>
   );
}
