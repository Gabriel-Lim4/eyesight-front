import { useState, useEffect, useRef } from 'react';
import { Bot, Send, Plus, Trash2, Sparkles } from 'lucide-react';
import api from '../services/api';
import '../styles/variables.css';
import '../styles/Assistant.css';
import '../styles/AssistantRefresh.css';

const suggestions = ['Quais campanhas merecem atenção?', 'Como testar novos criativos?', 'Quais dados faltam para avaliar meu ROAS?'];
const periodLabel = value => {
  const labels = { today: 'Hoje', yesterday: 'Ontem', last_7d: 'Últimos 7 dias', last_30d: 'Últimos 30 dias', last_90d: 'Últimos 90 dias' };
  if (labels[value]) return labels[value];
  const custom = /^custom:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/.exec(value || '');
  const date = text => text.split('-').reverse().join('/');
  return custom ? `${date(custom[1])} a ${date(custom[2])}` : 'Período não informado';
};
const errorMessage = error => error.response?.data?.erro || 'Não foi possível completar a solicitação. Tente novamente.';
const analysisView = row => ({ id: row.pk_id_analise, texto: row.texto_analise, sugestao: row.sugestao_analise, nome_campanha: row.campanha?.nome_campanha, score_desempenho: row.score_desempenho, modelo: row.modelo, periodo: row.periodo });

export default function Assistant() {
  const demo = localStorage.getItem('eyesight-demo') === '1';
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [campaignId, setCampaignId] = useState('');
  const [analyses, setAnalyses] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [status, setStatus] = useState(null);
  const [period, setPeriod] = useState('last_30d');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const bottom = useRef(null);

  useEffect(() => {
    let active = true;
    Promise.all([api.get('/ia/status'), api.get('/ia/conversas'), api.get('/metricas/campanhas'), api.get('/ia/analises')])
      .then(([config, history, campaignList, reports]) => {
        if (!active) return;
        setStatus(config.data); setConversations(history.data.conversas || []);
        setCampaigns(campaignList.data.campanhas || []); setAnalyses(reports.data.analises || []);
      }).catch(err => { if (active) setError(errorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'auto', block: 'nearest' }); }, [messages, busy]);

  async function send(text = input) {
    if (busy || !text.trim()) return;
    setBusy(true); setError('');
    try {
      const { data } = await api.post('/ia/chat', { message: text.trim(), conversationId: conversationId || undefined, periodo: period }, { timeout: 55000 });
      setMessages(data.conversation.messages); setConversationId(data.conversation.id); setInput('');
      setConversations(items => [data.conversation, ...items.filter(item => item.id !== data.conversation.id)].slice(0, 50));
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  async function openConversation(id) {
    setBusy(true); setError('');
    try { const { data } = await api.get(`/ia/conversas/${id}`); setMessages(data.conversation.messages); setConversationId(id); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  async function removeConversation(id) {
    if (!window.confirm('Excluir esta conversa e suas mensagens? Esta ação não pode ser desfeita.')) return;
    setBusy(true); setError('');
    try {
      await api.delete(`/ia/conversas/${id}`); setConversations(items => items.filter(item => item.id !== id));
      if (id === conversationId) { setMessages([]); setConversationId(null); }
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  async function generate() {
    setBusy(true); setError('');
    try {
      const { data } = await api.post(`/ia/analisar/${campaignId}`, { periodo: period }, { timeout: 55000 });
      setAnalysis(data.analise);
      const history = await api.get('/ia/analises'); setAnalyses(history.data.analises || []);
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  async function removeAnalysis(id) {
    if (!window.confirm('Excluir esta análise salva? Esta ação não pode ser desfeita.')) return;
    setBusy(true); setError('');
    try { await api.delete(`/ia/analises/${id}`); setAnalyses(items => items.filter(item => item.pk_id_analise !== id)); if (analysis?.id === id) setAnalysis(null); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  const unavailable = busy || loading || !status?.configured;
  return <div className="eyesight-assistant">
    <header className="assistant-heading"><div><h1><Bot size={26} /> Argos</h1><p>Seu analista de campanhas: lê as métricas sincronizadas e aponta os próximos passos.</p></div>
      <label>Período<select value={period} onChange={e => setPeriod(e.target.value)} disabled={busy}><option value="last_7d">Últimos 7 dias</option><option value="last_30d">Últimos 30 dias</option><option value="last_90d">Últimos 90 dias</option></select></label>
    </header>
    {error && <div className="assistant-error" role="alert">{error} <button type="button" disabled={busy} onClick={() => { setError(''); setLoading(true); setReload(value => value + 1); }}>Recarregar</button></div>}
    {loading && <p role="status">Acordando o Argos e carregando o histórico…</p>}
    {status && !status.configured && <p className="assistant-notice">{demo ? 'Demonstração: abra a análise de exemplo abaixo. Novas análises e conversas estão desativadas.' : 'O Argos aguarda configuração pelo administrador. Suas análises salvas continuam disponíveis.'}</p>}
    {status?.configured && <p className="assistant-caption">Modelo: {status.model} · Análise após sincronização: {status.automatic ? 'ativada' : 'desativada'}. As respostas são sugestões; revise antes de alterar campanhas.</p>}
    <div className="assistant-layout">
      <section className="assistant-chat" aria-label="Conversa com o Argos">
        <div className="assistant-section-heading"><h2>Converse com o Argos</h2><button type="button" disabled={busy} onClick={() => { setMessages([]); setConversationId(null); setInput(''); setError(''); }}><Plus size={16} /> Nova conversa</button></div>
        <div className="assistant-messages" role="log" aria-live="polite" aria-busy={busy}>
          {!messages.length && <div className="assistant-welcome"><Sparkles size={30} /><h3>Qual é sua próxima decisão?</h3><p>Sou o Argos. Analiso o desempenho e sugiro testes com base nos dados do período selecionado. Quando faltarem dados, aviso a limitação.</p></div>}
          {messages.map((message, index) => <article key={`${message.created_at}-${index}`} className={`assistant-message ${message.role}`}><strong>{message.role === 'user' ? 'Você' : 'Argos'}</strong><p>{message.content}</p></article>)}
          {busy && <p role="status">Processando solicitação…</p>}<div ref={bottom} />
        </div>
        <div className="assistant-suggestions">{suggestions.map(text => <button key={text} type="button" disabled={unavailable} onClick={() => send(text)}>{text}</button>)}</div>
        <form className="assistant-composer" onSubmit={e => { e.preventDefault(); send(); }}><label htmlFor="assistant-message">Sua pergunta</label><textarea id="assistant-message" value={input} onChange={e => setInput(e.target.value)} maxLength={2000} rows={3} disabled={unavailable} placeholder="Pergunte algo ao Argos sobre suas campanhas…" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} /><div><small>Enter envia · Shift + Enter quebra a linha · {input.length}/2000</small><button type="submit" disabled={unavailable || !input.trim()}><Send size={16} /> Enviar</button></div></form>
      </section>
      <aside className="assistant-sidebar">
        <section className="assistant-panel"><h2>Analisar campanha</h2><label htmlFor="assistant-campaign">Campanha</label><select id="assistant-campaign" value={campaignId} onChange={e => setCampaignId(e.target.value)} disabled={busy}><option value="">Selecione uma campanha</option>{campaigns.map(campaign => <option key={campaign.pk_id_campanha} value={campaign.pk_id_campanha}>{campaign.nome_campanha}</option>)}</select>{!loading && !campaigns.length && <p>Conecte uma conta e sincronize suas campanhas em Integrações.</p>}<button className="assistant-primary" type="button" disabled={unavailable || !campaignId} onClick={generate}><Sparkles size={16} /> Gerar análise</button><small>Usa o período selecionado. O score é indicativo, não uma garantia de resultado.</small></section>
        <section className="assistant-panel"><h2>Conversas recentes</h2>{!conversations.length && <p>Nenhuma conversa salva.</p>}{conversations.map(item => <div className="assistant-history-row" key={item.id}><button type="button" disabled={busy} aria-current={conversationId === item.id ? 'true' : undefined} onClick={() => openConversation(item.id)}>{item.title}</button><button type="button" disabled={busy} aria-label={`Excluir conversa ${item.title}`} onClick={() => removeConversation(item.id)}><Trash2 size={16} /></button></div>)}<small>Até 50 conversas recentes; cada conversa mantém as últimas 20 mensagens.</small></section>
        <section className="assistant-panel"><h2>Análises salvas</h2>{!analyses.length && <p>Nenhuma análise gerada.</p>}{analyses.map(item => <div className="assistant-history-row" key={item.pk_id_analise}><button type="button" onClick={() => setAnalysis(analysisView(item))}>{item.campanha?.nome_campanha || 'Campanha'}<small>{new Date(item.data_geracao_analise).toLocaleDateString('pt-BR')} · {periodLabel(item.periodo)}</small></button><button type="button" disabled={busy} aria-label="Excluir análise" onClick={() => removeAnalysis(item.pk_id_analise)}><Trash2 size={16} /></button></div>)}</section>
      </aside>
    </div>
    {analysis && <section className="assistant-panel assistant-analysis" aria-live="polite"><div className="assistant-section-heading"><h2>{analysis.nome_campanha || 'Análise da campanha'}</h2><span>Score indicativo: {analysis.score_desempenho ?? '—'}/100</span></div><small>{analysis.modelo} · {periodLabel(analysis.periodo)}</small><p>{analysis.texto}</p><h3>Próximos passos</h3><p>{analysis.sugestao}</p></section>}
  </div>;
}
