import { useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowRight, FiMenu, FiPlus, FiX } from "react-icons/fi";

import "../styles/Home.css";
import "../styles/variables.css";

import logo from "../assets/Logo.png";
import dashboard from "../assets/dashboard.png";
import dashboardLight from "../assets/dashboard-light.png";

import ThemeToggle from "../components/ThemeToggle";
import { useTheme } from "../hooks/useTheme";

// ============================================
// VEREDITO DE EXEMPLO (hero)
// Frases iguais às do painel (utils/verdictCopy.js); os valores são ilustrativos.
// ============================================

const veredictos = [
  {
    id: "good",
    rotulo: "Dentro da meta",
    titulo: "Seus anúncios estão dentro da sua meta.",
    motivo: "Cada resultado custa R$ 6,80, abaixo da sua meta de R$ 9,00.",
    acao: "Nada urgente por enquanto. Continue acompanhando.",
  },
  {
    id: "stable",
    rotulo: "Estável",
    titulo: "Seus anúncios estão estáveis em relação aos 7 dias anteriores.",
    motivo: "O custo por resultado ficou em R$ 8,10 (variação de 1,2%).",
    acao: "Nada urgente por enquanto. Continue acompanhando.",
  },
  {
    id: "attention",
    rotulo: "Atenção",
    titulo: "Atenção: o custo por resultado está acima da sua meta.",
    motivo: "Cada resultado custa R$ 12,40, acima da sua meta de R$ 9,00.",
    acao: "A campanha 'Remarketing' está custando R$ 21,50 por resultado, acima da sua meta de R$ 9,00.",
  },
];

const hoje = ["Instagram", "Meta Ads", "Google Ads", "Planilhas", "Relatórios separados"];

const comEyesight = [
  "Todas as plataformas conectadas",
  "Informações em um único painel",
  "Comparação rápida entre campanhas",
  "Assistente para apoiar análises",
];

const passos = [
  {
    titulo: "Conectar contas",
    texto:
      "Autorize o Google Ads e o Meta Ads. Perfis profissionais do Instagram são consultados pela integração Meta.",
  },
  {
    titulo: "Ver tudo junto",
    texto: "As métricas chegam organizadas no painel, sem precisar exportar nada.",
  },
  {
    titulo: "Entender o que fazer",
    texto: "O assistente aponta o que está funcionando e o que vale pausar.",
  },
];

const publicos = [
  {
    titulo: "Agências pequenas",
    texto: "Centralize o relatório de cada cliente sem abrir cinco abas diferentes toda manhã.",
  },
  {
    titulo: "Freelancers de tráfego",
    texto: "Mostre resultado pro cliente sem precisar montar planilha na mão antes da reunião.",
  },
  {
    titulo: "Lojas online",
    texto: "Veja se o investimento em anúncio está voltando em venda, não só em clique.",
  },
];

const recursos = [
  {
    titulo: "Google Ads",
    texto: "Acompanhe campanhas, conversões, investimento e retorno sobre anúncios.",
  },
  {
    titulo: "Meta Ads",
    texto: "Visualize campanhas do Facebook e Instagram em um único painel.",
  },
  {
    titulo: "Facebook & Instagram",
    texto:
      "Acompanhe campanhas Meta e consulte seguidores e alcance de perfis profissionais do Instagram.",
  },
  {
    titulo: "Assistente Inteligente",
    texto: "Receba recomendações baseadas nos dados das campanhas.",
  },
  {
    titulo: "Exportação de relatórios",
    texto: "Exporte os dados do período em CSV para usar em planilhas e relatórios.",
  },
  {
    titulo: "Alertas personalizados",
    texto:
      "Confira no painel quais campanhas ultrapassam os limites de desempenho que você definiu.",
  },
];

const faqItems = [
  {
    question: "Preciso ter conta em todas as plataformas de anúncio?",
    answer:
      "Não. Você conecta só as que já usa hoje e pode adicionar as outras depois, sem precisar refazer nada.",
  },
  {
    question: "Preciso criar conta para ver como funciona?",
    answer:
      "Não. A demonstração abre sem cadastro e usa dados de exemplo, então você vê o painel antes de conectar qualquer conta.",
  },
  {
    question: "Os dados são atualizados em tempo real?",
    answer:
      "Você solicita a sincronização no painel e escolhe o período. Os números dependem da atualização e das permissões de cada plataforma; não são dados em tempo real.",
  },
  {
    question: "O assistente substitui um gestor de tráfego?",
    answer:
      "Não. Ele ajuda a enxergar padrões nos dados mais rápido, mas quem decide a estratégia continua sendo você.",
  },
  {
    question: "O Eyesight é gratuito?",
    answer:
      "Este é um projeto acadêmico (TCC), então por enquanto o acesso é voltado para testes e demonstração.",
  },
];

const integrantes = [
  { nome: "Clara Vau", papel: "Desenvolvimento Front-end" },
  { nome: "Davi Scavassa", papel: "Diário de Bordo" },
  { nome: "Enrico Fedel", papel: "Documentação" },
  { nome: "Felipe Branchini", papel: "Banco de Dados" },
  { nome: "Gabriel Oliveira", papel: "Desenvolvimento Back-end" },
];

const links = [
  ["#sobre", "Sobre"],
  ["#como-funciona", "Como funciona"],
  ["#demo", "Demonstração"],
  ["#funcionalidades", "Recursos"],
  ["#faq", "Dúvidas"],
];

// ============================================
// HOME
// ============================================

function Home() {
  const [veredictoId, setVeredictoId] = useState("attention");
  const [openFaq, setOpenFaq] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const { lightMode } = useTheme();

  const veredicto = veredictos.find((item) => item.id === veredictoId);
  const closeMenu = () => setMenuOpen(false);

  const moveTab = (event, index) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = veredictos[(index + step + veredictos.length) % veredictos.length];
    setVeredictoId(next.id);
    document.getElementById(`lp-tab-${next.id}`)?.focus();
  };

  return (
    <div className="home lp">
      <header className="lp-nav">
        <div className="lp-wrap lp-nav-inner">
          <a href="#inicio" className="lp-brand" onClick={closeMenu}>
            <img src={logo} alt="" />
            <span>Eyesight</span>
          </a>

          <nav
            id="lp-menu"
            className={`lp-links${menuOpen ? " open" : ""}`}
            aria-label="Seções da página"
          >
            {links.map(([href, texto]) => (
              <a key={href} href={href} onClick={closeMenu}>
                {texto}
              </a>
            ))}
            <Link to="/login" className="lp-menu-only" onClick={closeMenu}>
              Entrar
            </Link>
            <Link to="/cadastro" className="lp-menu-only" onClick={closeMenu}>
              Cadastrar
            </Link>
          </nav>

          <div className="lp-nav-actions">
            <Link to="/login" className="lp-link-quiet">
              Entrar
            </Link>
            <Link to="/cadastro" className="lp-btn lp-btn-solid lp-btn-small lp-nav-register">
              Cadastrar
            </Link>
            <ThemeToggle className="lp-theme" />
            <button
              type="button"
              className="lp-menu-toggle"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={menuOpen}
              aria-controls="lp-menu"
            >
              {menuOpen ? <FiX /> : <FiMenu />}
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        {/* HERO: a frase do veredito é a própria mensagem do produto */}
        <section id="inicio" className="lp-hero">
          <div className="lp-wrap lp-hero-grid">
            <div className="lp-hero-copy">
              <h1>Seus anúncios estão indo bem? Descubra em uma frase.</h1>
              <p className="lp-lead">
                O Eyesight reúne os números do Google Ads, do Meta Ads e do
                Instagram e responde em português simples: está bom, está
                estável ou pede atenção, e o que fazer agora.
              </p>
              <div className="lp-actions">
                <Link to="/demo" className="lp-btn lp-btn-solid">
                  Explorar demonstração
                  <FiArrowRight aria-hidden="true" />
                </Link>
                <Link to="/cadastro" className="lp-btn lp-btn-line">
                  Criar conta
                </Link>
              </div>
              <p className="lp-hero-note">
                A demonstração abre sem cadastro e usa dados de exemplo.
              </p>
            </div>

            <div className="lp-verdict" data-status={veredicto.id}>
              <p className="lp-verdict-ask" id="lp-verdict-ask">
                Como estão seus anúncios?
              </p>
              <div className="lp-tabs" role="tablist" aria-labelledby="lp-verdict-ask">
                {veredictos.map((item, index) => (
                  <button
                    key={item.id}
                    id={`lp-tab-${item.id}`}
                    type="button"
                    role="tab"
                    aria-selected={item.id === veredictoId}
                    aria-controls="lp-verdict-panel"
                    tabIndex={item.id === veredictoId ? 0 : -1}
                    data-status={item.id}
                    onClick={() => setVeredictoId(item.id)}
                    onKeyDown={(event) => moveTab(event, index)}
                  >
                    {item.rotulo}
                  </button>
                ))}
              </div>
              <div
                id="lp-verdict-panel"
                role="tabpanel"
                aria-labelledby={`lp-tab-${veredicto.id}`}
                className="lp-verdict-panel"
                key={veredicto.id}
              >
                <p className="lp-verdict-title">{veredicto.titulo}</p>
                <p className="lp-verdict-reason">{veredicto.motivo}</p>
                <div className="lp-verdict-action">
                  <strong>O que fazer</strong>
                  <p>{veredicto.acao}</p>
                </div>
              </div>
              <p className="lp-verdict-note">
                Exemplo com dados de demonstração. Os valores são ilustrativos.
              </p>
            </div>
          </div>
        </section>

        {/* COMPARAÇÃO */}
        <section id="comparacao" className="lp-section lp-compare">
          <div className="lp-wrap">
            <h2>Menos abas. Mais clareza.</h2>
            <div className="lp-compare-grid">
              <div>
                <h3>Hoje: um lugar para cada número</h3>
                <ul className="lp-before">
                  {hoje.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Com o Eyesight: um lugar só</h3>
                <ul className="lp-after">
                  {comEyesight.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* DEMONSTRAÇÃO */}
        <section id="demo" className="lp-section lp-band">
          <div className="lp-wrap">
            <div className="lp-head">
              <h2>Veja o painel por dentro</h2>
              <p>
                Métricas de diferentes plataformas em um único painel, com
                análises do assistente sobre os dados sincronizados.
              </p>
            </div>
            <figure className="lp-frame">
              <div className="lp-frame-bar" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <img
                src={lightMode ? dashboardLight : dashboard}
                alt="Painel do Eyesight com indicadores de investimento, cliques e resultados, e gráficos de desempenho semanal"
                loading="lazy"
              />
            </figure>
          </div>
        </section>

        {/* COMO FUNCIONA: sequência real, por isso numerada */}
        <section id="como-funciona" className="lp-section">
          <div className="lp-wrap">
            <h2>Do login ao insight, em três passos</h2>
            <ol className="lp-steps">
              {passos.map((passo) => (
                <li key={passo.titulo}>
                  <h3>{passo.titulo}</h3>
                  <p>{passo.texto}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* PARA QUEM É */}
        <section className="lp-section lp-band">
          <div className="lp-wrap lp-split">
            <h2>Feito pra quem lida com número de campanha todo dia</h2>
            <dl className="lp-rows">
              {publicos.map((item) => (
                <div key={item.titulo}>
                  <dt>{item.titulo}</dt>
                  <dd>{item.texto}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* SOBRE */}
        <section id="sobre" className="lp-section">
          <div className="lp-wrap lp-split">
            <h2>Um painel só, pros dados que hoje vivem espalhados</h2>
            <div className="lp-prose">
              <p>
                O Eyesight nasceu como projeto de TCC do curso de
                Desenvolvimento de Sistemas, a partir de um problema comum:
                quem cuida de campanha de marketing digital acaba abrindo o
                painel de cada plataforma separadamente só pra montar um
                relatório.
              </p>
              <p>
                Aqui, os dados de Google Ads, Meta Ads e perfis profissionais
                do Instagram chegam organizados num só lugar, facilitando a
                comparação das campanhas e o acompanhamento dos resultados.
              </p>
            </div>
          </div>
        </section>

        {/* RECURSOS */}
        <section id="funcionalidades" className="lp-section lp-band">
          <div className="lp-wrap">
            <h2>Tudo o que você precisa para acompanhar seus resultados</h2>
            <ul className="lp-features">
              {recursos.map((item) => (
                <li key={item.titulo}>
                  <h3>{item.titulo}</h3>
                  <p>{item.texto}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="lp-section">
          <div className="lp-wrap lp-split">
            <h2>Ainda com dúvida?</h2>
            <div className="lp-faq">
              {faqItems.map((item, index) => {
                const isOpen = openFaq === index;
                return (
                  <div key={item.question} className={`lp-faq-item${isOpen ? " open" : ""}`}>
                    <h3>
                      <button
                        type="button"
                        id={`lp-faq-q-${index}`}
                        aria-expanded={isOpen}
                        aria-controls={`lp-faq-a-${index}`}
                        onClick={() => setOpenFaq(isOpen ? null : index)}
                      >
                        <span>{item.question}</span>
                        <FiPlus aria-hidden="true" />
                      </button>
                    </h3>
                    <div
                      id={`lp-faq-a-${index}`}
                      role="region"
                      aria-labelledby={`lp-faq-q-${index}`}
                      className="lp-faq-answer"
                      hidden={!isOpen}
                    >
                      <p>{item.answer}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="lp-section lp-cta">
          <div className="lp-wrap">
            <div className="lp-cta-copy">
              <h2>Curioso pra ver seus números num lugar só?</h2>
              <p>
                Explore uma demonstração identificada, com dados de exemplo,
                sem criar conta.
              </p>
            </div>
            <div className="lp-actions">
              <Link to="/demo" className="lp-btn lp-btn-solid">
                Explorar demonstração
                <FiArrowRight aria-hidden="true" />
              </Link>
              <Link to="/cadastro" className="lp-btn lp-btn-line">
                Cadastrar
              </Link>
            </div>
          </div>
        </section>

        {/* EQUIPE */}
        <section id="equipe" className="lp-section lp-team">
          <div className="lp-wrap lp-split">
            <h2>Quem construiu o Eyesight</h2>
            <ul className="lp-people">
              {integrantes.map((pessoa) => (
                <li key={pessoa.nome + pessoa.papel}>
                  <strong>{pessoa.nome}</strong>
                  <span>{pessoa.papel}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-inner">
          <a href="#inicio" className="lp-brand">
            <img src={logo} alt="" />
            <span>Eyesight</span>
          </a>
          <p>Eyesight © 2026</p>
          <p>Projeto de Trabalho de Conclusão de Curso</p>
        </div>
      </footer>
    </div>
  );
}

export default Home;
