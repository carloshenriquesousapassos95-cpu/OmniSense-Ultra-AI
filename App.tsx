
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, Sparkles, Code, Brain, FileText, Settings, 
  Trash2, Moon, Sun, Zap, MessageSquare, TrendingUp, 
  GraduationCap, Lightbulb, Target, ChevronDown, Monitor, Cpu
} from 'lucide-react';
import { ModeKey, Message, AppSettings } from './types';
import { MODES } from './constants';
import { streamChat } from './geminiService';

// Renderizador Markdown Básico com Sanitização e Estilização Profissional
const FormattedContent: React.FC<{ content: string }> = ({ content }) => {
  const escapeHtml = (text: string) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  };

  const processText = (text: string) => {
    let processed = escapeHtml(text);
    // Negrito
    processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-indigo-400">$1</strong>');
    // Itálico
    processed = processed.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
    // Código em linha
    processed = processed.replace(/`(.*?)`/g, '<code class="bg-slate-800/80 px-1.5 py-0.5 rounded text-pink-400 font-mono text-[0.85em]">$1</code>');
    return { __html: processed };
  };

  const lines = content.split('\n');
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];

  return (
    <div className="space-y-2 text-sm sm:text-base">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        
        // Detecção rudimentar de blocos de código
        if (trimmed.startsWith('```')) {
          if (inCodeBlock) {
            inCodeBlock = false;
            const code = codeBlockLines.join('\n');
            codeBlockLines = [];
            return (
              <div key={i} className="my-4 bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
                <div className="bg-slate-900 px-4 py-2 text-[10px] font-mono text-slate-500 flex justify-between">
                  <span>SOURCE_CODE</span>
                </div>
                <pre className="p-4 overflow-x-auto font-mono text-xs text-emerald-400 leading-relaxed">
                  <code>{code}</code>
                </pre>
              </div>
            );
          } else {
            inCodeBlock = true;
            return null;
          }
        }

        if (inCodeBlock) {
          codeBlockLines.push(line);
          return null;
        }

        if (trimmed.startsWith('### ')) return <h3 key={i} className="text-lg font-bold mt-4 mb-2 text-indigo-400 font-orbitron" dangerouslySetInnerHTML={processText(line.replace('### ', ''))} />;
        if (trimmed.startsWith('## ')) return <h2 key={i} className="text-xl font-bold mt-6 mb-3 text-indigo-300 border-b border-slate-800 pb-2 font-orbitron" dangerouslySetInnerHTML={processText(line.replace('## ', ''))} />;
        if (trimmed.startsWith('# ')) return <h1 key={i} className="text-2xl font-black mt-8 mb-4 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 font-orbitron" dangerouslySetInnerHTML={processText(line.replace('# ', ''))} />;
        
        if (trimmed.startsWith('• ') || trimmed.startsWith('- ')) {
          const contentAfterBullet = line.substring(line.search(/[•-]/) + 1).trim();
          return (
            <div key={i} className="flex gap-3 ml-2 group">
              <span className="text-indigo-500 mt-1.5">•</span>
              <span className="flex-1" dangerouslySetInnerHTML={processText(contentAfterBullet)} />
            </div>
          );
        }
        
        if (trimmed.match(/^\d+\./)) return (
          <div key={i} className="flex gap-3 ml-2">
            <span className="text-indigo-500 font-bold mt-0.5">{trimmed.split('.')[0]}.</span>
            <span className="flex-1" dangerouslySetInnerHTML={processText(line.replace(/^\d+\.\s*/, ''))} />
          </div>
        );
        
        if (trimmed === '') return <div key={i} className="h-1" />;

        return <p key={i} className="leading-relaxed opacity-90" dangerouslySetInnerHTML={processText(line)} />;
      })}
    </div>
  );
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ModeKey>(ModeKey.CRIATIVO);
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'dark',
    temperature: 0.7,
    showSettings: false,
  });
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollHeight, clientHeight } = scrollContainerRef.current;
      scrollContainerRef.current.scrollTo({
        top: scrollHeight - clientHeight,
        behavior: 'smooth'
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  useEffect(() => {
    const saved = localStorage.getItem('omnisense-messages');
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (e) {}
    }
    
    const savedSettings = localStorage.getItem('omnisense-settings');
    if (savedSettings) {
      try {
        setSettings(prev => ({ ...prev, ...JSON.parse(savedSettings) }));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('omnisense-messages', JSON.stringify(messages));
    localStorage.setItem('omnisense-settings', JSON.stringify({ 
      theme: settings.theme, 
      temperature: settings.temperature 
    }));
  }, [messages, settings.theme, settings.temperature]);

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { 
      role: 'user', 
      content: input.trim(), 
      timestamp: Date.now() 
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const history = messages.map(m => ({ role: m.role, content: m.content }));
    const currentMode = MODES[mode];

    try {
      let assistantMsg: Message = { 
        role: 'assistant', 
        content: '', 
        timestamp: Date.now() 
      };
      
      setMessages(prev => [...prev, assistantMsg]);

      await streamChat(
        userMsg.content,
        history,
        currentMode.prompt,
        settings.temperature,
        (chunk) => {
          setMessages(prev => {
            const newMsgs = [...prev];
            newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: chunk };
            return newMsgs;
          });
        }
      );
    } catch (error) {
      setMessages(prev => {
        const historyWithoutLast = prev.slice(0, -1);
        return [
          ...historyWithoutLast,
          { 
            role: 'assistant', 
            content: '⚠️ **ERRO CRÍTICO DE SISTEMA**: Falha na orquestração neural. Verifique os limites de tokens ou a integridade da chave de API.',
            timestamp: Date.now()
          }
        ];
      });
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    if (confirm('Limpar registros neurais e reiniciar interface?')) {
      setMessages([]);
      localStorage.removeItem('omnisense-messages');
    }
  };

  const currentModeData = MODES[mode];
  const isDark = settings.theme === 'dark';

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-500 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20 z-0">
        <div className={`absolute -top-24 -left-24 w-96 h-96 rounded-full blur-[120px] transition-colors duration-1000`} style={{ backgroundColor: currentModeData.color }}></div>
        <div className={`absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full blur-[150px] opacity-40 transition-colors duration-1000`} style={{ backgroundColor: currentModeData.color }}></div>
      </div>

      {/* Header */}
      <header className={`sticky top-0 z-40 backdrop-blur-xl border-b transition-colors duration-300 ${isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="p-2.5 rounded-xl flex items-center justify-center shadow-lg transform hover:rotate-6 transition-transform duration-300"
              style={{ background: `linear-gradient(135deg, ${currentModeData.color}, ${currentModeData.color}dd)` }}
            >
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-orbitron font-bold tracking-wider uppercase">OmniSense <span className="text-indigo-500">Ultra</span></h1>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: currentModeData.color }}></span>
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: currentModeData.color }}></span>
                </span>
                <p className="text-[10px] font-mono uppercase tracking-widest opacity-60">Engine v4.5 | {currentModeData.name}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setSettings(s => ({ ...s, theme: isDark ? 'light' : 'dark' }))}
              className={`p-2 rounded-lg border transition-all ${isDark ? 'border-slate-800 bg-slate-900 text-yellow-400' : 'border-slate-200 bg-white text-slate-600'}`}
              title="Alternar Tema"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => setSettings(s => ({ ...s, showSettings: !s.showSettings }))}
              className={`p-2 rounded-lg border transition-all ${settings.showSettings ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500' : isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}
              title="Configurações da Engine"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button 
              onClick={clearHistory}
              className="p-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
              title="Limpar Histórico"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Settings Panel */}
      {settings.showSettings && (
        <div className={`border-b animate-in slide-in-from-top duration-300 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-100/50 border-slate-200'}`}>
          <div className="max-w-4xl mx-auto px-4 py-6">
            <h2 className="text-xs font-orbitron uppercase tracking-widest mb-4 opacity-50">Calibragem de Processamento</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-medium uppercase tracking-wider opacity-70">Temperatura Cognitiva: {settings.temperature.toFixed(1)}</label>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.1" 
                  value={settings.temperature}
                  onChange={(e) => setSettings(s => ({ ...s, temperature: parseFloat(e.target.value) }))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
              <div className="text-[11px] opacity-50 space-y-2">
                <p>● Engine Gemini 3 Pro operando com <span className="text-indigo-400 font-bold">Protocolo CoT (Chain-of-Thought)</span>.</p>
                <p>● Orçamento de Pensamento: 16.000 tokens dedicados à lógica pré-resposta.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main UI */}
      <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full relative z-10 px-4 pt-4 pb-32 overflow-hidden">
        
        {/* Modes Selector */}
        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
          {Object.values(MODES).map((m) => {
             const IconMap: any = { 
               Sparkles, Brain, Code, FileText, Zap, TrendingUp, GraduationCap, Lightbulb, Target 
             };
             const ModeIcon = IconMap[m.icon] || Cpu;
             const isActive = mode === m.id;
             return (
               <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border whitespace-nowrap transition-all duration-300 ${
                  isActive 
                    ? 'shadow-lg border-transparent text-white scale-105' 
                    : isDark ? 'border-slate-800 bg-slate-900/50 hover:bg-slate-800' : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
                style={{ backgroundColor: isActive ? m.color : undefined }}
               >
                 <ModeIcon className={`w-4 h-4 ${isActive ? 'text-white' : ''}`} style={{ color: !isActive ? m.color : undefined }} />
                 <span className="text-sm font-medium">{m.name}</span>
               </button>
             );
          })}
        </div>

        {/* Chat Area */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto pr-2 space-y-6 pt-4 mask-fade-top scroll-smooth"
        >
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="relative mb-6">
                <Cpu className="w-20 h-20 opacity-10 animate-pulse" style={{ color: currentModeData.color }} />
              </div>
              <h2 className="text-2xl font-orbitron font-bold mb-2 opacity-80 uppercase tracking-widest">Núcleo OmniSense v4.5</h2>
              <p className="text-slate-500 max-w-md text-sm mb-8 font-medium">
                Orquestrador multidisciplinar ativo no modo <span className="font-bold uppercase" style={{ color: currentModeData.color }}>{currentModeData.name}</span>. Envie uma diretriz complexa para processamento neural.
              </p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div 
              key={idx}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-500`}
            >
              <div className={`flex items-start gap-4 max-w-[90%] sm:max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center border shadow-lg ${msg.role === 'user' ? (isDark ? 'bg-indigo-600 border-indigo-500' : 'bg-indigo-500 border-indigo-400') : (isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200')}`}>
                   {msg.role === 'user' ? <Monitor className="w-5 h-5 text-white" /> : <Cpu className="w-5 h-5" style={{ color: currentModeData.color }} />}
                </div>
                <div 
                  className={`px-6 py-4 rounded-2xl text-sm leading-relaxed shadow-sm transition-all duration-300 ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600/90 text-white'
                      : isDark ? 'bg-slate-900/60 border border-slate-800/80 text-slate-200' : 'bg-white border border-slate-200 text-slate-800'
                  }`}
                >
                  <FormattedContent content={msg.content} />
                </div>
              </div>
              <span className="text-[10px] mt-2 px-14 opacity-20 font-mono uppercase tracking-widest">
                {new Date(msg.timestamp).toLocaleTimeString()} • {msg.role === 'user' ? 'User Auth' : 'System Engine'}
              </span>
            </div>
          ))}

          {loading && messages[messages.length-1]?.role === 'user' && (
            <div className="flex items-start gap-4 animate-pulse px-1">
              <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                <Cpu className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="px-6 py-4 rounded-2xl bg-slate-900/30 border border-slate-800/50 flex gap-2 items-center">
                <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest font-bold">Orquestrando Síntese Neural</span>
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce"></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Input Bar */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 p-6 transition-colors duration-300 ${isDark ? 'bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent' : 'bg-gradient-to-t from-slate-50 via-slate-50/90 to-transparent'}`}>
        <div className="max-w-4xl mx-auto">
          <div className={`relative flex items-center gap-2 p-2 rounded-2xl border-2 shadow-2xl backdrop-blur-3xl transition-all duration-500 ${
            loading ? 'border-indigo-500/30 ring-4 ring-indigo-500/5' : isDark ? 'bg-slate-900/95 border-slate-800 focus-within:border-slate-700' : 'bg-white/95 border-slate-200 focus-within:border-indigo-300'
          }`}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={`Diretriz para o modo ${currentModeData.name.toLowerCase()}...`}
              className={`flex-1 bg-transparent px-4 py-3 text-sm focus:outline-none resize-none min-h-[52px] max-h-[180px] font-medium placeholder:opacity-40 ${isDark ? 'text-white' : 'text-slate-900'}`}
              rows={1}
            />
            
            <button
              onClick={handleSendMessage}
              disabled={loading || !input.trim()}
              className={`p-3.5 rounded-xl flex items-center justify-center transition-all duration-300 shadow-lg active:scale-95 disabled:opacity-40 disabled:grayscale`}
              style={{ background: `linear-gradient(135deg, ${currentModeData.color}, ${currentModeData.color}dd)` }}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                <Send className="w-5 h-5 text-white" />
              )}
            </button>
            
            <div className="absolute -top-3 left-6">
              <div 
                className="px-3 py-1 rounded-full text-[9px] font-orbitron font-bold text-white shadow-lg flex items-center gap-1.5 transition-colors duration-1000"
                style={{ backgroundColor: currentModeData.color }}
              >
                <Zap className="w-2.5 h-2.5 fill-current" />
                SISTEMA OPERANTE: {currentModeData.name.toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        .mask-fade-top {
          mask-image: linear-gradient(to bottom, transparent, black 40px);
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
