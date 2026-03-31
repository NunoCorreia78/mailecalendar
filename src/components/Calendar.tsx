import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Edit2 } from 'lucide-react';

const EVENT_COLORS = [
  { label: 'Azul', value: '#0b57d0' },
  { label: 'Verde', value: '#0f9d58' },
  { label: 'Vermelho', value: '#ea4335' },
  { label: 'Amarelo', value: '#f9ab00' },
  { label: 'Roxo', value: '#7b1fa2' },
  { label: 'Rosa', value: '#e91e63' },
  { label: 'Laranja', value: '#e65100' },
  { label: 'Cinzento', value: '#616161' },
];

interface CalEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  color?: string;
  isExternal?: boolean;
}

interface ContextMenuState {
  x: number;
  y: number;
  type: 'cell' | 'event';
  date?: Date;
  event?: CalEvent;
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'month' | 'week' | 'day' | 'agenda'>('week');

  // Modal State — shared for create and edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalEvent | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalStart, setModalStart] = useState('');
  const [modalEnd, setModalEnd] = useState('');
  const [modalColor, setModalColor] = useState('#0b57d0');

  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      if (window.electronAPI && (window.electronAPI as any).getCalendarEvents) {
        const res = await (window.electronAPI as any).getCalendarEvents();
        if (res.success && res.data) {
          setEvents(res.data.map((e: any) => ({ ...e, start: new Date(e.start), end: new Date(e.end) })));
        }

        if ((window.electronAPI as any).syncCalendarContent) {
          (window.electronAPI as any).syncCalendarContent().then(async (syncRes: any) => {
            if (syncRes && syncRes.success) {
              const updated = await (window.electronAPI as any).getCalendarEvents();
              if (updated.success && updated.data) {
                setEvents(updated.data.map((e: any) => ({ ...e, start: new Date(e.start), end: new Date(e.end) })));
              }
            }
          });
        }
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Close context menu on outside click
  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

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

  const toLocalDatetimeValue = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openCreateModal = (prefillDate?: Date) => {
    setEditingEvent(null);
    setModalTitle('');
    setModalColor('#0b57d0');
    if (prefillDate) {
      const start = new Date(prefillDate);
      start.setHours(9, 0, 0, 0);
      const end = new Date(prefillDate);
      end.setHours(10, 0, 0, 0);
      setModalStart(toLocalDatetimeValue(start));
      setModalEnd(toLocalDatetimeValue(end));
    } else {
      setModalStart('');
      setModalEnd('');
    }
    setIsModalOpen(true);
  };

  const openEditModal = (ev: CalEvent) => {
    setEditingEvent(ev);
    setModalTitle(ev.title);
    setModalStart(toLocalDatetimeValue(new Date(ev.start)));
    setModalEnd(toLocalDatetimeValue(new Date(ev.end)));
    setModalColor(ev.color || '#0b57d0');
    setIsModalOpen(true);
  };

  const handleSaveEvent = async () => {
    if (!modalTitle || !modalStart || !modalEnd) { alert('Preencha os campos.'); return; }
    try {
      if (editingEvent) {
        if (window.electronAPI && (window.electronAPI as any).updateLocalEvent) {
          await (window.electronAPI as any).updateLocalEvent(
            editingEvent.id,
            new Date(modalStart).toISOString(),
            new Date(modalEnd).toISOString(),
            modalTitle,
            modalColor
          );
        }
      } else {
        if (window.electronAPI && (window.electronAPI as any).addLocalEvent) {
          await (window.electronAPI as any).addLocalEvent(
            modalTitle,
            new Date(modalStart).toISOString(),
            new Date(modalEnd).toISOString(),
            modalColor
          );
        }
      }
      setIsModalOpen(false);
      fetchEvents();
    } catch (e) {}
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Eliminar este evento?')) return;
    try {
      if (window.electronAPI && (window.electronAPI as any).deleteLocalEvent) {
        await (window.electronAPI as any).deleteLocalEvent(id);
        fetchEvents();
      }
    } catch (e) {}
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
      } catch (e) {}
    }
  };

  const handleCellContextMenu = (e: React.MouseEvent, date: Date) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'cell', date });
  };

  const handleEventContextMenu = (e: React.MouseEvent, ev: CalEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'event', event: ev });
  };

  // ── Event chip shared renderer ──
  const EventChip = ({ ev, compact = false }: { ev: CalEvent; compact?: boolean }) => (
    <div
      title={ev.title}
      draggable={!ev.isExternal}
      onDragStart={(e) => { e.dataTransfer.setData('eventId', ev.id); e.dataTransfer.setData('isExternal', ev.isExternal ? 'true' : 'false'); }}
      onClick={(e) => { e.stopPropagation(); if (!ev.isExternal) openEditModal(ev); }}
      onContextMenu={(e) => handleEventContextMenu(e, ev)}
      style={{
        fontSize: compact ? '0.72rem' : '0.78rem',
        padding: compact ? '2px 5px' : '3px 7px',
        backgroundColor: ev.color || (ev.isExternal ? '#0f9d58' : '#0b57d0'),
        color: 'white', borderRadius: '4px',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        fontWeight: 500, cursor: ev.isExternal ? 'default' : 'pointer', flexShrink: 0,
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        transition: 'filter 0.1s',
      }}
      onMouseOver={e => { if (!ev.isExternal) (e.currentTarget as HTMLElement).style.filter = 'brightness(0.9)'; }}
      onMouseOut={e => { (e.currentTarget as HTMLElement).style.filter = 'none'; }}
    >
      {new Date(ev.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {ev.title}
    </div>
  );

  const renderMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const todayStr = new Date().toISOString().split('T')[0];

    const cells: { date: Date; isCurrentMonth: boolean }[] = [];
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      cells.push({ date: new Date(year, month - 1, prevMonthDays - i), isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(year, month, d), isCurrentMonth: true });
    }
    const remaining = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7);
    for (let d = 1; d <= remaining; d++) {
      cells.push({ date: new Date(year, month + 1, d), isCurrentMonth: false });
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
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
                onContextMenu={(e) => handleCellContextMenu(e, cell.date)}
                onDoubleClick={() => openCreateModal(cell.date)}
                style={{
                  backgroundColor: isToday ? 'var(--accent-light)' : isCurrentMonth ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                  border: isToday ? '1px solid var(--accent)' : isCurrentMonth ? '1px solid var(--border)' : '1px solid transparent',
                  padding: '6px', minHeight: '100px', display: 'flex', flexDirection: 'column', gap: '3px',
                  overflow: 'hidden', borderRadius: '6px', transition: 'background-color 0.15s, border 0.15s',
                  opacity: isCurrentMonth ? 1 : 0.65, cursor: 'default',
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
                    <EventChip key={i} ev={ev} compact />
                  ))}
                  {dayEvents.length > 3 && (
                    <div
                      onClick={(e) => { e.stopPropagation(); setCurrentDate(cell.date); setView('day'); }}
                      style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', padding: '1px 4px', whiteSpace: 'nowrap', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', textAlign: 'center' }}
                      onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
                      onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
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
    const upcoming = events
      .filter(e => new Date(e.start) >= currentDate)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 50);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', padding: '16px', gap: '16px', overflowY: 'auto', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border)', flex: 1 }}>
        {upcoming.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>Sem eventos programados.</p>
        ) : upcoming.map(ev => {
          const d = new Date(ev.start);
          return (
            <div key={ev.id}
              onContextMenu={(e) => handleEventContextMenu(e, ev)}
              style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px', cursor: ev.isExternal ? 'default' : 'pointer' }}
              onClick={() => { if (!ev.isExternal) openEditModal(ev); }}
            >
              <div style={{ minWidth: '80px' }}>
                <div style={{ fontWeight: 600, fontSize: '1.2rem', color: 'var(--text-primary)' }}>{d.getDate()} {monthNames[d.getMonth()].substring(0, 3)}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: ev.color || (ev.isExternal ? '#0f9d58' : '#0b57d0'), flexShrink: 0, marginTop: '5px' }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{ev.title}</div>
                  {ev.description && <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>{ev.description}</div>}
                  {!ev.isExternal && <div style={{ color: ev.color || 'var(--accent)', fontSize: '0.8rem', marginTop: '4px', fontWeight: 600 }}>Evento Local</div>}
                </div>
              </div>
              {!ev.isExternal && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteEvent(ev.id); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', borderRadius: '4px', opacity: 0.6 }}
                  title="Eliminar"
                  onMouseOver={e => { (e.currentTarget as HTMLElement).style.color = '#ea4335'; (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                  onMouseOut={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.opacity = '0.6'; }}
                >
                  <Trash2 size={16} />
                </button>
              )}
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
    for (let i = 0; i < numDays; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      weekDays.push(d);
    }

    const hours = Array.from({ length: 24 }, (_, i) => i);

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
            );
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
                <div key={d.toISOString()}
                  style={{ flex: 1, borderLeft: '1px solid var(--border)', position: 'relative' }}
                  onContextMenu={(e) => handleCellContextMenu(e, d)}
                  onDoubleClick={() => openCreateModal(d)}
                >
                  {/* Current Time Line */}
                  {isToday && (
                    <div style={{ position: 'absolute', left: 0, right: 0, top: `${new Date().getHours() * 60 + new Date().getMinutes()}px`, borderTop: '2px solid #ea4335', zIndex: 10 }}>
                      <div style={{ position: 'absolute', left: '-5px', top: '-6px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ea4335' }} />
                    </div>
                  )}

                  {/* Events */}
                  {dayEvents.map(ev => {
                    const start = new Date(ev.start);
                    const end = new Date(ev.end);
                    const top = start.getHours() * 60 + start.getMinutes();
                    const height = Math.max((end.getTime() - start.getTime()) / 60000, 25);
                    const color = ev.color || (ev.isExternal ? '#4285F4' : 'var(--accent)');

                    return (
                      <div key={ev.id}
                        title={ev.title}
                        onClick={() => { if (!ev.isExternal) openEditModal(ev); }}
                        onContextMenu={(e) => handleEventContextMenu(e, ev)}
                        style={{
                          position: 'absolute', top: `${top}px`, height: `${height}px`,
                          left: '2%', width: '96%',
                          backgroundColor: color,
                          color: 'white', borderRadius: '4px', padding: '4px 6px', display: 'flex', flexDirection: 'column',
                          fontSize: '0.75rem', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          cursor: ev.isExternal ? 'default' : 'pointer', zIndex: 5,
                          transition: 'filter 0.1s',
                        }}
                        onMouseOver={e => { if (!ev.isExternal) (e.currentTarget as HTMLElement).style.filter = 'brightness(0.9)'; }}
                        onMouseOut={e => { (e.currentTarget as HTMLElement).style.filter = 'none'; }}
                      >
                        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                        <div style={{ opacity: 0.9, fontSize: '0.7rem' }}>
                          {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
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
          <button onClick={() => changeDate(-1)} style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-secondary)', cursor: 'pointer' }}><ChevronLeft size={20} color="var(--text-primary)" /></button>

          <button style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-secondary)', cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)' }} onClick={() => setCurrentDate(new Date())}>
            Hoje
          </button>

          <h2 style={{ minWidth: '200px', textAlign: 'center', margin: 0, fontSize: '1.4rem', color: 'var(--text-primary)', fontWeight: 600 }}>
            {view === 'month' && `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
            {view === 'week' && `Semana de ${currentDate.getDate()} ${monthNames[currentDate.getMonth()].substring(0, 3)}`}
            {view === 'day' && `${currentDate.getDate()} de ${monthNames[currentDate.getMonth()]}`}
            {view === 'agenda' && `Agenda de ${monthNames[currentDate.getMonth()]}`}
          </h2>
          <button onClick={() => changeDate(1)} style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-secondary)', cursor: 'pointer' }}><ChevronRight size={20} color="var(--text-primary)" /></button>
          {loading && <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Sincronizando...</span>}
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

          <button onClick={() => openCreateModal()} style={{
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

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, animation: 'fadeIn 0.2s' }}>
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '32px', borderRadius: '24px', width: '420px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.4rem' }}>{editingEvent ? 'Editar Evento' : 'Novo Evento Local'}</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} color="var(--text-secondary)" /></button>
            </div>

            <input type="text" placeholder="Título do Evento..." className="modern-input" value={modalTitle} onChange={e => setModalTitle(e.target.value)} />

            <div>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Data de Início</label>
              <input type="datetime-local" className="modern-input" style={{ width: '100%' }} value={modalStart} onChange={e => setModalStart(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Data de Fim</label>
              <input type="datetime-local" className="modern-input" style={{ width: '100%' }} value={modalEnd} onChange={e => setModalEnd(e.target.value)} />
            </div>

            {/* Color Picker */}
            <div>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '10px', display: 'block' }}>Cor do Evento</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {EVENT_COLORS.map(c => (
                  <button
                    key={c.value}
                    title={c.label}
                    onClick={() => setModalColor(c.value)}
                    style={{
                      width: '28px', height: '28px', borderRadius: '50%', backgroundColor: c.value, border: 'none', cursor: 'pointer',
                      outline: modalColor === c.value ? `3px solid ${c.value}` : '3px solid transparent',
                      outlineOffset: '2px',
                      transform: modalColor === c.value ? 'scale(1.2)' : 'scale(1)',
                      transition: 'transform 0.15s, outline 0.15s',
                    }}
                  />
                ))}
              </div>
              {/* Preview */}
              <div style={{ marginTop: '12px', padding: '8px 12px', borderRadius: '6px', backgroundColor: modalColor, color: 'white', fontSize: '0.85rem', fontWeight: 600, display: 'inline-block' }}>
                {modalTitle || 'Pré-visualização'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              {editingEvent && !editingEvent.isExternal && (
                <button
                  onClick={() => { setIsModalOpen(false); handleDeleteEvent(editingEvent.id); }}
                  style={{ padding: '12px', backgroundColor: 'transparent', color: '#ea4335', border: '1px solid #ea4335', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Trash2 size={16} /> Eliminar
                </button>
              )}
              <button
                onClick={handleSaveEvent}
                style={{ flex: 1, padding: '14px', backgroundColor: modalColor, color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, fontSize: '1.05rem' }}
              >
                {editingEvent ? 'Guardar Alterações' : 'Gravar no Calendário'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: Math.min(contextMenu.y, window.innerHeight - 160) + 'px',
            left: Math.min(contextMenu.x, window.innerWidth - 200) + 'px',
            backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            zIndex: 2000, minWidth: '190px', padding: '6px 0', animation: 'fadeIn 0.12s ease-out',
          }}
        >
          {contextMenu.type === 'cell' && (
            <>
              <div className="ctx-item" onClick={() => { setContextMenu(null); openCreateModal(contextMenu.date); }}>
                <Plus size={14} style={{ marginRight: '8px' }} /> Novo Evento aqui
              </div>
              <div className="ctx-item" onClick={() => { setContextMenu(null); setCurrentDate(contextMenu.date!); setView('day'); }}>
                📅 Ver este dia
              </div>
            </>
          )}
          {contextMenu.type === 'event' && contextMenu.event && (
            <>
              {!contextMenu.event.isExternal && (
                <div className="ctx-item" onClick={() => { setContextMenu(null); openEditModal(contextMenu.event!); }}>
                  <Edit2 size={14} style={{ marginRight: '8px' }} /> Editar Evento
                </div>
              )}
              <div className="ctx-item" onClick={() => { setContextMenu(null); setCurrentDate(new Date(contextMenu.event!.start)); setView('day'); }}>
                📅 Ver no dia
              </div>
              {!contextMenu.event.isExternal && (
                <>
                  <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '4px 0' }} />
                  <div className="ctx-item ctx-item-danger" onClick={() => { setContextMenu(null); handleDeleteEvent(contextMenu.event!.id); }}>
                    <Trash2 size={14} style={{ marginRight: '8px' }} /> Eliminar Evento
                  </div>
                </>
              )}
              {contextMenu.event.isExternal && (
                <div style={{ padding: '8px 16px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  Evento externo (só leitura)
                </div>
              )}
            </>
          )}
        </div>
      )}

      <style>{`
        .ctx-item { padding: 9px 16px; font-size: 0.9rem; color: var(--text-primary); cursor: pointer; display: flex; align-items: center; transition: background-color 0.1s; }
        .ctx-item:hover { background-color: var(--accent); color: white; }
        .ctx-item-danger:hover { background-color: #ea4335 !important; color: white !important; }
      `}</style>
    </div>
  );
}
