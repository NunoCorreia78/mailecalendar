const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('node:path');
const db = require('./db.cjs'); // Initialize SQLite
const { authenticateGoogle } = require('./auth.cjs');
const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');
const nodemailer = require('nodemailer');
const ical = require('node-ical');

ipcMain.handle('auth:google', async () => { /* legacy google auth */ });

ipcMain.handle('auth:manual', async (event, creds) => {
  const { email, password, imapHost, imapPort, smtpHost, smtpPort, calendarUrl } = creds;
  try {
    const portNum = parseInt(imapPort, 10);
    const config = {
      imap: { user: email, password: password, host: imapHost, port: portNum, tls: portNum === 993, tlsOptions: { rejectUnauthorized: false }, authTimeout: 10000 }
    };
    
    console.log(`Testando ligação IMAP para ${email} em ${imapHost}:${portNum}...`);
    const connection = await imaps.connect(config);
    connection.end();
    
    const stmt = db.prepare(`
      INSERT INTO accounts (provider, email, password, imap_host, imap_port, smtp_host, smtp_port, calendar_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        password=excluded.password, imap_host=excluded.imap_host, imap_port=excluded.imap_port,
        smtp_host=excluded.smtp_host, smtp_port=excluded.smtp_port, calendar_url=excluded.calendar_url
    `);
    
    stmt.run('manual', email, password, imapHost, imapPort, smtpHost, smtpPort, calendarUrl || null);
    return { success: true, message: 'Ligação estabelecida! O seu e-mail foi guardado localmente.' };
  } catch (err) {
    return { success: false, error: err.message || 'Falha na autenticação. Verifique os dados.' };
  }
});

// Sincronizar E-mails Reais via IMAP
ipcMain.handle('sync-emails', async (event, accountId, folderName = 'INBOX') => {
  try {
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
    if (!account) throw new Error('Conta não encontrada.');

    const config = {
      imap: { user: account.email, password: account.password, host: account.imap_host, port: account.imap_port, tls: account.imap_port === 993, tlsOptions: { rejectUnauthorized: false }, authTimeout: 15000 }
    };

    const connection = await imaps.connect(config);
    const box = await connection.openBox(folderName);
    const total = box.messages.total;
    
    if (total === 0) {
      connection.end();
      return { success: true };
    }

    const start = Math.max(1, total - 299); // fetch last 300
    // Fetch FLAGS explicitly alongside the body to correctly detect \Seen
    const messages = await connection.search([`${start}:*`], { bodies: [''], markSeen: false, struct: false });

    const insertStmt = db.prepare(`
      INSERT INTO emails (id, account_id, subject, snippet, is_read, timestamp, sender, html_body, folder, is_pinned, is_important)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
      ON CONFLICT(id) DO UPDATE SET
        is_read=excluded.is_read,
        folder=excluded.folder,
        html_body=excluded.html_body,
        snippet=excluded.snippet,
        subject=excluded.subject
    `);

    let newEmailsCount = 0;
    for (const item of messages) {
      const all = item.parts.find(p => p.which === '');
      if (!all) continue;
      
      const mail = await simpleParser(all.body);
      const id = item.attributes.uid.toString();
      const subject = mail.subject || '(Sem assunto)';
      const snippet = mail.text ? mail.text.substring(0, 200) : (mail.html ? '(Mensagem HTML)' : '(Sem texto)');
      
      const existing = db.prepare('SELECT id FROM emails WHERE id = ?').get(id);
      if (!existing) newEmailsCount++;

      let rawHtml = mail.html || mail.textAsHtml || mail.text || '';
      
      if (mail.attachments && mail.attachments.length > 0) {
         mail.attachments.forEach(att => {
            if (att.cid && att.content) {
               const cid1 = `cid:${att.cid}`;
               const cid2 = `cid:${att.cid.replace(/[<>]/g, '')}`;
               const base64Content = att.content.toString('base64');
               const dataURI = `data:${att.contentType || 'image/png'};base64,${base64Content}`;
               rawHtml = rawHtml.split(cid1).join(dataURI);
               rawHtml = rawHtml.split(cid2).join(dataURI);
            }
         });
      }

      // Correctly detect read status from IMAP flags
      const flags = item.attributes.flags || [];
      const isRead = flags.some(f => f === '\\Seen' || f.toLowerCase() === '\\seen' || f === 'SEEN' || f === 'Seen') ? 1 : 0;
      console.log(`Email ID: ${id} | Flags from IMAP:`, flags, `| isRead Result: ${isRead}`);

      const timestamp = mail.date ? mail.date.toISOString() : new Date().toISOString();
      const sender = mail.from && mail.from.text ? mail.from.text : account.email;
      
      try {
         const match = /<([^>]+)>/.exec(sender);
         const emailAddr = match ? match[1] : sender;
         const nameStr = match ? sender.split('<')[0].trim() : sender;
         db.prepare('INSERT OR IGNORE INTO contacts (email, name) VALUES (?, ?)').run(emailAddr, nameStr);
      } catch(e) {}

      insertStmt.run(id, account.id, subject, snippet, isRead, timestamp, sender, rawHtml, folderName);
    }
    connection.end();
    return { success: true, newCount: newEmailsCount };
  } catch (err) { return { success: false, error: err.message }; }
});

// Clear all cached emails (forces fresh re-sync with correct flags)
ipcMain.handle('clear-email-cache', async () => {
  try {
    const count = db.prepare('SELECT COUNT(*) as c FROM emails').get();
    db.prepare('DELETE FROM emails').run();
    return { success: true, cleared: count.c };
  } catch(e) { return { success: false, error: e.message }; }
});

// Audit unread directly
ipcMain.handle('audit-unread', async (event, accountId) => {
  try {
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
    if (!account) throw new Error('Conta não encontrada.');
    const config = {
      imap: { user: account.email, password: account.password, host: account.imap_host, port: account.imap_port, tls: account.imap_port === 993, tlsOptions: { rejectUnauthorized: false }, authTimeout: 15000 }
    };
    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');
    const unseen = await connection.search(['UNSEEN'], { bodies: ['HEADER.FIELDS (SUBJECT)'], struct: false });
    connection.end();
    return { success: true, count: unseen.length, subjects: unseen.map(u => {
      const headerObj = u.parts.find(p => p.which !== '');
      return headerObj ? headerObj.body.subject : 'No subject';
    }) };
  } catch(e) { return { success: false, error: e.message }; }
});

// SMTP - Send Email
ipcMain.handle('send-email', async (event, accountId, mailOptions) => {
  try {
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
    if (!account) throw new Error('Conta não encontrada.');
    const transporter = nodemailer.createTransport({
        host: account.smtp_host,
        port: account.smtp_port,
        secure: account.smtp_port === 465, // usually 465 is secure, 587 is STARTTLS (false)
        auth: { user: account.email, pass: account.password },
        tls: { rejectUnauthorized: false }
    });
    const info = await transporter.sendMail({
        from: `"${account.email}" <${account.email}>`,
        ...mailOptions
    });
    return { success: true, messageId: info.messageId };
  } catch (err) { return { success: false, error: err.message }; }
});

// IMAP Simulation - Delete / Move
ipcMain.handle('execute-action', async (event, emailIds, action) => {
  try {
     const placeholders = emailIds.map(() => '?').join(',');
     let newFolder = action;
     // Force mapping standard folders
     if (action === 'Trash') newFolder = '[Gmail]/Trash';
     if (action === 'Spam') newFolder = '[Gmail]/Spam';
     if (action === 'Archive') newFolder = 'Archive';
     
     db.prepare(`UPDATE emails SET folder = ? WHERE id IN (${placeholders})`).run(newFolder, ...emailIds);
     return { success: true };
  } catch(e) { return { success: false, error: e.message }; }
});

ipcMain.handle('get-account', async () => {
  try { return { success: true, data: db.prepare(`SELECT * FROM accounts LIMIT 1`).get() }; }
  catch(e) { return { success: false, error: e.message }; }
});

// Fetch local emails
ipcMain.handle('get-local-emails', async (event, folderName = 'INBOX') => {
  try {
    const emails = db.prepare(`SELECT * FROM emails WHERE folder = ? ORDER BY is_pinned DESC, timestamp DESC LIMIT 1000`).all(folderName);
    return { success: true, data: emails };
  } catch(e) { return { success: false, error: e.message }; }
});

ipcMain.handle('toggle-flag', async (event, emailId, field, flagStatus) => {
  try {
    db.prepare(`UPDATE emails SET ${field} = ? WHERE id = ?`).run(flagStatus ? 1 : 0, emailId);
    return { success: true };
  } catch(e) { return { success: false, error: e.message }; }
});

// Calendar fetch
ipcMain.handle('get-calendar-events', async () => {
  try {
    const localEvents = db.prepare('SELECT * FROM events').all();
    let parsedEvents = [];
    localEvents.forEach(le => {
       parsedEvents.push({ 
           id: le.id, 
           title: le.title, 
           start: new Date(le.start_time), 
           end: new Date(le.end_time), 
           description: '', 
           isExternal: String(le.id).includes('@google') || String(le.id).length > 20 
       });
    });
    return { success: true, data: parsedEvents };
  } catch(e) { return { success: false, error: e.message }; }
});

ipcMain.handle('sync-calendar-content', async () => {
   try {
      const account = db.prepare(`SELECT calendar_url, id FROM accounts LIMIT 1`).get();
      if (!account || !account.calendar_url) return { success: false };
      
      const insertStmt = db.prepare(`INSERT OR REPLACE INTO events (id, account_id, title, start_time, end_time) VALUES (?, ?, ?, ?, ?)`);
      const events = await ical.async.fromURL(account.calendar_url);
      
      const insertMany = db.transaction(() => {
         for (let k in events) {
            if (events.hasOwnProperty(k)) {
               const ev = events[k];
               if (ev.type === 'VEVENT') {
                  insertStmt.run(ev.uid, account.id, ev.summary || 'Incógnito', new Date(ev.start).toISOString(), new Date(ev.end).toISOString());
               }
            }
         }
      });
      insertMany();
      return { success: true };
   } catch(e) { return { success: false, error: e.message }; }
});

ipcMain.handle('add-local-event', (e, title, start_time, end_time) => {
   try {
     const id = require('crypto').randomUUID();
     const account = db.prepare('SELECT id FROM accounts LIMIT 1').get();
     db.prepare('INSERT INTO events (id, account_id, title, start_time, end_time) VALUES (?, ?, ?, ?, ?)').run(id, account ? account.id : 0, title, start_time, end_time);
     return { success: true };
   } catch(e) { return { success: false, error: e.message }; }
});

ipcMain.handle('update-local-event', (e, id, start_time, end_time) => {
   try {
     db.prepare('UPDATE events SET start_time = ?, end_time = ? WHERE id = ?').run(start_time, end_time, id);
     return { success: true };
   } catch(e) { return { success: false, error: e.message }; }
});

// TO-DOS
ipcMain.handle('get-todos', () => {
    try { return { success: true, data: db.prepare('SELECT * FROM todos ORDER BY is_completed ASC, created_at DESC').all() }; }
    catch(e) { return { success: false, error: e.message }; }
});
ipcMain.handle('add-todo', (event, task) => {
    try { db.prepare('INSERT INTO todos (task) VALUES (?)').run(task); return { success: true }; }
    catch(e) { return { success: false, error: e.message }; }
});
ipcMain.handle('toggle-todo', (event, id, isCompleted) => {
    try { db.prepare('UPDATE todos SET is_completed = ? WHERE id = ?').run(isCompleted ? 1 : 0, id); return { success: true }; }
    catch(e) { return { success: false, error: e.message }; }
});
ipcMain.handle('delete-todo', (event, id) => {
    try { db.prepare('DELETE FROM todos WHERE id = ?').run(id); return { success: true }; }
    catch(e) { return { success: false, error: e.message }; }
});

// Notifications
ipcMain.handle('show-notification', (event, title, body) => {
    if (Notification.isSupported()) { new Notification({ title, body }).show(); }
    return { success: true };
});

ipcMain.handle('search-contacts', (event, query) => {
   try { return { success: true, data: db.prepare(`SELECT * FROM contacts WHERE email LIKE ? OR name LIKE ? LIMIT 5`).all(`%${query}%`, `%${query}%`) }; }
   catch(e) { return { success: false, error: e.message }; }
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  const { Menu, MenuItem } = require('electron');
  app.on('web-contents-created', (e, contents) => {
    contents.on('context-menu', (event, params) => {
      const menu = new Menu();
      if (params.isEditable) {
        menu.append(new MenuItem({ role: 'undo', label: 'Desfazer' }));
        menu.append(new MenuItem({ role: 'redo', label: 'Refazer' }));
        menu.append(new MenuItem({ type: 'separator' }));
        menu.append(new MenuItem({ role: 'cut', label: 'Cortar' }));
        menu.append(new MenuItem({ role: 'copy', label: 'Copiar' }));
        menu.append(new MenuItem({ role: 'paste', label: 'Colar' }));
        menu.append(new MenuItem({ type: 'separator' }));
        menu.append(new MenuItem({ role: 'selectAll', label: 'Selecionar tudo' }));
      } else if (params.selectionText && params.selectionText.trim().length > 0) {
        menu.append(new MenuItem({ role: 'copy', label: 'Copiar' }));
      } else {
        menu.append(new MenuItem({ role: 'reload', label: 'Recarregar' }));
      }
      menu.popup();
    });
  });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
