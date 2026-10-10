// Gera as variáveis de cor a partir da linha de base (e das constantes extras da migração).
// Uso: npm run theme:tokens            (mostra o resumo)
//      npm run theme:tokens -- --write  (grava o bloco em src/styles/variables.css)
import process from 'node:process';
import { loadTokens, writeTokensBlock } from './theme/tokens-io.mjs';

const tokens = loadTokens();
const varying = tokens.filter(token => token.varying);
console.log(`${tokens.length} variáveis (${varying.length} mudam com o tema, ${tokens.length - varying.length} são constantes); ${tokens.filter(token => token.existing).length} já existiam em variables.css.`);
console.log('\n| variável | escuro | claro | usos |\n|---|---|---|---|');
for (const token of tokens) console.log(`| \`${token.name}\` | \`${token.dark}\` | \`${token.light}\` | ${token.count} |`);

if (process.argv.includes('--write')) {
  writeTokensBlock(tokens);
  console.log('\nBloco gravado em src/styles/variables.css.');
}
process.exit(0);
