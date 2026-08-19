import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';
import { db } from './services/firebase';

interface Registro {
  id: string;
  codigo: string;
  titulo: string;
  area: string;
  estado: string;
}

export function App() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [titulo, setTitulo] = useState('');
  const [area, setArea] = useState('PRODUCCION');
  const [guardando, setGuardando] = useState(false);

  // Escuchar toda la colección en tiempo real
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'registros'), (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        codigo: doc.data().codigo || 'S/C',
        titulo: doc.data().titulo || '',
        area: doc.data().area || 'GENERAL',
        estado: doc.data().estado || 'PENDIENTE',
      })) as Registro[];
      
      setRegistros(docs);
    });

    return () => unsubscribe();
  }, []);

  // Guardar nuevo registro
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return;

    setGuardando(true);
    try {
      const nuevoCodigo = `REG-${Math.floor(1000 + Math.random() * 9000)}`;
      await addDoc(collection(db, 'registros'), {
        codigo: nuevoCodigo,
        titulo: titulo.trim(),
        area,
        estado: 'PENDIENTE',
        createdAt: Date.now(),
      });
      setTitulo('');
    } catch (error) {
      console.error('Error al guardar:', error);
      alert('Error al guardar en Firebase');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '2rem auto', fontFamily: 'sans-serif', padding: '0 1rem' }}>
      <header style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '2rem', textAlign: 'center' }}>
        <h1 style={{ color: '#0f172a', margin: 0, fontSize: '2rem' }}>Proceso PWA</h1>
        <p style={{ color: '#64748b', margin: '0.5rem 0 0 0' }}>Panel de Control y Registro de Procesos</p>
      </header>

      {/* Formulario */}
      <section style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginTop: 0, textAlign: 'center' }}>Nuevo Registro</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              Descripción / Tarea:
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej. Revisión de parámetros"
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              Área:
            </label>
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box', background: '#fff' }}
            >
              <option value="PRODUCCION">Producción</option>
              <option value="CALIDAD">Calidad</option>
              <option value="MANTENIMIENTO">Mantenimiento</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={guardando}
            style={{ 
              background: guardando ? '#94a3b8' : '#0284c7', 
              color: '#fff', 
              padding: '0.6rem 1.2rem', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: guardando ? 'not-allowed' : 'pointer', 
              fontWeight: 600, 
              alignSelf: 'flex-start' 
            }}
          >
            {guardando ? 'Guardando...' : '+ Guardar en la Nube'}
          </button>
        </form>
      </section>

      {/* Tabla con contador corregido */}
      <section>
        <h2 style={{ fontSize: '1.1rem', textAlign: 'center', marginBottom: '1rem' }}>
          Registros Activos ( {registros.length} )
        </h2>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '0.75rem' }}>Código</th>
                <th style={{ padding: '0.75rem' }}>Descripción</th>
                <th style={{ padding: '0.75rem' }}>Área</th>
                <th style={{ padding: '0.75rem' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {registros.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>
                    No hay registros aún.
                  </td>
                </tr>
              ) : (
                registros.map((reg) => (
                  <tr key={reg.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>{reg.codigo}</td>
                    <td style={{ padding: '0.75rem' }}>{reg.titulo}</td>
                    <td style={{ padding: '0.75rem' }}>{reg.area}</td>
                    <td style={{ padding: '0.75rem', color: '#d97706', fontWeight: 600 }}>{reg.estado}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default App;