import { useMemo, useState } from 'react';
import {
  ArrowDown, ArrowUp, BadgeDollarSign, ChartColumn, Check, ChevronLeft, ChevronRight, Coins, Eye, GripVertical,
  LayoutGrid, Minus, MousePointerClick, Percent, Plus, Receipt, RotateCcw, Target, TrendingUp, Wallet,
} from 'lucide-react';
import { format } from '../../utils/format';
import { KPI_BY_KEY, movePrefs, shiftPrefs, togglePrefs, visibleKeys } from '../../utils/kpiCatalog';
import { useKpiPrefs } from './useKpiPrefs';
import '../../styles/KpiBoard.css';

const ICONS = { BadgeDollarSign, ChartColumn, Coins, Eye, MousePointerClick, Percent, Receipt, Target, TrendingUp, Wallet };
const FLAT_BAND = 0.5;

function Sparkline({ values }) {
  const points = values.filter(value => Number.isFinite(value));
  if (points.length < 2) return <span className="kpi-spark is-empty" aria-hidden="true" />;
  const min = Math.min(...points), max = Math.max(...points), span = max - min || 1;
  const step = 100 / (values.length - 1);
  let path = '', started = false;
  values.forEach((value, index) => {
    if (!Number.isFinite(value)) { started = false; return; }
    const x = (index * step).toFixed(2), y = (30 - ((value - min) / span) * 26 - 2).toFixed(2);
    path += `${started ? 'L' : 'M'}${x} ${y} `; started = true;
  });
  // A área só é desenhada quando não há dias sem dado no meio da linha.
  const solid = points.length === values.length;
  return <span className="kpi-spark-wrap" aria-hidden="true">
    <svg className="kpi-spark" viewBox="0 0 100 32" preserveAspectRatio="none" focusable="false">
      {solid && <path className="kpi-spark-area" d={`${path}L100 32 L0 32 Z`} />}
      <path className="kpi-spark-line" d={path} />
    </svg>
    <span className="kpi-spark-scale"><span>há {values.length - 1} dias</span><span>hoje</span></span>
  </span>;
}

function Change({ item, change, comparable }) {
  if (!comparable || change == null || !Number.isFinite(change)) return <p className="kpi-change is-none">Sem comparação disponível</p>;
  const flat = Math.abs(change) < FLAT_BAND;
  const up = change > 0;
  const tone = flat || item.better === 'neutral' ? 'is-flat' : (up === (item.better === 'up') ? 'is-better' : 'is-worse');
  const Arrow = flat ? Minus : up ? ArrowUp : ArrowDown;
  return <p className={`kpi-change ${tone}`}>
    <Arrow size={14} aria-hidden="true" />
    <span>{Math.abs(change).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% vs. período anterior</span>
  </p>;
}

/* Quadro de indicadores que o cliente monta: escolhe quais ficam à mostra e em que ordem (como organizar os ícones do celular). */
export default function KpiBoard({ data, defaultVisible, remote = false, title = 'Seus indicadores', description = 'Escolha o que fica à mostra no seu painel.' }) {
  const { prefs, update, reset } = useKpiPrefs(defaultVisible, { remote });
  const [editing, setEditing] = useState(false);
  const [dragKey, setDragKey] = useState(null);
  const [announce, setAnnounce] = useState('');

  const shown = visibleKeys(prefs);
  const keys = editing ? prefs.order : shown;
  const comparable = Boolean(data?.currentComplete && data?.previousComplete);
  const series = useMemo(() => Object.fromEntries(keys.map(key => [key, (data?.daily || []).map(day => (day.complete && day[key] != null ? Number(day[key]) : NaN))])), [data, keys]);

  const say = (key, text) => setAnnounce(`${KPI_BY_KEY[key].name} ${text}`);
  const toggle = key => { const hide = !prefs.hidden.includes(key); update(togglePrefs(prefs, key)); say(key, hide ? 'oculto do painel.' : 'adicionado ao painel.'); };
  const shift = (key, step) => {
    const next = shiftPrefs(prefs, key, step);
    if (next === prefs) return;
    update(next); say(key, `movido para a posição ${next.order.indexOf(key) + 1} de ${next.order.length}.`);
  };
  const dropOn = target => { if (dragKey && dragKey !== target) update(movePrefs(prefs, dragKey, target)); };

  return <section className={`kpi-board${editing ? ' is-editing' : ''}`} aria-labelledby="kpi-board-title">
    <header className="kpi-head">
      <div>
        <h2 id="kpi-board-title">{title}</h2>
        <p>{editing ? 'Arraste os cartões para reordenar. Use − para ocultar e + para mostrar.' : description}</p>
      </div>
      <div className="kpi-tools">
        {editing && <button type="button" className="kpi-btn" onClick={() => { reset(); setAnnounce('Indicadores restaurados para o padrão.'); }}><RotateCcw size={16} aria-hidden="true" /> Restaurar padrão</button>}
        {editing
          ? <button type="button" className="kpi-btn is-primary" onClick={() => setEditing(false)}><Check size={16} aria-hidden="true" /> Concluir</button>
          : <button type="button" className="kpi-btn" onClick={() => setEditing(true)}><LayoutGrid size={16} aria-hidden="true" /> Personalizar</button>}
      </div>
    </header>

    {editing && <p className="kpi-count">{shown.length} de {prefs.order.length} indicadores no painel</p>}
    <p className="sr-only" role="status" aria-live="polite">{announce}</p>

    {!keys.length
      ? <div className="kpi-empty"><p>Nenhum indicador no painel.</p><button type="button" className="kpi-btn" onClick={() => setEditing(true)}><Plus size={16} aria-hidden="true" /> Escolher indicadores</button></div>
      : <ul className="kpi-grid">
        {keys.map(key => {
          const item = KPI_BY_KEY[key], hidden = prefs.hidden.includes(key);
          const Icon = ICONS[item.icon];
          return <li
            key={key}
            className={`kpi-card hue-${item.hue}${hidden ? ' is-hidden' : ''}${dragKey === key ? ' is-dragging' : ''}`}
            draggable={editing}
            onDragStart={event => { setDragKey(key); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', key); }}
            onDragEnter={() => dropOn(key)}
            onDragOver={event => { if (editing) event.preventDefault(); }}
            onDragEnd={() => setDragKey(null)}
            onDrop={event => { event.preventDefault(); setDragKey(null); }}
          >
            <div className="kpi-top">
              <span className="kpi-icon"><Icon size={18} aria-hidden="true" /></span>
              <div className="kpi-names"><strong className="kpi-name">{item.name}</strong><span className="kpi-caption">{item.caption}</span></div>
            </div>
            <p className="kpi-value">{format(data?.totals?.[key], item.type, data?.currency)}</p>
            {editing
              ? <div className="kpi-edit" role="group" aria-label={`Ajustes de ${item.name}`}>
                <span className="kpi-grip" aria-hidden="true"><GripVertical size={18} /></span>
                <button type="button" className="kpi-move" onClick={() => shift(key, -1)} disabled={prefs.order[0] === key} aria-label={`Mover ${item.name} para trás`}><ChevronLeft size={16} aria-hidden="true" /></button>
                <button type="button" className="kpi-move" onClick={() => shift(key, 1)} disabled={prefs.order[prefs.order.length - 1] === key} aria-label={`Mover ${item.name} para frente`}><ChevronRight size={16} aria-hidden="true" /></button>
              </div>
              : <>
                <Change item={item} change={data?.changes?.[key]} comparable={comparable} />
                <Sparkline values={series[key] || []} />
              </>}
            {editing && <button type="button" className={`kpi-badge${hidden ? ' is-add' : ''}`} aria-pressed={!hidden} aria-label={hidden ? `Mostrar ${item.name}` : `Ocultar ${item.name}`} onClick={() => toggle(key)}>
              {hidden ? <Plus size={16} aria-hidden="true" /> : <Minus size={16} aria-hidden="true" />}
            </button>}
          </li>;
        })}
      </ul>}
  </section>;
}
