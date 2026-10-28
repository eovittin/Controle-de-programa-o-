// Onde tudo fica guardado: no navegador (localStorage), numa chave só, com as
// programações e as mobilizações juntas — assim um backup leva as duas.
//
// As listas de `banco` nunca são trocadas por outras, só esvaziadas e
// preenchidas de novo (`troca`): quem guardou a referência continua vendo a
// lista certa.

const CHAVE = "programacao-operacao:v1";

export const banco = { itens: [], mobilizacoes: [] };

let aoMudar = () => {};
export const quandoMudar = fn => { aoMudar = fn; };

function armazem() {
  try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; }
}

/** O que está guardado, ou null. */
export function ler() {
  try {
    const bruto = armazem()?.getItem(CHAVE);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

/** Grava e avisa a tela. Devolve false se o navegador recusou (cheio, ou
 *  janela anônima que não guarda). */
export function gravar() {
  let ok = true;
  try { armazem()?.setItem(CHAVE, JSON.stringify({ versao: 1, ...banco })); } catch { ok = false; }
  aoMudar(ok);
  return ok;
}

export function troca(lista, novos) {
  lista.length = 0;
  lista.push(...novos);
}
