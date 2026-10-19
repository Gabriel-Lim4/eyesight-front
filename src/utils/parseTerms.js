/* Transforma o texto simples dos termos (content/terms.txt) em uma estrutura que a tela consegue organizar:
   dois documentos (Termos de Uso e Política de Privacidade), cada um com seções numeradas,
   cláusulas "1.1." e listas com "- ". O texto continua sendo editado no .txt, sem tocar em código. */

const SEPARATOR = /^={5,}\s*$/;
const SECTION = /^(\d+)\.\s+(\S.*)$/;
const CLAUSE = /^(\d+\.\d+)\.\s+(\S.*)$/;
const BULLET = /^-\s+(.*)$/;
const UPDATED = /^Última atualização:\s*(.+)$/i;

const titleCase = text => {
  const small = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'o', 'a', 'em', 'para', 'por', 'com', 'que', 'ao']);
  return text.toLowerCase().split(' ').map((word, index) => (index > 0 && small.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1))).join(' ')
    .replace(/\bEyesight\b/g, 'Eyesight').replace(/\bLgpd\b/g, 'LGPD').replace(/\bTcc\b/g, 'TCC');
};

function parseDocument(lines, index) {
  const nonEmpty = lines.filter(line => line.trim());
  const title = nonEmpty[0] ? titleCase(nonEmpty[0].trim()) : `Documento ${index + 1}`;
  const doc = { id: `doc-${index + 1}`, title, updated: '', intro: [], sections: [] };
  let section = null, list = null, paragraph = null;

  const closeList = () => { list = null; };
  const closeParagraph = () => { paragraph = null; };
  const push = block => { (section ? section.blocks : doc.intro).push(block); };

  lines.slice(lines.indexOf(nonEmpty[0]) + 1).forEach(raw => {
    const line = raw.trim();
    if (!line) { closeList(); closeParagraph(); return; }
    const updated = UPDATED.exec(line);
    if (updated && !section) { doc.updated = updated[1]; return; }
    const head = SECTION.exec(line);
    if (head && !CLAUSE.test(line) && line === line.toUpperCase()) {
      section = { id: `${doc.id}-s${head[1]}`, number: head[1], title: titleCase(head[2]), blocks: [] };
      doc.sections.push(section); closeList(); closeParagraph(); return;
    }
    const bullet = BULLET.exec(line);
    if (bullet) {
      if (!list) { list = { type: 'list', items: [] }; push(list); }
      list.items.push(bullet[1]); closeParagraph(); return;
    }
    const clause = CLAUSE.exec(line);
    if (clause) { paragraph = { type: 'clause', number: clause[1], text: clause[2] }; push(paragraph); closeList(); return; }
    // linha de continuação: junta ao bloco anterior em vez de criar um parágrafo solto
    if (list && !paragraph) { list.items[list.items.length - 1] += ` ${line}`; return; }
    if (paragraph) { paragraph.text += ` ${line}`; return; }
    paragraph = { type: 'text', text: line }; push(paragraph); closeList();
  });
  return doc;
}

export function parseTerms(source = '') {
  const chunks = source.replace(/\r\n/g, '\n').split('\n').reduce((acc, line) => {
    if (SEPARATOR.test(line)) acc.push([]); else acc[acc.length - 1].push(line);
    return acc;
  }, [[]]);
  return chunks.filter(lines => lines.some(line => line.trim())).map(parseDocument);
}
