// As mobilizações: cada uma é um contrato, cliente ou obra para onde a
// operação manda frotas. Dentro dela ficam as frotas, cada uma com placa,
// tipo, motorista, as datas e a situação. Como nas programações, as telas só
// mudam pelas funções daqui, e cada mudança entra no histórico da mobilização.

import { banco, gravar } from "./armazem.js";
import { hoje, ehData, texto, normalizaFrota, semAcento, novoId, brCurto, dataPlanilha, csv } from "./util.js";

export const TIPOS = ["Cavalo mecânico", "Bitrem", "Prancha 04 eixos", "Prancha 04 eixos com dolly", "Prancha 05 eixos",
  "Prancha 06 eixos", "Prancha 06 eixos com dolly", "Linha de eixo", "Carga seca", "Veículo leve", "Outro"];

/** A situação da frota é escolhida por quem usa, um passo de cada vez. */
export const SITUACOES_FROTA = {
  aguardando: "Aguardando",
  mobilizando: "Em mobilização",
  mobilizada: "Mobilizada",
  desmobilizada: "Desmobilizada",
};
/** O próximo passo de cada situação e o nome do botão que leva a ele. */
export const PROXIMO = {
  aguardando: ["mobilizando", "Iniciar mobilização"],
  mobilizando: ["mobilizada", "Chegou"],
  mobilizada: ["desmobilizada", "Desmobilizar"],
};

/** A da mobilização é calculada pelas frotas. */
export const SITUACOES_MOB = {
  vazia: "Sem frotas",
  planejada: "Planejada",
  mobilizando: "Mobilizando",
  ativa: "Ativa",
  encerrada: "Encerrada",
};

export const todas = () => banco.mobilizacoes;
export const porId = id => banco.mobilizacoes.find(m => m.id === id);

/** Passou do dia de mobilizar e a frota ainda não chegou. */
export const atrasada = (f, ref = hoje()) =>
  (f.situacao === "aguardando" || f.situacao === "mobilizando") && !!f.dataMobilizacao && f.dataMobilizacao < ref;

export function situacaoMob(m) {
  const fs = m.frotas;
  if (!fs.length) return "vazia";
  if (fs.every(f => f.situacao === "desmobilizada")) return "encerrada";
  if (fs.some(f => f.situacao === "mobilizando")) return "mobilizando";
  if (fs.some(f => f.situacao === "mobilizada")) return "ativa";
  return "planejada";
}

/** Quantas frotas em cada situação: { aguardando: 2, mobilizada: 1, … }. */
export function contas(m) {
  const c = {};
  for (const f of m.frotas) c[f.situacao] = (c[f.situacao] || 0) + 1;
  return c;
}

export function casaBusca(m, termo) {
  if (!termo) return true;
  const alvo = semAcento([m.nome, m.local, m.obs, ...m.frotas.flatMap(f => [f.frota, f.placa, f.tipo, f.motorista])].join(" "));
  return semAcento(termo).split(/\s+/).filter(Boolean).every(p => alvo.includes(p));
}

/** As frotas e os motoristas já digitados, os mais usados primeiro. */
export function sugestoes(campo, extras = []) {
  const conta = new Map();
  for (const v of [...banco.mobilizacoes.flatMap(m => m.frotas.map(f => f[campo])), ...extras]) {
    if (v) conta.set(v, (conta.get(v) || 0) + 1);
  }
  return [...conta].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR", { numeric: true })).map(([v]) => v).slice(0, 60);
}

/** A placa e o tipo da última vez que a frota foi mobilizada — para não
 *  digitar de novo. */
export function conhecida(frota) {
  let achada = null;
  for (const m of banco.mobilizacoes) for (const f of m.frotas) if (f.frota === frota && (f.placa || f.tipo)) achada = f;
  return achada ? { placa: achada.placa, tipo: achada.tipo } : null;
}

/** A mesma frota em outra mobilização que ainda não a desmobilizou. */
export function emOutra(frota, mobId) {
  for (const m of banco.mobilizacoes) {
    if (m.id === mobId) continue;
    const f = m.frotas.find(x => x.frota === frota && x.situacao !== "desmobilizada");
    if (f) return { m, f };
  }
  return null;
}

// ── conferir o que veio do formulário ───────────────────────────────────────

/** "abc-1d23" → "ABC1D23". */
export const normalizaPlaca = v => String(v ?? "").toUpperCase().replace(/[\s-]/g, "").slice(0, 10);
const PLACA = /^[A-Z]{3}\d[A-Z0-9]\d{2}$/;   // a antiga (ABC1234) e a Mercosul (ABC1D23)

function conferirDatas(limpo, erros, de, ate, rotuloAte) {
  if (limpo[de] && !ehData(limpo[de])) erros[de] = "Data inválida.";
  if (limpo[ate] && !ehData(limpo[ate])) erros[ate] = "Data inválida.";
  else if (limpo[ate] && limpo[de] && limpo[ate] < limpo[de]) erros[ate] = `${rotuloAte} não pode ser antes do início.`;
}

export function conferirMob(d) {
  const limpo = {
    nome: texto(d.nome, 120),
    local: texto(d.local),
    inicio: String(d.inicio || ""),
    fimPrevisto: String(d.fimPrevisto || ""),
    obs: String(d.obs ?? "").trim().slice(0, 1000),
  };
  const erros = {};
  if (!limpo.nome) erros.nome = "Dê um nome: o contrato, o cliente ou a obra.";
  conferirDatas(limpo, erros, "inicio", "fimPrevisto", "O fim");
  return { limpo, erros };
}

/** Confere uma frota. Com `m`, recusa a mesma frota duas vezes na mesma
 *  mobilização (`id` é a que está sendo editada). */
export function conferirFrota(d, m = null, id = null) {
  const limpo = {
    frota: normalizaFrota(d.frota),
    placa: normalizaPlaca(d.placa),
    // aceita também um tipo que saiu de TIPOS: a frota que já o tinha não perde
    tipo: texto(d.tipo, 40),
    motorista: texto(d.motorista, 80),
    situacao: d.situacao in SITUACOES_FROTA ? d.situacao : "aguardando",
    dataMobilizacao: String(d.dataMobilizacao || ""),
    dataDesmobilizacao: String(d.dataDesmobilizacao || ""),
  };
  const erros = {};
  if (!limpo.frota) erros.frota = "Qual frota?";
  else if (m && m.frotas.some(f => f.frota === limpo.frota && f.id !== id)) erros.frota = `${limpo.frota} já está nesta mobilização — edite a que já existe.`;
  if (limpo.placa && !PLACA.test(limpo.placa)) erros.placa = "Placa no formato ABC1D23 ou ABC1234.";
  conferirDatas(limpo, erros, "dataMobilizacao", "dataDesmobilizacao", "A desmobilização");
  if (!erros.dataMobilizacao && !limpo.dataMobilizacao && (limpo.situacao === "mobilizada" || limpo.situacao === "desmobilizada")) {
    erros.dataMobilizacao = "Em que dia a frota chegou?";
  }
  if (!erros.dataDesmobilizacao && !limpo.dataDesmobilizacao && limpo.situacao === "desmobilizada") {
    erros.dataDesmobilizacao = "Em que dia saiu?";
  }
  return { limpo, erros };
}

// ── mudar ────────────────────────────────────────────────────────────────────

const agora = () => new Date().toISOString();
const anota = (m, txt) => { (m.historico ||= []).push({ quando: agora(), texto: txt }); };

const ROTULOS_MOB = { nome: "nome", local: "local", inicio: "início", fimPrevisto: "fim previsto", obs: "observações" };
const ROTULOS_FROTA = { frota: "frota", placa: "placa", tipo: "tipo", motorista: "motorista",
  dataMobilizacao: "data de mobilização", dataDesmobilizacao: "data de desmobilização" };
const mudou = (antes, depois, rotulos, fora = []) => Object.keys(rotulos)
  .filter(k => !fora.includes(k) && (antes[k] || "") !== (depois[k] || "")).map(k => rotulos[k]);

export function criarMob(limpo) {
  const m = { id: novoId(), ...limpo, frotas: [], criadaEm: agora(), historico: [] };
  anota(m, "Mobilização criada");
  banco.mobilizacoes.push(m);
  gravar();
  return m;
}

export function editarMob(id, limpo) {
  const m = porId(id);
  const lista = mudou(m, limpo, ROTULOS_MOB);
  if (lista.length) anota(m, "Editada: " + lista.join(", "));
  Object.assign(m, limpo);
  gravar();
  return m;
}

/** Apaga a mobilização com as frotas dela. Devolve o necessário para o
 *  "Desfazer". */
export function excluirMob(id) {
  const pos = banco.mobilizacoes.findIndex(m => m.id === id);
  if (pos < 0) return null;
  const [m] = banco.mobilizacoes.splice(pos, 1);
  gravar();
  return { m, pos };
}
export function devolverMob({ m, pos }) {
  banco.mobilizacoes.splice(Math.min(pos, banco.mobilizacoes.length), 0, m);
  gravar();
}

const nomeSit = s => SITUACOES_FROTA[s].toLowerCase();
const dataDaSit = f => f.situacao === "desmobilizada" ? f.dataDesmobilizacao
  : f.situacao === "mobilizada" ? f.dataMobilizacao : "";

export function adicionarFrota(mobId, limpo) {
  const m = porId(mobId);
  const f = { id: novoId(), ...limpo };
  m.frotas.push(f);
  anota(m, `${f.frota} adicionada — ${nomeSit(f.situacao)}` + (dataDaSit(f) ? ` em ${brCurto(dataDaSit(f))}` : ""));
  gravar();
  return f;
}

export function editarFrota(mobId, frotaId, limpo) {
  const m = porId(mobId);
  const f = m.frotas.find(x => x.id === frotaId);
  if (f.situacao !== limpo.situacao) {
    const depois = { ...f, ...limpo };
    anota(m, `${limpo.frota}: ${nomeSit(f.situacao)} → ${nomeSit(limpo.situacao)}` + (dataDaSit(depois) ? ` em ${brCurto(dataDaSit(depois))}` : ""));
  }
  // a data que veio com a troca de situação já está na linha de cima
  const fora = f.situacao === limpo.situacao ? [] : [limpo.situacao === "desmobilizada" ? "dataDesmobilizacao" : "dataMobilizacao"];
  const lista = mudou(f, limpo, ROTULOS_FROTA, fora);
  if (lista.length) anota(m, `${limpo.frota} editada: ${lista.join(", ")}`);
  Object.assign(f, limpo);
  gravar();
  return f;
}

export function removerFrota(mobId, frotaId) {
  const m = porId(mobId);
  const pos = m.frotas.findIndex(x => x.id === frotaId);
  if (pos < 0) return null;
  const [f] = m.frotas.splice(pos, 1);
  anota(m, `${f.frota} removida`);
  gravar();
  return { mobId, f, pos };
}
export function devolverFrota({ mobId, f, pos }) {
  const m = porId(mobId);
  if (!m) return;
  m.frotas.splice(Math.min(pos, m.frotas.length), 0, f);
  anota(m, `${f.frota} voltou (remoção desfeita)`);
  gravar();
}

// ── guardar e backup ─────────────────────────────────────────────────────────

/** O que veio do navegador tem o mínimo para a tela não quebrar? */
export const legivel = m => !!m && typeof m.id === "string" && typeof m.nome === "string" && Array.isArray(m.frotas);

const historico = h => Array.isArray(h)
  ? h.filter(x => x && typeof x.texto === "string").map(x => ({ quando: String(x.quando || ""), texto: x.texto }))
  : [];

/** Limpa as mobilizações de um backup. A sem nome é ignorada; a frota que não
 *  passa na conferência também. */
export function sanear(lista) {
  const boas = [];
  let ignoradas = 0;
  for (const bruto of lista) {
    const { limpo, erros } = conferirMob(bruto || {});
    if (Object.keys(erros).length) { ignoradas++; continue; }
    const m = {
      ...limpo,
      id: typeof bruto.id === "string" && bruto.id ? bruto.id : novoId(),
      frotas: [],
      criadaEm: typeof bruto.criadaEm === "string" ? bruto.criadaEm : agora(),
      historico: historico(bruto.historico),
    };
    for (const bf of Array.isArray(bruto.frotas) ? bruto.frotas : []) {
      const r = conferirFrota(bf || {}, m);
      if (Object.keys(r.erros).length) continue;
      m.frotas.push({ id: typeof bf.id === "string" && bf.id ? bf.id : novoId(), ...r.limpo });
    }
    boas.push(m);
  }
  return { boas, ignoradas };
}

/** As mobilizações em CSV: uma linha por frota (a mobilização sem frota
 *  também sai, numa linha só). */
export function planilha(lista, ref = hoje()) {
  const cab = ["Mobilização", "Local", "Início", "Fim previsto", "Situação da mobilização", "Frota", "Placa", "Tipo",
    "Motorista", "Situação da frota", "Mobilização da frota", "Desmobilização da frota", "Atrasada"];
  const linhas = [];
  for (const m of lista) {
    const base = [m.nome, m.local, dataPlanilha(m.inicio), dataPlanilha(m.fimPrevisto), SITUACOES_MOB[situacaoMob(m)]];
    if (!m.frotas.length) linhas.push([...base, "", "", "", "", "", "", "", ""]);
    for (const f of m.frotas) {
      linhas.push([...base, f.frota, f.placa, f.tipo, f.motorista, SITUACOES_FROTA[f.situacao],
        dataPlanilha(f.dataMobilizacao), dataPlanilha(f.dataDesmobilizacao), atrasada(f, ref) ? "Sim" : ""]);
    }
  }
  return csv([cab, ...linhas]);
}
