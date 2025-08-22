import React, { useEffect, useMemo, useState } from "react";

// ===== Utilidades =====
const abc = (n) => Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const uid = () => Math.random().toString(36).slice(2, 10);

const STORAGE_KEY = "bodega_mapa_v1";

// ====== App ======
export default function BodegaMapa() {
  const [cfg, setCfg] = useState(() => ({ pasillos: 4, estantesPorPasillo: 4, casillasPorEstante: 6 }));
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null); // {p, e, c}
  const [panel, setPanel] = useState("mapa"); // mapa | items | ajustes

  // cargar / guardar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.cfg) setCfg(parsed.cfg);
        if (parsed?.items) setItems(parsed.items);
      }
    } catch (e) {}
  }, []);
  useEffect(() => {
    const data = { cfg, items };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [cfg, items]);

  const letrasEstantes = useMemo(() => abc(cfg.estantesPorPasillo), [cfg.estantesPorPasillo]);
  const casillas = useMemo(() => Array.from({ length: cfg.casillasPorEstante }, (_, i) => i + 1), [cfg.casillasPorEstante]);

  const ubicacionAString = (u) => `P${u.p}-E${letrasEstantes[u.e - 1]}-C${u.c}`;

  const itemsFiltrados = useMemo(() => {
    if (!q.trim()) return items;
    const t = q.toLowerCase();
    return items.filter((it) =>
      [it.nombre, it.descripcion, it.tags?.join(" "), ubicacionAString(it.ubicacion)]
        .filter(Boolean)
        .some((s) => s.toLowerCase().includes(t))
    );
  }, [items, q]);

  const itemsEnSel = useMemo(() => {
    if (!sel) return [];
    return items.filter((it) =>
      it.ubicacion.p === sel.p && it.ubicacion.e === sel.e && it.ubicacion.c === sel.c
    );
  }, [items, sel]);

  // ===== Acciones =====
  const agregarItem = (data) => {
    const nuevo = { id: uid(), nombre: data.nombre?.trim() || "(Sin nombre)", descripcion: data.descripcion?.trim() || "", ubicacion: data.ubicacion, tags: (data.tags || []).map((t) => t.trim()).filter(Boolean) };
    setItems((prev) => [nuevo, ...prev]);
  };
  const borrarItem = (id) => setItems((prev) => prev.filter((x) => x.id !== id));
  const moverItem = (id, nuevaUbi) => setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ubicacion: nuevaUbi } : x)));
  const vaciarTodo = () => {
    if (!confirm("¿Seguro que deseas borrar TODOS los items?")) return;
    setItems([]);
  };

  const exportarJSON = () => {
    const blob = new Blob([JSON.stringify({ cfg, items }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bodega_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importarJSON = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data?.cfg && data?.items) {
          setCfg({
            pasillos: clamp(Number(data.cfg.pasillos) || 1, 1, 50),
            estantesPorPasillo: clamp(Number(data.cfg.estantesPorPasillo) || 1, 1, 26),
            casillasPorEstante: clamp(Number(data.cfg.casillasPorEstante) || 1, 1, 200),
          });
          setItems(Array.isArray(data.items) ? data.items : []);
          alert("Datos importados correctamente");
        } else alert("Archivo inválido");
      } catch (e) {
        alert("No se pudo leer el archivo");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">📦 Mapa de Bodega</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Busqueda q={q} setQ={setQ} />
            <button onClick={() => setPanel("mapa")} className={btn(panel === "mapa")}>Mapa</button>
            <button onClick={() => setPanel("items")} className={btn(panel === "items")}>Items</button>
            <button onClick={() => setPanel("ajustes")} className={btn(panel === "ajustes")}>Ajustes</button>
            <button onClick={exportarJSON} className="px-3 py-2 rounded-xl bg-white shadow hover:shadow-md border">Exportar</button>
            <label className="px-3 py-2 rounded-xl bg-white shadow hover:shadow-md border cursor-pointer">
              Importar
              <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importarJSON(e.target.files[0])} />
            </label>
          </div>
        </header>

        {panel === "ajustes" && (
          <Ajustes cfg={cfg} setCfg={setCfg} letrasEstantes={letrasEstantes} />
        )}

        {panel === "mapa" && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2">
              <Mapa
                cfg={cfg}
                letrasEstantes={letrasEstantes}
                casillas={casillas}
                sel={sel}
                setSel={setSel}
              />
            </div>
            <div className="xl:col-span-1">
              <PanelDerecho sel={sel} letrasEstantes={letrasEstantes} items={itemsEnSel} onAdd={(d) => agregarItem({ ...d, ubicacion: sel })} onDelete={borrarItem} onMove={moverItem} cfg={cfg} />
            </div>
          </div>
        )}

        {panel === "items" && (
          <ListaItems items={itemsFiltrados} q={q} setQ={setQ} moverItem={moverItem} borrarItem={borrarItem} cfg={cfg} letrasEstantes={letrasEstantes} />
        )}

        <footer className="mt-8 text-sm text-slate-500">Guardado automático en este navegador. Exporta un respaldo si es importante.</footer>
      </div>
    </div>
  );
}

// ===== Componentes =====
function Busqueda({ q, setQ }) {
  return (
    <div className="flex items-center gap-2 bg-white rounded-xl border px-3 py-2 shadow-inner">
      <span>🔎</span>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, etiqueta o ubicación…" className="outline-none w-64 md:w-80" />
      {q && (
        <button onClick={() => setQ("")} className="text-slate-500 hover:text-slate-700">✕</button>
      )}
    </div>
  );
}

function Ajustes({ cfg, setCfg, letrasEstantes }) {
  const [local, setLocal] = useState(cfg);
  useEffect(() => setLocal(cfg), [cfg]);

  const aplicar = () => {
    setCfg({
      pasillos: clamp(Number(local.pasillos) || 1, 1, 50),
      estantesPorPasillo: clamp(Number(local.estantesPorPasillo) || 1, 1, 26),
      casillasPorEstante: clamp(Number(local.casillasPorEstante) || 1, 1, 200),
    });
  };

  return (
    <div className="bg-white border rounded-2xl p-4 shadow-sm">
      <h2 className="text-xl font-semibold mb-3">Ajustar estructura de la bodega</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Num label="Pasillos" value={local.pasillos} onChange={(v) => setLocal({ ...local, pasillos: v })} min={1} max={50} />
        <Num label="Estantes por pasillo" value={local.estantesPorPasillo} onChange={(v) => setLocal({ ...local, estantesPorPasillo: v })} min={1} max={26} />
        <Num label="Casillas por estante" value={local.casillasPorEstante} onChange={(v) => setLocal({ ...local, casillasPorEstante: v })} min={1} max={200} />
      </div>
      <div className="mt-3 text-sm text-slate-600">Estantes se nombrarán: {letrasEstantes.join(", ") || "(ninguno)"}</div>
      <div className="mt-4 flex gap-2">
        <button onClick={aplicar} className="px-4 py-2 bg-slate-900 text-white rounded-xl hover:opacity-90">Aplicar cambios</button>
        <button onClick={() => setLocal(cfg)} className="px-3 py-2 border rounded-xl bg-white">Revertir</button>
      </div>
    </div>
  );
}

function Num({ label, value, onChange, min=1, max=100 }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-slate-600">{label}</span>
      <input type="number" value={value} min={min} max={max} onChange={(e) => onChange(Number(e.target.value))} className="px-3 py-2 border rounded-xl" />
    </label>
  );
}

function Mapa({ cfg, letrasEstantes, casillas, sel, setSel }) {
  return (
    <div className="bg-white border rounded-2xl p-4 shadow-sm">
      <h2 className="text-lg font-semibold mb-3">Mapa visual</h2>
      <div className="overflow-auto">
        <div className="min-w-[640px] grid" style={{ gridTemplateColumns: `repeat(${cfg.pasillos}, minmax(180px, 1fr))`, gap: "12px" }}>
          {Array.from({ length: cfg.pasillos }, (_, p) => (
            <div key={p} className="border rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-slate-100 font-medium">Pasillo {p + 1}</div>
              <div className="divide-y">
                {letrasEstantes.map((L, ei) => (
                  <div key={L} className="">
                    <div className="px-3 py-1 text-sm text-slate-600 bg-slate-50">Estante {L}</div>
                    <div className="grid grid-cols-6 gap-2 p-2">
                      {casillas.map((c) => {
                        const activo = sel && sel.p === p + 1 && sel.e === ei + 1 && sel.c === c;
                        return (
                          <button
                            key={c}
                            onClick={() => setSel({ p: p + 1, e: ei + 1, c })}
                            className={`aspect-square rounded-lg border text-xs flex items-center justify-center hover:border-slate-700 ${activo ? "ring-2 ring-slate-900 border-slate-900" : ""}`}
                            title={`Pasillo ${p + 1} · Estante ${L} · Casilla ${c}`}
                          >
                            C{c}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 text-sm text-slate-600">Haz clic en una casilla para ver o agregar contenido.</div>
    </div>
  );
}

function PanelDerecho({ sel, letrasEstantes, items, onAdd, onDelete, onMove, cfg }) {
  if (!sel) return (
    <div className="bg-white border rounded-2xl p-4 shadow-sm text-slate-600">Selecciona una casilla en el mapa para ver/gestionar sus items.</div>
  );

  const label = `Pasillo ${sel.p} · Estante ${letrasEstantes[sel.e - 1]} · Casilla ${sel.c}`;

  return (
    <div className="bg-white border rounded-2xl p-4 shadow-sm">
      <h2 className="text-lg font-semibold mb-2">{label}</h2>
      <NuevoItem onAdd={onAdd} />
      <div className="mt-4">
        {items.length === 0 ? (
          <div className="text-sm text-slate-600">No hay items aquí todavía.</div>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.id} className="border rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{it.nombre}</div>
                    {it.descripcion && <div className="text-sm text-slate-600">{it.descripcion}</div>}
                    {it.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">{it.tags.map((t) => <span key={t} className="text-xs bg-slate-100 px-2 py-0.5 rounded-full border">#{t}</span>)}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Mover it={it} cfg={cfg} onMove={onMove} />
                    <button onClick={() => onDelete(it.id)} className="px-2 py-1 text-sm border rounded-lg hover:bg-slate-50">Borrar</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NuevoItem({ onAdd }) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tags, setTags] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    onAdd({ nombre, descripcion, tags: tags.split(",") });
    setNombre("");
    setDescripcion("");
    setTags("");
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-2">
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del item (obligatorio)" className="px-3 py-2 border rounded-xl" />
      <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción (opcional)" className="px-3 py-2 border rounded-xl" />
      <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Etiquetas separadas por coma: herramienta, repuesto" className="px-3 py-2 border rounded-xl" />
      <div className="flex gap-2">
        <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-xl hover:opacity-90">Agregar</button>
        <button type="button" className="px-3 py-2 border rounded-xl" onClick={() => { setNombre(""); setDescripcion(""); setTags(""); }}>Limpiar</button>
      </div>
    </form>
  );
}

function ListaItems({ items, q, setQ, moverItem, borrarItem, cfg, letrasEstantes }) {
  const [pag, setPag] = useState(1);
  const porPag = 15;
  const totalPag = Math.max(1, Math.ceil(items.length / porPag));
  const pageItems = items.slice((pag - 1) * porPag, pag * porPag);

  useEffect(() => { if (pag > totalPag) setPag(totalPag); }, [items, totalPag]);

  const ubicStr = (u) => `P${u.p}-E${letrasEstantes[u.e - 1]}-C${u.c}`;

  return (
    <div className="bg-white border rounded-2xl p-4 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold">Todos los items ({items.length})</h2>
        <Busqueda q={q} setQ={setQ} />
      </div>
      <div className="overflow-auto">
        <table className="min-w-[720px] w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <Th>Nombre</Th>
              <Th>Descripción</Th>
              <Th>Etiquetas</Th>
              <Th>Ubicación</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pageItems.map((it) => (
              <tr key={it.id} className="">
                <Td className="font-medium">{it.nombre}</Td>
                <Td>{it.descripcion}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">{it.tags?.map((t) => <span key={t} className="px-2 py-0.5 border rounded-full">#{t}</span>)}</div>
                </Td>
                <Td>{ubicStr(it.ubicacion)}</Td>
                <Td>
                  <div className="flex gap-2">
                    <Mover it={it} cfg={cfg} onMove={moverItem} />
                    <button onClick={() => borrarItem(it.id)} className="px-2 py-1 border rounded-lg hover:bg-slate-50">Borrar</button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-slate-600">Página {pag} de {totalPag}</div>
        <div className="flex gap-2">
          <button onClick={() => setPag((p) => clamp(p - 1, 1, totalPag))} className="px-3 py-1.5 border rounded-lg">Anterior</button>
          <button onClick={() => setPag((p) => clamp(p + 1, 1, totalPag))} className="px-3 py-1.5 border rounded-lg">Siguiente</button>
        </div>
      </div>

      <div className="mt-4">
        <button onClick={vaciarTodoGlobal} className="px-3 py-2 border rounded-xl">Vaciar todo</button>
      </div>
    </div>
  );

  function vaciarTodoGlobal() {
    if (!confirm("¿Seguro que deseas borrar TODOS los items?")) return;
    const ev = new CustomEvent("vaciar-todo");
    window.dispatchEvent(ev);
  }
}

function Th({ children }) { return <th className="text-left px-3 py-2 font-medium">{children}</th>; }
function Td({ children, className="" }) { return <td className={`px-3 py-2 ${className}`}>{children}</td>; }

function Mover({ it, cfg, onMove }) {
  const [p, setP] = useState(it.ubicacion.p);
  const [e, setE] = useState(it.ubicacion.e);
  const [c, setC] = useState(it.ubicacion.c);
  useEffect(() => { setP(it.ubicacion.p); setE(it.ubicacion.e); setC(it.ubicacion.c); }, [it.id]);

  return (
    <div className="flex items-center gap-1 text-xs">
      <select className="border rounded-lg px-2 py-1" value={p} onChange={(ev) => setP(Number(ev.target.value))}>
        {Array.from({ length: cfg.pasillos }, (_, i) => <option key={i+1} value={i+1}>P{i+1}</option>)}
      </select>
      <select className="border rounded-lg px-2 py-1" value={e} onChange={(ev) => setE(Number(ev.target.value))}>
        {Array.from({ length: cfg.estantesPorPasillo }, (_, i) => <option key={i+1} value={i+1}>E{String.fromCharCode(65+i)}</option>)}
      </select>
      <select className="border rounded-lg px-2 py-1" value={c} onChange={(ev) => setC(Number(ev.target.value))}>
        {Array.from({ length: cfg.casillasPorEstante }, (_, i) => <option key={i+1} value={i+1}>C{i+1}</option>)}
      </select>
      <button onClick={() => onMove(it.id, { p, e, c })} className="px-2 py-1 border rounded-lg hover:bg-slate-50">Mover</button>
    </div>
  );
}

// escucha global para "vaciar todo"
if (typeof window !== "undefined") {
  window.addEventListener("vaciar-todo", () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    try {
      const parsed = JSON.parse(raw || "{}");
      const toSave = { ...(parsed || {}), items: [] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      // Fuerza refresco suave
      window.dispatchEvent(new Event("storage"));
    } catch {}
  });
}

function btn(active) {
  return `px-3 py-2 rounded-xl border ${active ? "bg-slate-900 text-white" : "bg-white hover:shadow"}`;
}
