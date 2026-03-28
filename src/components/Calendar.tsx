import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'month'|'week'|'day'|'agenda'>('week');

  // Modal State
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');

  const fetchEvents = async () => {
    setLoading(true);
    try {
        if (window.electronAPI && (window.electronAPI as any).getCalendarEvents) {
          const res = await (window.electronAPI as any).getCalendarEvents();
          if (res.success && res.data) setEvents(res.data);
          
          if ((window.electronAPI as any).syncCalendarContent) {
             (window.electronAPI as any).syncCalendarContent().then(async (syncRes: any) => {
                 if (syncRes && syncRes.success) {
                    const updated = await (window.electronAPI as any).getCalendarEvents();
                    if (updated.success && updated.data) setEvents(updated.data);
                 }
             });
          }
        }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []);

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  const changeDate = (offset: number) => {
      const d = new Date(currentDate);
      if (view === 'month') d.setMonth(d.getMonth() + offset);
      if (view === 'week') d.setDate(d.getDate() + (offset * 7));
      if (view === 'day' || view === 'agenda') d.setDate(d.getDate() + offset);
      setCurrentDate(d);
  };

  const getDayEvents = (targetDate: Date) => {
     const dateStr = targetDate.toISOString().split('T')[0];
     return events.filter(e => e.start && new Date(e.start).toISOString().split('T')[0] === dateStr);
  };

  const handleCreateEvent = async () => {
     if (!newTitle || !newStart || !newEnd) { alert('Preencha os campos.'); return; }
     try {
       if (window.electronAPI && (window.electronAPI as any).addLocalEvent) {
          await (window.electronAPI as any).addLocalEvent(newTitle, new Date(newStart).toISOString(), new Date(newEnd).toISOString());
          setIsAdding(false);
          setNewTitle(''); setNewStart(''); setNewEnd('');
          fetchEvents();
       }
     } catch(e) {}
  };

  const handleDrop = async (e: React.DragEvent, targetDate: Date) => {
     e.preventDefault();
     const eventId = e.dataTransfer.getData('eventId');
     const isExt = e.dataTransfer.getData('isExternal');
     if (isExt === 'true') { alert('Eventos importados externamente não podem ser re-agendados. Altere-os no Google Calendar original.'); return; }
     
     const ev = events.find(ex => ex.id === eventId);
     if (ev) {
        const startD = new Date(ev.start);
        const endD = new Date(ev.end);
        const duration = endD.getTime() - startD.getTime();
        
        const newStartD = new Date(targetDate);
        newStartD.setHours(startD.getHours(), startD.getMinutes());
        const newEndD = new Date(newStartD.getTime() + duration);
        
        try {
           if (window.electronAPI && (window.electronAPI as any).updateLocalEvent) {
              await (window.electronAPI as any).updateLocalEvent(eventId, newStartD.toISOString(), newEndD.toISOString());
              fetchEvents();
           }
        } catch(e) {}
     }
  };

  const renderMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0=Sun
    const todayStr = new Date().toISOString().split('T')[0];

    // Build grid: fill leading days from prev month
    const cells: { date: Date; isCurrentMonth: boolean }[] = [];

    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      cells.push({ date: new Date(year, month - 1, prevMonthDays - i), isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(year, month, d), isCurrentMonth: true });
    }
    // Fill trailing days from next month to complete grid rows
    const remaining = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7);
    for (let d = 1; d <= remaining; d++) {
      cells.push({ date: new Date(year, month + 1, d), isCurrentMonth: false });
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '8px 0', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', flex: 1, overflowY: 'auto' }}>
          {cells.map((cell, idx) => {
            const dateStr = cell.date.toISOString().split('T')[0];
            const dayEvents = getDayEvents(cell.date);
            const isToday = todayStr === dateStr;
            const { isCurrentMonth } = cell;

            return (
              <div key={idx}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; }}
                onDragLeave={(e) => { e.currentTarget.style.backgroundColor = isToday ? 'var(--accent-light)' : isCurrentMonth ? 'var(--bg-secondary)' : 'var(--bg-tertiary)'; }}
                onDrop={(e) => { e.currentTarget.style.backgroundColor = isToday ? 'var(--accent-light)' : isCurrentMonth ? 'var(--bg-secondary)' : 'var(--bg-tertiary)'; handleDrop(e, cell.date); }}
                style={{
                  backgroundColor: isToday ? 'var(--accent-light)' : isCurrentMonth ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                  border: isToday ? '1px solid var(--accent)' : isCurrentMonth ? '1px solid var(--border)' : '1px solid transparent',
                  padding: '6px', minHeight: '100px', display: 'flex', flexDirection: 'column', gap: '3px',
                  overflow: 'hidden', borderRadius: '6px', transition: 'background-color 0.15s, border 0.15s',
                  opacity: isCurrentMonth ? 1 : 0.65,
                }}
              >
                <div style={{ 
                  fontWeight: isToday ? 700 : 500, 
                  fontSize: '0.85rem', 
                  color: isToday ? 'white' : isCurrentMonth ? 'var(--text-primary)' : 'var(--text-secondary)',
                  backgroundColor: isToday ? 'var(--accent)' : 'transparent',
                  width: isToday ? '24px' : 'auto', height: isToday ? '24px' : 'auto',
                  borderRadius: isToday ? '50%' : '0',
                  display: 'flex', alignItems: 'center', justifyContent: isToday ? 'center' : 'flex-start',
                  marginBottom: '2px', flexShrink: 0,
                }}>
                  {isCurrentMonth && cell.date.getDate() === 1
                    ? `${cell.date.getDate()} ${monthNames[cell.date.getMonth()].substring(0, 3)}`
                    : !isCurrentMonth && cell.date.getDate() === 1
                    ? `1 ${monthNames[cell.date.getMonth()].substring(0, 3)}`
                    : cell.date.getDate()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, overflow: 'hidden' }}>
                  {dayEvents.slice(0, 3).map((ev, i) => (
                    <div key={i} title={ev.title}
                      draggable={true}
                      onDragStart={(e) => { e.dataTransfer.setData('eventId', ev.id); e.dataTransfer.setData('isExternal', ev.isExternal ? 'true' : 'false'); }}
                      style={{
                        fontSize: '0.72rem', padding: '2px 5px',
                        backgroundColor: ev.isExternal ? '#0f9d58' : 'var(--accent)',
                        color: 'white', borderRadius: '3px',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        fontWeight: 500, cursor: 'grab', flexShrink: 0,
                      }}>
                      {new Date(ev.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div onClick={(e) => { e.stopPropagation(); setCurrentDate(cell.date); setView('day'); }}
                      style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', padding: '1px 4px', whiteSpace: 'nowrap', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', textAlign: 'center' }}
                      onMouseOver={e => e.currentTarget.style.color='var(--text-primary)'}
                      onMouseOut={e => e.currentTarget.style.color='var(--text-secondary)'}
                    >
                      + {dayEvents.length - 3} mais
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderAgenda = () => {
    const upcoming = events.filter(e => new Date(e.start) >= currentDate).sort((a,b) => new Date(a.start).getTime() - new Date(b.start).getTime()).slice(0, 50);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', padding: '16px', gap: '16px', overflowY: 'auto', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border)', flex: 1 }}>
        {upcoming.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>Sem eventos programados.</p> : upcoming.map(ev => {
           const d = new Date(ev.start);
           return (
             <div key={ev.id} style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                <div style={{ minWidth: '80px' }}>
                   <div style={{ fontWeight: 600, fontSize: '1.2rem', color: 'var(--text-primary)' }}>{d.getDate()} {monthNames[d.getMonth()].substring(0,3)}</div>
                   <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                </div>
                <div>
                   <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{ev.title}</div>
                   {ev.description && <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>{ev.description}</div>}
                   {!ev.isExternal && <div style={{ color: 'var(--accent)', fontSize: '0.8rem', marginTop: '4px', fontWeight: 600 }}>Evento Local</div>}
                </div>
             </div>
           );
        })}
      </div>
    );
  };

  const renderWeek = (isSingleDay = false) => {
     const startOfWeek = new Date(currentDate);
     if (!isSingleDay) {
         startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
     }
     
     const weekDays = [];
     const numDays = isSingleDay ? 1 : 7;
     for(let i=0; i<numDays; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        weekDays.push(d);
     }

     const hours = Array.from({length: 24}, (_, i) => i);

     return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border)' }}>
           {/* Header */}
           <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingLeft: '50px', paddingRight: '12px' }}>
              {weekDays.map(d => {
                 const isToday = d.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
                 return (
                    <div key={d.toISOString()} style={{ flex: 1, textAlign: 'center', padding: '12px 0', borderLeft: '1px solid var(--border)' }}>
                       <div style={{ fontSize: '0.85rem', color: isToday ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d.getDay()]}
                       </div>
                       <div style={{ 
                          fontSize: '1.4rem', fontWeight: 500, color: isToday ? 'white' : 'var(--text-primary)', 
                          backgroundColor: isToday ? 'var(--accent)' : 'transparent',
                          width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px auto 0' 
                       }}>
                          {d.getDate()}
                       </div>
                    </div>
                 )
              })}
           </div>

           {/* Grid body */}
           <div style={{ display: 'flex', flex: 1, overflowY: 'auto' }}>
              {/* Time Column */}
              <div style={{ width: '50px', flexShrink: 0, position: 'relative' }}>
                 {hours.map(h => (
                    <div key={h} style={{ height: '60px', position: 'relative' }}>
                       <span style={{ position: 'absolute', right: '8px', top: '-10px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {h === 0 ? '' : `${h}:00`}
                       </span>
                    </div>
                 ))}
               </div>
               
               {/* Day Columns */}
               <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
                  {/* Grid Lines */}
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
                     {hours.map(h => (
                        <div key={h} style={{ borderBottom: '1px solid var(--border)', height: '60px', opacity: 0.5 }} />
                     ))}
                  </div>

                  {weekDays.map(d => {
                     const dateStr = d.toISOString().split('T')[0];
                     const dayEvents = events.filter(e => e.start && new Date(e.start).toISOString().split('T')[0] === dateStr);
                     const isToday = dateStr === new Date().toISOString().split('T')[0];
                     
                     return (
                        <div key={d.toISOString()} style={{ flex: 1, borderLeft: '1px solid var(--border)', position: 'relative' }}>
                           {/* Current Time Line */}
                           {isToday && (
                             <div style={{ position: 'absolute', left: 0, right: 0, top: `${new Date().getHours() * 60 + new Date().getMinutes()}px`, borderTop: '2px solid #ea4335', zIndex: 10 }}>
                                <div style={{ position: 'absolute', left: '-5px', top: '-6px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ea4335' }}/>
                             </div>
                           )}

                           {/* absolute events */}
                           {dayEvents.map(ev => {
                              const start = new Date(ev.start);
                              const end = new Date(ev.end);
                              const top = start.getHours() * 60 + start.getMinutes();
                              const height = Math.max((end.getTime() - start.getTime()) / 60000, 25);
                              
                              return (
                                 <div key={ev.id} title={ev.title} style={{
                                     position: 'absolute', top: `${top}px`, height: `${height}px`,
                                     left: '2%', width: '96%',
                                     backgroundColor: ev.isExternal ? '#4285F4' : 'var(--accent)',
                                     color: 'white', borderRadius: '4px', padding: '4px 6px', display: 'flex', flexDirection: 'column',
                                     fontSize: '0.75rem', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                                     border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', zIndex: 5
                                 }}>
                                    <div style={{ fontWeight: 600 }}>{ev.title}</div>
                                    <div style={{ opacity: 0.9, fontSize: '0.7rem' }}>
                                       {start.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
                                    </div>
                                 </div>
                              )
                           })}
                        </div>
                     )
                  })}
               </div>
           </div>
        </div>
     );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem', animation: 'fadeIn 0.4s ease-out' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => changeDate(-1)} style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-secondary)', cursor: 'pointer' }}><ChevronLeft size={20} color="var(--text-primary)"/></button>
          
          <button style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-secondary)', cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)' }} onClick={() => setCurrentDate(new Date())}>
             Hoje
          </button>

          <h2 style={{ minWidth: '200px', textAlign: 'center', margin: 0, fontSize: '1.4rem', color: 'var(--text-primary)', fontWeight: 600 }}>
             {view === 'month' && `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
             {view === 'week' && `Semana de ${currentDate.getDate()} ${monthNames[currentDate.getMonth()].substring(0,3)}`}
             {view === 'day' && `${currentDate.getDate()} de ${monthNames[currentDate.getMonth()]}`}
             {view === 'agenda' && `Agenda de ${monthNames[currentDate.getMonth()]}`}
          </h2>
          <button onClick={() => changeDate(1)} style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-secondary)', cursor: 'pointer' }}><ChevronRight size={20} color="var(--text-primary)" /></button>
          {loading && <span style={{fontSize: '0.9rem', color: 'var(--text-secondary)'}}>Sincronizando...</span>}
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
           <div style={{ display: 'flex', backgroundColor: 'var(--bg-secondary)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              {(['day', 'week', 'month', 'agenda'] as const).map(v => (
                 <button key={v} onClick={() => setView(v)} style={{
                    padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
                    backgroundColor: view === v ? 'var(--bg-primary)' : 'transparent', color: view === v ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: view === v ? 'var(--shadow-sm)' : 'none', transition: 'all 0.15s'
                 }}>
                    {v === 'day' ? 'Dia' : v === 'week' ? 'Semana' : v === 'month' ? 'Mês' : 'Lista'}
                 </button>
              ))}
           </div>
          
          <button onClick={() => setIsAdding(true)} style={{ 
            padding: '10px 20px', backgroundColor: 'var(--accent)', color: 'white', 
            border: 'none', borderRadius: '24px', cursor: 'pointer', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'var(--shadow-md)'
          }}>
            <Plus size={18} /> Evento
          </button>
        </div>
      </div>

      {view === 'month' && renderMonth()}
      {view === 'week' && renderWeek(false)}
      {view === 'day' && renderWeek(true)}
      {view === 'agenda' && renderAgenda()}

      {isAdding && (
         <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, animation: 'fadeIn 0.2s' }}>
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '32px', borderRadius: '24px', width: '400px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '1.4rem' }}>Novo Evento Local</h3>
                  <button onClick={() => setIsAdding(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} color="var(--text-secondary)" /></button>
               </div>
               
               <input type="text" placeholder="Título do Evento..." className="modern-input" value={newTitle} onChange={e=>setNewTitle(e.target.value)} />
               <div>
                  <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Data de Início</label>
                  <input type="datetime-local" className="modern-input" style={{ width: '100%' }} value={newStart} onChange={e=>setNewStart(e.target.value)} />
               </div>
               <div>
                  <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Data de Fim</label>
                  <input type="datetime-local" className="modern-input" style={{ width: '100%' }} value={newEnd} onChange={e=>setNewEnd(e.target.value)} />
               </div>

               <button onClick={handleCreateEvent} style={{ padding: '14px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, fontSize: '1.05rem', marginTop: '8px' }}>
                  Gravar no Calendário
               </button>
            </div>
         </div>
      )}

    </div>
  );
}
