import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckSquare, Square } from 'lucide-react';

export default function TodoList() {
  const [todos, setTodos] = useState<any[]>([]);
  const [newTask, setNewTask] = useState('');

  const loadTodos = async () => {
    try {
      if (window.electronAPI && window.electronAPI.getTodos) {
        const res = await window.electronAPI.getTodos();
        if (res.success && res.data) setTodos(res.data);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadTodos(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    try {
      if (window.electronAPI && window.electronAPI.addTodo) {
        await window.electronAPI.addTodo(newTask.trim());
        setNewTask('');
        loadTodos();
      }
    } catch(err) { console.error(err); }
  };

  const toggleTodo = async (id: number, currentStatus: boolean) => {
    try {
      if (window.electronAPI && window.electronAPI.toggleTodo) {
        await window.electronAPI.toggleTodo(id, !currentStatus);
        loadTodos();
      }
    } catch(err) { console.error(err); }
  };

  const deleteTodo = async (id: number) => {
    try {
      if (window.electronAPI && window.electronAPI.deleteTodo) {
        await window.electronAPI.deleteTodo(id);
        loadTodos();
      }
    } catch(err) { console.error(err); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1.5rem', animation: 'fadeIn 0.3s' }}>
      <div style={{ padding: '0 8px' }}>
        <h2 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--text-primary)' }}>As Minhas Tarefas</h2>
        <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>Organize o seu dia de forma eficiente.</p>
      </div>

      <form onSubmit={handleAdd} style={{ display: 'flex', gap: '12px' }}>
        <input 
          type="text" 
          value={newTask} 
          onChange={(e) => setNewTask(e.target.value)} 
          placeholder="Escreva uma nova tarefa e pressione Enter..." 
          className="modern-input" 
          style={{ flex: 1, padding: '16px', fontSize: '1.05rem', boxShadow: 'var(--shadow-sm)' }}
        />
        <button type="submit" style={{ 
          padding: '0 24px', backgroundColor: 'var(--accent)', color: 'white', 
          border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'var(--shadow-md)'
        }}>
          <Plus size={24} /> Criar
        </button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1 }}>
        {todos.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px dashed var(--border)' }}>
            <CheckSquare size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
            <p style={{ fontSize: '1.2rem', fontWeight: 500, color: 'var(--text-primary)' }}>Sem tarefas agendadas!</p>
            <p style={{ marginTop: '8px' }}>Pode relaxar um pouco :)</p>
          </div>
        )}
        {todos.map(t => (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px', backgroundColor: 'var(--bg-secondary)', 
            borderRadius: '12px', border: '1px solid var(--border)',
            opacity: t.is_completed ? 0.6 : 1, transition: 'all 0.2s',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', flex: 1 }} onClick={() => toggleTodo(t.id, t.is_completed)}>
              {t.is_completed ? <CheckSquare size={24} color="var(--accent)" /> : <Square size={24} color="var(--text-secondary)" />}
              <span style={{ fontSize: '1.1rem', color: t.is_completed ? 'var(--text-secondary)' : 'var(--text-primary)', fontWeight: 500, textDecoration: t.is_completed ? 'line-through' : 'none' }}>
                {t.task}
              </span>
            </div>
            <button onClick={() => deleteTodo(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '8px', opacity: 0.7 }} title="Apagar Tarefa">
              <Trash2 size={20} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
