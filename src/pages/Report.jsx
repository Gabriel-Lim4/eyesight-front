import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import ReportSheet from '../components/report/ReportSheet';
import api from '../services/api';
import '../styles/Report.css';

const PERIODS = [['last_7d', 'Últimos 7 dias'], ['last_30d', 'Últimos 30 dias'], ['last_90d', 'Últimos 90 dias']];
const PLATFORMS = [['all', 'Todas as plataformas'], ['meta', 'Meta Ads'], ['google', 'Google Ads']];

/* Relatório para mostrar ao cliente: escolhe o recorte, vê o documento e imprime ou salva em PDF pelo navegador. */
export default function Report() {
  const [filters, setFilters] = useState({ periodo: 'last_30d', platform: 'all' });
  const [clientName, setClientName] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    // Zera o estado da requisição quando o recorte muda.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true); setError(''); setData(null);
    api.get('/metricas/analytics', { params: filters, signal: controller.signal })
      .then(({ data: result }) => { if (!controller.signal.aborted) setData(result); })
      .catch(err => { if (!controller.signal.aborted) setError(err.response?.data?.erro || 'Não foi possível carregar os dados do relatório. Tente novamente.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters]);

  const platformLabel = PLATFORMS.find(([value]) => value === filters.platform)[1];
  return <div className="rp-page">
    <header className="rp-intro">
      <h1>Relatório para o cliente</h1>
      <p>Escolha o período, ponha o nome do cliente e imprima ou salve em PDF. O relatório usa o mesmo veredito e os mesmos números do painel.</p>
    </header>
    <form className="rp-controls" onSubmit={event => event.preventDefault()}>
      <label>Nome do cliente
        <input type="text" value={clientName} maxLength={80} onChange={event => setClientName(event.target.value)} placeholder="Opcional" autoComplete="off" />
      </label>
      <label>Período
        <select value={filters.periodo} onChange={event => setFilters(current => ({ ...current, periodo: event.target.value }))}>
          {PERIODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>Plataforma
        <select value={filters.platform} onChange={event => setFilters(current => ({ ...current, platform: event.target.value }))}>
          {PLATFORMS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <button type="button" className="rp-print" disabled={loading || Boolean(error)} onClick={() => window.print()}>
        <Printer size={16} aria-hidden="true" /> Imprimir ou salvar em PDF
      </button>
    </form>
    {loading && <p role="status" className="rp-screen-only">Montando o relatório…</p>}
    {error && <p role="alert" className="rp-error rp-screen-only">{error}</p>}
    {data && <ReportSheet data={data} clientName={clientName} platformLabel={platformLabel} />}
  </div>;
}
