import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Printer, Plus, Trash2, LayoutTemplate, 
  PanelRightClose, PanelRightOpen, Palette, Loader2, Link as LinkIcon, Edit2, Check,
  X, MessageSquare, Settings, Send, Bot, ChevronLeft, ChevronRight
} from 'lucide-react';

const loadSettings = () => {
  try {
    const saved = localStorage.getItem('rapid-sop-settings');
    if (saved) return JSON.parse(saved);
  } catch {}
  return {
    systemPrompt: `Anda adalah asisten ahli pembuat SOP (Standar Operasional Prosedur) perusahaan.
Buatlah narasi SOP lengkap dan realistis sesuai judul yang diberikan.
Jangan gunakan kalimat template. Buat konten spesifik sesuai industri/bidang dokumen tersebut.

Kembalikan jawaban DALAM FORMAT JSON dengan struktur:
{
  "tujuan": "Tujuan spesifik dari SOP ini...",
  "ruangLingkup": "Batasan dan lingkup departemen yang terlibat...",
  "ringkasan": "Ringkasan alur kerja secara singkat...",
  "definisi": "Definisi istilah teknis yang relevan...",
  "landasanHukum": "UU, Peraturan, atau standar ISO yang relevan...",
  "perlengkapan": "Alat kerja, software, atau mesin yang dibutuhkan..."
}`,
    flowPrompt: `Anda adalah asisten ahli pembuat tabel alur (flowchart) SOP.
Buatlah tabel alur yang lengkap dengan simbol-simbol flowchart untuk SOP yang diminta.

Kembalikan jawaban DALAM FORMAT JSON dengan struktur:
{
  "rows": [
    {
      "text": "Uraian kegiatan langkah demi langkah",
      "doc": "Dokumen output (Form/Laporan)",
      "note": "Catatan atau keterangan",
      "symbols": [
        { "itemId": "terminal|process|decision|document|manual|input", "picTarget": "Nama Pelaksana" }
      ]
    }
  ]
}`
  };
};

const generateChatResponse = async (messages, systemPrompt) => {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek/deepseek-chat:free',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ],
      max_tokens: 8192
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errText}`);
  }

  const result = await response.json();
  const text = result.choices?.[0]?.message?.content;
  if (!text) throw new Error('Respons AI kosong.');
  return text;
};

const exportToDocx = () => {
  const el = document.getElementById('sop-document');
  if (!el) return;
  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8"><title>Dokumen SOP</title>
<style>table,td,th{border:1px solid black;border-collapse:collapse}body{font-family:Arial,sans-serif;font-size:12px;padding:40px}
img{max-width:100%;height:auto}</style></head>
<body>${el.innerHTML}</body></html>`;
  const blob = new Blob([html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Dokumen_SOP.doc';
  a.click();
  URL.revokeObjectURL(url);
};

const renderMarkdown = (text) => {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const html = escaped
    .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre class="bg-gray-100 p-2 rounded text-xs overflow-x-auto my-1">$2</pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 rounded text-xs">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
  return html;
};

const extractJsonFromResponse = (text) => {
  const block = text.match(/```(?:json)?\n?([\s\S]*?)```/);
  if (block) {
    try { return JSON.parse(block[1].trim()); } catch {}
  }
  const jsonStart = text.indexOf('{');
  if (jsonStart !== -1) {
    try { return JSON.parse(text.slice(jsonStart).replace(/[^}]*$/, '')); } catch {}
  }
  try { return JSON.parse(text.trim()); } catch {}
  return null;
};

const Shapes = {
  terminal: () => <svg viewBox="0 0 40 40" className="w-6 h-6"><rect x="4" y="10" width="32" height="20" rx="10" stroke="currentColor" fill="white" strokeWidth="2"/></svg>,
  manual: () => <svg viewBox="0 0 40 40" className="w-6 h-6"><polygon points="4,10 36,10 30,30 10,30" stroke="currentColor" fill="white" strokeWidth="2"/></svg>,
  process: () => <svg viewBox="0 0 40 40" className="w-6 h-6"><rect x="6" y="10" width="28" height="20" stroke="currentColor" fill="white" strokeWidth="2"/></svg>,
  decision: () => <svg viewBox="0 0 40 40" className="w-6 h-6"><polygon points="20,4 36,20 20,36 4,20" stroke="currentColor" fill="white" strokeWidth="2"/></svg>,
  input: () => <svg viewBox="0 0 40 40" className="w-6 h-6"><polygon points="4,16 36,10 36,30 4,30" stroke="currentColor" fill="white" strokeWidth="2"/></svg>,
  document: () => <svg viewBox="0 0 40 40" className="w-6 h-6"><path d="M6,8 L34,8 L34,26 Q27,36 20,26 T6,26 Z" stroke="currentColor" fill="white" strokeWidth="2"/></svg>,
  multidoc: () => <svg viewBox="0 0 40 40" className="w-6 h-6"><path d="M10,4 L38,4 L38,22 Q31,32 24,22 T10,22 Z" stroke="currentColor" fill="white" strokeWidth="2"/><path d="M4,10 L32,10 L32,28 Q25,38 18,28 T4,28 Z" stroke="currentColor" fill="white" strokeWidth="2"/></svg>,
  note: () => <svg viewBox="0 0 40 40" className="w-6 h-6"><path d="M16,6 L6,6 L6,34 L16,34" stroke="currentColor" fill="none" strokeWidth="2"/><line x1="6" y1="20" x2="34" y2="20" stroke="currentColor" strokeWidth="2" strokeDasharray="4"/></svg>,
  tempfile: () => <svg viewBox="0 0 40 40" className="w-6 h-6"><polygon points="6,10 34,10 20,32" stroke="currentColor" fill="white" strokeWidth="2"/></svg>,
  permfile: () => <svg viewBox="0 0 40 40" className="w-6 h-6"><polygon points="20,8 34,30 6,30" stroke="currentColor" fill="white" strokeWidth="2"/></svg>,
  tape: () => <svg viewBox="0 0 40 40" className="w-6 h-6"><circle cx="20" cy="20" r="12" stroke="currentColor" fill="white" strokeWidth="2"/><path d="M20,32 Q36,40 36,24" stroke="currentColor" fill="none" strokeWidth="2"/></svg>,
  disk: () => <svg viewBox="0 0 40 40" className="w-6 h-6"><path d="M8,12 A12,4 0 0,1 32,12 L32,28 A12,4 0 0,1 8,28 Z" stroke="currentColor" fill="white" strokeWidth="2"/><ellipse cx="20" cy="12" rx="12" ry="4" stroke="currentColor" fill="none" strokeWidth="2"/></svg>,
  onpage: () => <svg viewBox="0 0 40 40" className="w-6 h-6"><circle cx="20" cy="20" r="10" stroke="currentColor" fill="white" strokeWidth="2"/></svg>,
  offpage: () => <svg viewBox="0 0 40 40" className="w-6 h-6"><polygon points="10,6 30,6 30,22 20,34 10,22" stroke="currentColor" fill="white" strokeWidth="2"/></svg>,
};

const Lines = {
  arrowRight: () => <svg viewBox="0 0 40 40" className="w-6 h-6"><path d="M6,20 L34,20 M26,12 L34,20 L26,28" stroke="currentColor" fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/></svg>,
  arrowDown: () => <svg viewBox="0 0 40 40" className="w-6 h-6"><path d="M20,6 L20,34 M12,26 L20,34 L28,26" stroke="currentColor" fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/></svg>,
  arrowLeft: () => <svg viewBox="0 0 40 40" className="w-6 h-6"><path d="M34,20 L6,20 M14,12 L6,20 L14,28" stroke="currentColor" fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/></svg>,
  solidRight: () => <svg viewBox="0 0 40 40" className="w-6 h-6"><line x1="6" y1="20" x2="34" y2="20" stroke="currentColor" strokeWidth="2"/></svg>,
  solidDown: () => <svg viewBox="0 0 40 40" className="w-6 h-6"><line x1="20" y1="6" x2="20" y2="34" stroke="currentColor" strokeWidth="2"/></svg>,
  dashedRight: () => <svg viewBox="0 0 40 40" className="w-6 h-6"><line x1="6" y1="20" x2="34" y2="20" stroke="currentColor" strokeWidth="2" strokeDasharray="5,5"/></svg>,
  dashedDown: () => <svg viewBox="0 0 40 40" className="w-6 h-6"><line x1="20" y1="6" x2="20" y2="34" stroke="currentColor" strokeWidth="2" strokeDasharray="5,5"/></svg>,
};

const SHAPE_OPTIONS = [
  { id: 'terminal', name: 'Mulai/ berakhir (terminal)', Icon: Shapes.terminal },
  { id: 'manual', name: 'Kegiatan manual', Icon: Shapes.manual },
  { id: 'process', name: 'Proses komputerisasi', Icon: Shapes.process },
  { id: 'input', name: 'Pengunci / memasukan', Icon: Shapes.input },
  { id: 'decision', name: 'Keputusan', Icon: Shapes.decision },
  { id: 'document', name: 'Dokumen', Icon: Shapes.document },
  { id: 'multidoc', name: 'Berbagai Dokumen', Icon: Shapes.multidoc },
  { id: 'note', name: 'Catatan', Icon: Shapes.note },
  { id: 'tempfile', name: 'Arsip Sementara', Icon: Shapes.tempfile },
  { id: 'permfile', name: 'Arsip Permanen', Icon: Shapes.permfile },
  { id: 'tape', name: 'Pita magnetik', Icon: Shapes.tape },
  { id: 'disk', name: 'Penyimpan (Database)', Icon: Shapes.disk },
  { id: 'onpage', name: 'Penghubung (Halaman sama)', Icon: Shapes.onpage },
  { id: 'offpage', name: 'Penghubung (Halaman beda)', Icon: Shapes.offpage },
];

const LINE_OPTIONS = [
  { id: 'arrowRight', Icon: Lines.arrowRight },
  { id: 'arrowLeft', Icon: Lines.arrowLeft },
  { id: 'arrowDown', Icon: Lines.arrowDown },
  { id: 'solidRight', Icon: Lines.solidRight },
  { id: 'solidDown', Icon: Lines.solidDown },
  { id: 'dashedRight', Icon: Lines.dashedRight },
  { id: 'dashedDown', Icon: Lines.dashedDown },
];

const FieldInput = ({ label, name, value, onSave, type = 'text', placeholder, isTextArea = false, rows = 3 }) => {
  const [isEditing, setIsEditing] = useState(!value);
  const [localValue, setLocalValue] = useState(value || '');

  useEffect(() => {
    setLocalValue(value || '');
    if (value) setIsEditing(false);
  }, [value]);

  const handleSaveClick = () => {
    onSave(name, localValue);
    setIsEditing(false);
  };

  return (
    <div className="mb-4">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">{label}</label>
      {isEditing ? (
        <div className="relative">
          {isTextArea ? (
            <textarea 
              value={localValue} 
              onChange={e => setLocalValue(e.target.value)} 
              placeholder={placeholder} 
              rows={rows} 
              className="w-full bg-white border-2 border-blue-300 text-gray-800 rounded-xl px-4 py-3 pr-12 outline-none focus:border-blue-500 transition-all duration-200 min-h-[100px] resize-y shadow-sm" 
            />
          ) : (
            <input 
              type={type} 
              value={localValue} 
              onChange={e => setLocalValue(e.target.value)} 
              placeholder={placeholder} 
              className="w-full bg-white border-2 border-blue-300 text-gray-800 rounded-xl px-4 py-3 pr-12 outline-none focus:border-blue-500 transition-all duration-200 shadow-sm" 
            />
          )}
          <button 
            onClick={handleSaveClick} 
            className="absolute right-2 top-2 bg-blue-600 text-white hover:bg-blue-700 p-1.5 rounded-lg shadow-sm transition-colors"
            title="Simpan"
          >
            <Check className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="relative group">
          <div className={`w-full bg-gray-50 text-gray-700 rounded-xl px-4 py-3 border border-transparent group-hover:border-gray-200 transition-colors ${isTextArea ? 'min-h-[100px] whitespace-pre-wrap' : 'min-h-[48px]'}`}>
            {value || <span className="text-gray-400 italic">Kosong...</span>}
          </div>
          <button 
            onClick={() => setIsEditing(true)} 
            className="absolute right-2 top-2 text-gray-500 hover:text-blue-600 bg-white border border-gray-200 shadow-sm p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState('form');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    localStorage.setItem('rapid-sop-settings', JSON.stringify(settings));
  }, [settings]);

  const [formData, setFormData] = useState({
    nomorDokumen: '', namaDokumen: '', penyusun: '', direktorat: '', divisi: '', revisi: '0', tanggal: '',
    kabag: '', pimpinan: '', tujuan: '', ruangLingkup: '', ringkasan: '', definisi: '', landasanHukum: '',
    keterkaitan: '', kualifikasi: '', perlengkapan: '', peringatan: '', formulir: ''
  });

  const [flowRows, setFlowRows] = useState([
    { id: 1, symbols: [{ id: 's1', type: 'shape', itemId: 'terminal', color: '#1f2937', picTarget: 'Admin' }], text: 'Mulai proses bisnis', doc: '-', note: '' },
    { id: 2, symbols: [{ id: 's2', type: 'shape', itemId: 'process', color: '#1f2937', picTarget: 'Admin' }], text: 'Melakukan input data', doc: 'Form Data', note: '' },
    { id: 3, symbols: [{ id: 's3', type: 'shape', itemId: 'decision', color: '#1f2937', picTarget: 'Manager' }], text: 'Validasi data?', doc: '-', note: 'Ya / Tidak' },
    { id: 4, symbols: [{ id: 's4', type: 'shape', itemId: 'terminal', color: '#1f2937', picTarget: 'Manager' }], text: 'Selesai', doc: '-', note: '' }
  ]);

  const [flowConnections, setFlowConnections] = useState([]);
  const [activeRowId, setActiveRowId] = useState(1);
  const [selectedColor, setSelectedColor] = useState('#1f2937');
  const [menuOpen, setMenuOpen] = useState(null);
  const [picPrompt, setPicPrompt] = useState(null);
  const [linePrompt, setLinePrompt] = useState(null);

  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Halo! Saya asisten SOP AI.\n\nGunakan perintah berikut:\n- **#Formulir** — buat konten formulir SOP\n- **#Tabel** — buat tabel alur / matriks tanggung jawab\n- **#Formulir #Tabel** — buat keduanya sekaligus\n\nContoh:\n`Buat SOP pembelian barang #Formulir #Tabel`\n\nApa yang ingin Anda buat hari ini?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const existingPics = Array.from(new Set(flowRows.flatMap(r => r.symbols.map(s => s.picTarget)).filter(Boolean)));
  const generateId = () => Math.random().toString(36).substr(2, 9);

  const handleFieldSave = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const updateFlowRow = (id, field, value) => {
    setFlowRows(flowRows.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const addFlowRow = () => {
    const newId = generateId();
    setFlowRows([...flowRows, { id: newId, symbols: [], text: '', doc: '', note: '' }]);
    setActiveRowId(newId);
  };

  const deleteFlowRow = (id) => {
    setFlowRows(flowRows.filter(row => row.id !== id));
    setFlowConnections(conns => conns.filter(c => c.sourceRowId !== id && c.targetRowId !== id));
  };

  const handleShapeSelect = (itemId) => {
    if (!activeRowId) return;
    setPicPrompt({ itemId, inputValue: existingPics[0] || 'Admin' });
    setMenuOpen(null);
  };

  const confirmAddShape = () => {
    if (!picPrompt || !picPrompt.inputValue.trim() || !activeRowId) return;
    setFlowRows(rows => rows.map(r => r.id === activeRowId ? {
      ...r,
      symbols: [...r.symbols, { id: generateId(), type: 'shape', itemId: picPrompt.itemId, color: selectedColor, picTarget: picPrompt.inputValue.trim() }]
    } : r));
    setPicPrompt(null);
  };

  const removeSymbol = (rowId, symId) => {
    setFlowRows(rows => rows.map(r => r.id === rowId ? {
      ...r, symbols: r.symbols.filter(s => s.id !== symId)
    } : r));
  };

  const removeConnection = (connId) => {
    setFlowConnections(conns => conns.filter(c => c.id !== connId));
  };

  const openLineDialog = () => {
    if (!activeRowId) return;
    const currentRow = flowRows.find(r => r.id === activeRowId);
    if (!currentRow) return;
    const nextRow = flowRows[flowRows.findIndex(r => r.id === activeRowId) + 1] || currentRow;
    setLinePrompt({
      sourceRowId: activeRowId,
      targetRowId: nextRow.id,
      sourcePic: currentRow.symbols[0]?.picTarget || existingPics[0] || '',
      targetPic: nextRow.symbols[0]?.picTarget || existingPics[0] || '',
      lineType: 'arrowDown',
      label: '',
      color: selectedColor
    });
  };

  const confirmAddConnection = () => {
    if (!linePrompt) return;
    setFlowConnections([...flowConnections, { id: generateId(), ...linePrompt }]);
    setLinePrompt(null);
  };

  const parseTargets = (text) => {
    const targets = [];
    if (/#Formulir/i.test(text)) targets.push('form');
    if (/#Tabel/i.test(text)) targets.push('flow');
    return targets;
  };

  const buildChatSystemPrompt = (targets) => {
    const baseContent = (settings.systemPrompt || '').replace(/Kembalikan jawaban.*$/s, '').trim();
    let prompt = 'Anda adalah asisten ahli pembuat SOP perusahaan yang membantu mengisi dokumen SOP.\n';

    if (targets.includes('form') && targets.includes('flow')) {
      prompt += `${baseContent}\n\nUser meminta KEDUA konten (FORMULIR + TABEL ALUR).
Kembalikan jawaban dengan JSON di blok \`\`\`json yang memiliki struktur:
{
  "form": { "tujuan": "", "ruangLingkup": "", "ringkasan": "", "definisi": "", "landasanHukum": "", "perlengkapan": "" },
  "flow": { "rows": [ { "text": "", "doc": "", "note": "", "symbols": [ { "itemId": "terminal", "picTarget": "" } ] } ] }
}`;
    } else if (targets.includes('form')) {
      prompt += `${settings.systemPrompt || ''}`;
    } else if (targets.includes('flow')) {
      prompt += `${settings.flowPrompt || settings.systemPrompt || ''}`;
    } else {
      prompt += `${settings.systemPrompt || ''}`;
    }
    return prompt;
  };

  const applyJsonToSection = (jsonData, targets) => {
    if (targets.includes('form') && targets.includes('flow')) {
      if (jsonData.form && jsonData.flow) {
        setFormData(prev => ({ ...prev, ...jsonData.form }));
        if (jsonData.flow.rows && Array.isArray(jsonData.flow.rows)) {
          const newRows = jsonData.flow.rows.map(row => ({
            id: generateId(),
            symbols: (row.symbols || []).map(s => ({ ...s, id: generateId(), type: 'shape', color: '#1f2937' })),
            text: row.text || '',
            doc: row.doc || '',
            note: row.note || ''
          }));
          setFlowRows(newRows);
          setActiveRowId(newRows[0]?.id);
        }
        return '✅ Data **Formulir** dan **Tabel Alur** telah diperbarui.';
      }
      if (jsonData.tujuan) setFormData(prev => ({ ...prev, ...jsonData }));
      if (jsonData.rows && Array.isArray(jsonData.rows)) {
        const newRows = jsonData.rows.map(row => ({
          id: generateId(),
          symbols: (row.symbols || []).map(s => ({ ...s, id: generateId(), type: 'shape', color: '#1f2937' })),
          text: row.text || '',
          doc: row.doc || '',
          note: row.note || ''
        }));
        setFlowRows(newRows);
        setActiveRowId(newRows[0]?.id);
      }
      if (jsonData.tujuan || jsonData.rows) return '✅ Data telah diperbarui.';
    } else if (targets.includes('form') && jsonData.tujuan) {
      setFormData(prev => ({ ...prev, ...jsonData }));
      return '✅ Data **Formulir** telah diperbarui.';
    } else if (targets.includes('flow') && jsonData.rows) {
      if (Array.isArray(jsonData.rows)) {
        const newRows = jsonData.rows.map(row => ({
          id: generateId(),
          symbols: (row.symbols || []).map(s => ({ ...s, id: generateId(), type: 'shape', color: '#1f2937' })),
          text: row.text || '',
          doc: row.doc || '',
          note: row.note || ''
        }));
        setFlowRows(newRows);
        setActiveRowId(newRows[0]?.id);
      }
      return '✅ Data **Tabel Alur** telah diperbarui.';
    }
    return '';
  };

  const handleChatSubmit = async () => {
    const msg = chatInput.trim();
    if (!msg || isChatLoading) return;
    setChatInput('');

    setChatMessages(prev => [...prev, { role: 'user', content: msg }]);
    setIsChatLoading(true);

    const targets = parseTargets(msg);
    const sysPrompt = buildChatSystemPrompt(targets);

    const chatHistory = chatMessages.map(m => ({ role: m.role, content: m.content }));
    chatHistory.push({ role: 'user', content: msg });

    try {
      const aiResponse = await generateChatResponse(chatHistory, sysPrompt);
      const jsonData = extractJsonFromResponse(aiResponse);

      let applyMsg = '';
      if (jsonData && targets.length > 0) {
        applyMsg = applyJsonToSection(jsonData, targets);
      }

      setChatMessages(prev => [...prev, { role: 'assistant', content: aiResponse + (applyMsg ? `\n\n${applyMsg}` : '') }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `❌ **Error:** ${error.message}` }]);
    }
    setIsChatLoading(false);
  };

  const handleChatKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmit();
    }
  };

  const displayPics = existingPics.length > 0 ? existingPics : ['Pelaksana'];

  const navItems = [
    { id: 'form', label: 'Formulir Dasar', icon: FileText },
    { id: 'flowchart', label: 'Tabel Alur', icon: LayoutTemplate },
    { id: 'agent', label: 'Agent', icon: MessageSquare },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;600;700&display=swap');
        body { font-family: 'Quicksand', sans-serif; background-color: #F5F5F7; margin: 0; }
        @media print {
          body * { visibility: hidden; }
          #sop-document, #sop-document * { visibility: visible; }
          #sop-document { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; padding: 0; }
          .no-print { display: none !important; }
        }
        .preview-table { width: 100%; border-collapse: collapse; margin-bottom: 20px;}
        .preview-table th, .preview-table td { border: 1px solid #1f2937; padding: 8px; text-align: left; vertical-align: middle; }
        .preview-table th { background-color: #f3f4f6; text-align: center; }
        .swimlane-cell { text-align: center !important; position: relative; height: 60px;}
        .sidebar-scroll::-webkit-scrollbar { width: 4px; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
        .chat-msg p { margin: 0 0 8px 0; }
        .chat-msg code { background: #f3f4f6; padding: 1px 4px; border-radius: 4px; font-size: 0.9em; }
      `}</style>

      <div className="flex h-screen overflow-hidden text-gray-800">
        <aside className={`no-print flex-shrink-0 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${sidebarOpen ? 'w-56' : 'w-0 overflow-hidden'}`}>
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-100 flex-shrink-0">
            {sidebarOpen && (
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="Logo" className="h-8 w-auto" />
              </div>
            )}
            <button onClick={() => setSidebarOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <nav className="flex-1 py-4 px-3 space-y-1 sidebar-scroll overflow-y-auto">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    activeSection === item.id
                      ? 'bg-blue-50 text-blue-700 shadow-sm'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-3 border-t border-gray-100">
            <button
              onClick={() => setSettingsOpen(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all"
            >
              <Settings className="w-5 h-5 flex-shrink-0" />
              <span>Pengaturan</span>
            </button>
          </div>
        </aside>

        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="no-print absolute left-0 top-16 z-20 p-2 bg-white border border-gray-200 rounded-r-xl shadow-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex-shrink-0 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-6 z-10 no-print">
            {sidebarOpen && <div className="w-0" />}
            <div className="flex items-center gap-3">
              {!sidebarOpen && (
                <div className="flex items-center gap-2">
                  <img src="/logo.png" alt="Logo" className="h-8 w-auto" />
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowPreview(!showPreview)} className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-full transition-colors text-sm border border-gray-200">
                {showPreview ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                {showPreview ? 'Sembunyikan Preview' : 'Tampilkan Preview'}
              </button>
              <button onClick={exportToDocx} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-full transition-colors shadow-sm text-sm">
                <FileText className="w-4 h-4" /> Export DOCX
              </button>
              <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full transition-colors shadow-sm text-sm">
                <Printer className="w-4 h-4" /> Cetak / PDF
              </button>
            </div>
          </header>

          <main className="flex-1 flex overflow-hidden">
            <div className={`${showPreview ? 'w-1/2 border-r border-gray-200' : 'w-full max-w-7xl mx-auto'} overflow-y-auto p-6 transition-all duration-300`}>
              <div className={`space-y-6 ${activeSection === 'form' ? 'block' : 'hidden'}`}>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                  <h2 className="text-lg font-bold mb-4">Informasi Dasar & Personil</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <FieldInput label="Nomor Dokumen" name="nomorDokumen" value={formData.nomorDokumen} onSave={handleFieldSave} />
                    <FieldInput label="Nama Dokumen" name="namaDokumen" value={formData.namaDokumen} onSave={handleFieldSave} placeholder="Contoh: Pembelian Barang" />
                    <FieldInput label="Direktorat" name="direktorat" value={formData.direktorat} onSave={handleFieldSave} />
                    <FieldInput label="Divisi" name="divisi" value={formData.divisi} onSave={handleFieldSave} />
                    <FieldInput label="Tanggal Berlaku" name="tanggal" value={formData.tanggal} onSave={handleFieldSave} type="date" />
                    <FieldInput label="Penyusun" name="penyusun" value={formData.penyusun} onSave={handleFieldSave} />
                    <FieldInput label="Kabag" name="kabag" value={formData.kabag} onSave={handleFieldSave} />
                    <FieldInput label="Pimpinan" name="pimpinan" value={formData.pimpinan} onSave={handleFieldSave} />
                  </div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Konten Narasi</h2>
                      <p className="text-xs text-gray-500">Isi manual atau gunakan menu <strong>Agent</strong> di sidebar dengan perintah <code>#Formulir</code>.</p>
                    </div>
                  </div>
                  <FieldInput label="1. Tujuan/Maksud" name="tujuan" value={formData.tujuan} onSave={handleFieldSave} isTextArea />
                  <FieldInput label="2. Ruang Lingkup" name="ruangLingkup" value={formData.ruangLingkup} onSave={handleFieldSave} isTextArea />
                  <FieldInput label="3. Ringkasan" name="ringkasan" value={formData.ringkasan} onSave={handleFieldSave} isTextArea />
                  <FieldInput label="4. Definisi Istilah" name="definisi" value={formData.definisi} onSave={handleFieldSave} isTextArea />
                  <FieldInput label="5. Landasan Hukum" name="landasanHukum" value={formData.landasanHukum} onSave={handleFieldSave} isTextArea />
                  <FieldInput label="6. Perlengkapan" name="perlengkapan" value={formData.perlengkapan} onSave={handleFieldSave} isTextArea />
                </div>
                <div className="h-12"></div>
              </div>

              <div className={`flex flex-col w-full bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden relative ${activeSection === 'flowchart' ? 'flex' : 'hidden'}`}>
                <div className="p-4 border-b border-gray-100 bg-gray-50">
                  <h2 className="font-bold text-gray-800 text-lg">Pembuat Alur Matriks</h2>
                  <p className="text-xs text-gray-500">Klik baris, tambahkan simbol bentuk, lalu buat koneksi garis antar PIC/kegiatan.</p>
                </div>

                <div className="flex items-center gap-3 p-3 bg-white border-b border-gray-200 z-20 relative">
                  <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-200">
                    <Palette className="w-4 h-4 text-gray-500" />
                    <input type="color" value={selectedColor} onChange={e => setSelectedColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent" title="Pilih Warna" />
                  </div>
                  <div className="h-6 w-px bg-gray-300"></div>

                  <div className="relative">
                    <button onClick={() => setMenuOpen(menuOpen === 'shape' ? null : 'shape')} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium rounded-lg text-sm border border-blue-200">
                      <Plus className="w-4 h-4" /> Simbol Bentuk
                    </button>
                    {menuOpen === 'shape' && (
                      <div className="absolute top-10 left-0 w-72 bg-white border border-gray-200 shadow-xl rounded-xl z-50 p-2 grid grid-cols-2 gap-1 max-h-64 overflow-y-auto">
                        {SHAPE_OPTIONS.map(opt => (
                          <button key={opt.id} onClick={() => handleShapeSelect(opt.id)} className="flex flex-col items-center p-2 hover:bg-blue-50 rounded-lg text-gray-700 hover:text-blue-600 transition-colors">
                            <opt.Icon />
                            <span className="text-[10px] mt-1 text-center font-medium leading-tight">{opt.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button onClick={openLineDialog} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 font-medium rounded-lg text-sm border border-green-200">
                    <LinkIcon className="w-4 h-4" /> Buat Garis Sambung
                  </button>
                </div>

                {linePrompt && (
                  <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl border border-gray-200 w-96">
                      <h3 className="font-bold text-gray-800 mb-4 text-center">Buat Garis Penghubung</h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-gray-500 font-bold mb-1 block">DARI Kegiatan (No)</label>
                            <select value={linePrompt.sourceRowId} onChange={e => setLinePrompt({...linePrompt, sourceRowId: Number(e.target.value)})} className="w-full p-2 border border-gray-200 rounded text-sm">
                              {flowRows.map(r => <option key={r.id} value={r.id}>{flowRows.findIndex(x => x.id === r.id) + 1} - {r.text.substring(0,15)}...</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 font-bold mb-1 block">KE Kegiatan (No)</label>
                            <select value={linePrompt.targetRowId} onChange={e => setLinePrompt({...linePrompt, targetRowId: Number(e.target.value)})} className="w-full p-2 border border-gray-200 rounded text-sm">
                              {flowRows.map(r => <option key={r.id} value={r.id}>{flowRows.findIndex(x => x.id === r.id) + 1} - {r.text.substring(0,15)}...</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-gray-500 font-bold mb-1 block">DARI Pelaksana (PIC)</label>
                            <select value={linePrompt.sourcePic} onChange={e => setLinePrompt({...linePrompt, sourcePic: e.target.value})} className="w-full p-2 border border-gray-200 rounded text-sm">
                              {existingPics.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 font-bold mb-1 block">KE Pelaksana (PIC)</label>
                            <select value={linePrompt.targetPic} onChange={e => setLinePrompt({...linePrompt, targetPic: e.target.value})} className="w-full p-2 border border-gray-200 rounded text-sm">
                              {existingPics.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 font-bold mb-1 block">Bentuk Garis</label>
                          <div className="flex gap-2 p-2 border border-gray-200 rounded overflow-x-auto">
                            {LINE_OPTIONS.map(opt => (
                              <button 
                                key={opt.id}
                                onClick={() => setLinePrompt({...linePrompt, lineType: opt.id})}
                                className={`p-2 rounded hover:bg-gray-100 ${linePrompt.lineType === opt.id ? 'bg-blue-100 ring-2 ring-blue-500' : ''}`}
                                title={opt.id}
                              >
                                <opt.Icon />
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 font-bold mb-1 block">Teks Label (Opsional)</label>
                          <input type="text" value={linePrompt.label} onChange={e => setLinePrompt({...linePrompt, label: e.target.value})} placeholder="Contoh: Ya / Tidak / Revisi" className="w-full p-2 border border-gray-200 rounded text-sm" />
                        </div>
                      </div>
                      <div className="flex gap-2 mt-6">
                        <button onClick={() => setLinePrompt(null)} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg">Batal</button>
                        <button onClick={confirmAddConnection} className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg">Sambungkan</button>
                      </div>
                    </div>
                  </div>
                )}

                {picPrompt && (
                  <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl border border-gray-200 w-80">
                      <h3 className="font-bold text-gray-800 mb-2 text-center">Pilih Area PIC</h3>
                      <p className="text-xs text-gray-500 mb-4 text-center">Simbol akan diletakkan di bawah kolom Pelaksana berikut.</p>
                      <div className="space-y-3 mb-6">
                        <div className="flex flex-wrap gap-2 justify-center">
                          {existingPics.map(pic => (
                            <button key={pic} onClick={() => setPicPrompt({...picPrompt, inputValue: pic})} className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${picPrompt.inputValue === pic ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-gray-600 border-gray-200'}`}>{pic}</button>
                          ))}
                        </div>
                        <input type="text" value={picPrompt.inputValue} onChange={e => setPicPrompt({...picPrompt, inputValue: e.target.value})} placeholder="Atau ketik PIC baru..." className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-center" autoFocus onKeyDown={(e) => e.key === 'Enter' && confirmAddShape()} />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setPicPrompt(null)} className="flex-1 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg">Batal</button>
                        <button onClick={confirmAddShape} className="flex-1 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg">OK</button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-auto p-4 bg-white relative" onClick={() => setMenuOpen(null)}>
                  {flowConnections.length > 0 && (
                    <div className="mb-4 bg-green-50/50 border border-green-100 rounded-xl p-3">
                      <h3 className="text-xs font-bold text-green-800 mb-2">Daftar Garis Terhubung:</h3>
                      <div className="flex flex-wrap gap-2">
                        {flowConnections.map(conn => (
                          <div key={conn.id} className="flex items-center gap-2 bg-white border border-green-200 rounded px-2 py-1 text-[10px] text-gray-600">
                            <span style={{color: conn.color}} className="font-bold">[{flowRows.findIndex(r=>r.id===conn.sourceRowId)+1}] {conn.sourcePic}</span>
                            ➔
                            <span style={{color: conn.color}} className="font-bold">[{flowRows.findIndex(r=>r.id===conn.targetRowId)+1}] {conn.targetPic}</span>
                            {conn.label && <span className="bg-gray-100 px-1 rounded">"{conn.label}"</span>}
                            <button onClick={()=>removeConnection(conn.id)} className="text-red-500 hover:text-red-700 ml-1"><Trash2 className="w-3 h-3"/></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-gray-600 border-y border-gray-200">
                        <th className="py-3 px-2 text-center w-10">No</th>
                        <th className="py-3 px-2 text-left w-72">Uraian Kegiatan</th>
                        <th className="py-3 px-2 text-left min-w-[150px]">Simbol Shape</th>
                        <th className="py-3 px-2 text-left w-40">Dokumen Output</th>
                        <th className="py-3 px-2 text-left w-40">Catatan</th>
                        <th className="py-3 px-2 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {flowRows.map((row, index) => (
                        <tr key={row.id} onClick={() => setActiveRowId(row.id)} className={`border-b border-gray-100 cursor-pointer ${activeRowId === row.id ? 'bg-blue-50/40 ring-1 ring-inset ring-blue-200' : 'hover:bg-gray-50'}`}>
                          <td className="py-2 px-2 text-center font-medium text-gray-400 align-top pt-4">{index + 1}</td>
                          <td className="py-2 px-2 align-top">
                            <textarea value={row.text} onChange={(e) => updateFlowRow(row.id, 'text', e.target.value)} placeholder="Tulis detail langkah kegiatan..." className="w-full bg-white border border-gray-200 rounded-lg p-2 resize-y min-h-[80px] focus:border-blue-500 outline-none" />
                          </td>
                          <td className="py-2 px-2 align-top">
                            <div className="flex flex-wrap gap-1.5 bg-white border border-gray-200 rounded-lg p-2 min-h-[80px]">
                              {row.symbols.map(sym => {
                                const Icon = SHAPE_OPTIONS.find(s => s.id === sym.itemId)?.Icon;
                                if (!Icon) return null;
                                return (
                                  <div key={sym.id} className="relative group flex flex-col items-center p-1 bg-gray-50 border border-gray-100 rounded" style={{ color: sym.color }}>
                                    <Icon />
                                    <span className="text-[9px] mt-1 text-gray-500 font-medium px-1 bg-white border border-gray-200 rounded">{sym.picTarget}</span>
                                    <button onClick={(e) => { e.stopPropagation(); removeSymbol(row.id, sym.id); }} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100"><Trash2 className="w-3 h-3" /></button>
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                          <td className="py-2 px-2 align-top">
                            <textarea value={row.doc} onChange={(e) => updateFlowRow(row.id, 'doc', e.target.value)} placeholder="Form / Laporan" className="w-full bg-transparent border-b border-transparent focus:border-blue-500 outline-none py-1 resize-y min-h-[80px]" />
                          </td>
                          <td className="py-2 px-2 align-top">
                            <textarea value={row.note} onChange={(e) => updateFlowRow(row.id, 'note', e.target.value)} placeholder="Keterangan..." className="w-full bg-transparent border-b border-transparent focus:border-blue-500 outline-none py-1 resize-y min-h-[80px]" />
                          </td>
                          <td className="py-2 px-2 text-center align-top pt-4">
                            <button onClick={(e) => { e.stopPropagation(); deleteFlowRow(row.id); }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button onClick={addFlowRow} className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold rounded-xl text-sm w-full justify-center border border-blue-200 border-dashed">
                    <Plus className="w-4 h-4" /> Tambah Baris Kegiatan
                  </button>
                </div>
              </div>

              <div className={`flex flex-col h-full ${activeSection === 'agent' ? 'flex' : 'hidden'}`}>
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col h-full min-h-[600px]">
                  <div className="p-4 border-b border-gray-100 bg-gray-50 rounded-t-3xl">
                    <div className="flex items-center gap-3">
                      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-xl">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h2 className="font-bold text-gray-800">Agent SOP AI</h2>
                        <p className="text-xs text-gray-500">Tanya atau generate konten SOP dengan AI</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`chat-msg max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-br-md'
                            : 'bg-white border border-gray-200 text-gray-700 rounded-bl-md shadow-sm'
                        }`}>
                          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                        </div>
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-white border border-gray-200 text-gray-500 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm flex items-center gap-2 text-sm">
                          <Loader2 className="w-4 h-4 animate-spin" /> AI sedang menulis...
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="p-4 border-t border-gray-100 bg-white rounded-b-3xl">
                    <div className="flex gap-2">
                      <textarea
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={handleChatKeyDown}
                        placeholder="Ketik pesan... Gunakan #Formulir, #Tabel, atau #Formulir #Tabel"
                        rows={2}
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none"
                      />
                      <button
                        onClick={handleChatSubmit}
                        disabled={isChatLoading || !chatInput.trim()}
                        className="self-end p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                      >
                        {isChatLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">
                      Gunakan <code className="bg-gray-100 px-1 rounded text-gray-600">#Formulir</code> untuk konten form, <code className="bg-gray-100 px-1 rounded text-gray-600">#Tabel</code> untuk tabel alur
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className={`${showPreview ? 'w-1/2 flex' : 'hidden'} overflow-y-auto bg-gray-200 p-8 justify-center no-print-bg transition-all duration-300 border-l border-gray-300`}>
              <div id="sop-document" className="bg-white w-full max-w-[21cm] min-h-[29.7cm] shadow-xl text-black relative" style={{ padding: '2cm', boxSizing: 'border-box' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', marginBottom: '20px' }}>
                  <tbody>
                    <tr>
                      <td rowSpan="4" style={{ border: '1px solid black', padding: '10px', textAlign: 'center', width: '25%' }}>
                        <img src="/logo.png" alt="Logo" style={{ maxWidth: '100%', height: 'auto', maxHeight: '60px' }} />
                        
                      </td>
                      <td style={{ border: '1px solid black', padding: '5px 10px', width: '25%', fontWeight: 'bold', fontSize: '12px' }}>NOMOR DOKUMEN</td>
                      <td colSpan="2" style={{ border: '1px solid black', padding: '5px 10px', fontSize: '12px' }}>{formData.nomorDokumen || '-'}</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid black', padding: '5px 10px', fontWeight: 'bold', fontSize: '12px' }}>NAMA DOKUMEN</td>
                      <td colSpan="2" style={{ border: '1px solid black', padding: '5px 10px', fontSize: '12px' }}>{formData.namaDokumen || '-'}</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid black', padding: '5px 10px', fontWeight: 'bold', fontSize: '12px' }}>DIREKTORAT</td>
                      <td colSpan="2" style={{ border: '1px solid black', padding: '5px 10px', fontSize: '12px' }}>{formData.direktorat || '-'}</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid black', padding: '5px 10px', fontWeight: 'bold', fontSize: '12px' }}>DIVISI</td>
                      <td colSpan="2" style={{ border: '1px solid black', padding: '5px 10px', fontSize: '12px' }}>{formData.divisi || '-'}</td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
                  {formData.tujuan && <div style={{ marginBottom: '15px' }}><h3 style={{ margin: '0 0 5px 0', fontSize: '12px', fontWeight: 'bold' }}>1. TUJUAN/MAKSUD</h3><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{formData.tujuan}</p></div>}
                  {formData.ruangLingkup && <div style={{ marginBottom: '15px' }}><h3 style={{ margin: '0 0 5px 0', fontSize: '12px', fontWeight: 'bold' }}>2. RUANG LINGKUP</h3><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{formData.ruangLingkup}</p></div>}
                  {formData.ringkasan && <div style={{ marginBottom: '15px' }}><h3 style={{ margin: '0 0 5px 0', fontSize: '12px', fontWeight: 'bold' }}>3. RINGKASAN</h3><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{formData.ringkasan}</p></div>}
                  {formData.definisi && <div style={{ marginBottom: '15px' }}><h3 style={{ margin: '0 0 5px 0', fontSize: '12px', fontWeight: 'bold' }}>4. DEFINISI ISTILAH</h3><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{formData.definisi}</p></div>}
                  {formData.landasanHukum && <div style={{ marginBottom: '15px' }}><h3 style={{ margin: '0 0 5px 0', fontSize: '12px', fontWeight: 'bold' }}>5. LANDASAN HUKUM</h3><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{formData.landasanHukum}</p></div>}
                  {formData.perlengkapan && <div style={{ marginBottom: '15px' }}><h3 style={{ margin: '0 0 5px 0', fontSize: '12px', fontWeight: 'bold' }}>6. PERLENGKAPAN</h3><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{formData.perlengkapan}</p></div>}

                  <div style={{ marginBottom: '25px', marginTop: '15px', pageBreakInside: 'avoid' }}>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 'bold' }}>7. MATRIKS PROSEDUR (FLOWCHART)</h3>
                    <table className="preview-table" style={{ fontSize: '10px' }}>
                      <thead>
                        <tr>
                          <th rowSpan={2} style={{ width: '5%' }}>No</th>
                          <th rowSpan={2} style={{ width: '25%' }}>Kegiatan</th>
                          <th colSpan={displayPics.length} style={{ width: '40%' }}>Pelaksana</th>
                          <th colSpan={2} style={{ width: '30%' }}>Mutu Baku</th>
                        </tr>
                        <tr>
                          {displayPics.map(pic => <th key={pic} style={{ fontWeight: 'normal', fontSize: '9px' }}>{pic}</th>)}
                          <th style={{ fontWeight: 'normal', fontSize: '9px' }}>Kelengkapan</th>
                          <th style={{ fontWeight: 'normal', fontSize: '9px' }}>Catatan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {flowRows.map((row, idx) => {
                          const rowConnections = flowConnections.filter(c => c.sourceRowId === row.id);
                          return (
                            <tr key={`matrix-${row.id}`}>
                              <td style={{ textAlign: 'center', verticalAlign: 'top', paddingTop: '8px' }}>{idx + 1}</td>
                              <td style={{ fontWeight: 'bold', whiteSpace: 'pre-wrap', verticalAlign: 'top', padding: '8px' }}>{row.text}</td>
                              {displayPics.map(pic => {
                                const symbolsForPic = row.symbols.filter(sym => sym.picTarget === pic);
                                const connsFromThisPic = rowConnections.filter(c => c.sourcePic === pic);
                                return (
                                  <td key={`${row.id}-${pic}`} className="swimlane-cell" style={{ verticalAlign: 'top', padding: '8px 2px' }}>
                                    <div className="flex flex-col items-center justify-start min-h-[60px] relative">
                                      <div className="flex flex-col items-center gap-1.5 py-1 z-10 bg-white">
                                        {symbolsForPic.map(sym => {
                                          const Icon = SHAPE_OPTIONS.find(s => s.id === sym.itemId)?.Icon;
                                          return Icon ? <div key={sym.id} style={{ color: sym.color }}><Icon /></div> : null;
                                        })}
                                      </div>
                                      {connsFromThisPic.map(conn => {
                                        const LineIcon = LINE_OPTIONS.find(l => l.id === conn.lineType)?.Icon;
                                        return (
                                          <div key={conn.id} className="flex flex-col items-center mt-1" style={{ color: conn.color }}>
                                            {LineIcon && <LineIcon />}
                                            {conn.label && <span className="text-[8px] bg-white px-1 mt-0.5 border border-gray-200">{conn.label}</span>}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </td>
                                )
                              })}
                              <td style={{ whiteSpace: 'pre-wrap', verticalAlign: 'top', padding: '8px' }}>{row.doc || '-'}</td>
                              <td style={{ whiteSpace: 'pre-wrap', verticalAlign: 'top', padding: '8px' }}>{row.note || '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      {settingsOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 no-print">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-gray-700" />
                <h2 className="text-lg font-bold text-gray-900">Pengaturan</h2>
              </div>
              <button onClick={() => setSettingsOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">System Prompt Formulir</label>
                <textarea
                  value={settings.systemPrompt}
                  onChange={e => setSettings({ ...settings, systemPrompt: e.target.value })}
                  rows={6}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-y font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">System Prompt Tabel Alur</label>
                <textarea
                  value={settings.flowPrompt}
                  onChange={e => setSettings({ ...settings, flowPrompt: e.target.value })}
                  rows={6}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-y font-mono"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
              <button
                onClick={() => setSettingsOpen(false)}
                className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition-colors"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  localStorage.setItem('rapid-sop-settings', JSON.stringify(settings));
                  setSettingsOpen(false);
                }}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
