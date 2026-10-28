// Os dados da programação: o que é cada item e o que muda nele. As telas só
// leem daqui e só mudam pelas funções daqui — assim toda mudança passa pelo
// histórico do item. Aqui também ficam o carregar, o backup e o apagar tudo,
// que valem para as programações e as mobilizações juntas.
//
// Tudo fica no navegador (armazem.js). Para levar para outro aparelho ou
// guardar uma cópia: Dados → Baixar backup, e Restaurar backup no outro.

import { hoje, ehData, ehHora, somaDias, difDias, diaDaSemana, brCurto, semAcento, novoId, plural,
  texto, normalizaFrota, dataPlanilha, csv } from "./util.js";
import { banco, ler, gravar as salvar, troca } from "./armazem.js";
import * as M from "./mobilizacoes.js";

export { quandoMudar } from "./armazem.js";
export { normalizaFrota };

export const CATEGORIAS = [
  { id: "viagem", nome: "Viagem" },
  { id: "carregamento", nome: "Carregamento" },
  { id: "entrega", nome: "Entrega / descarga" },
  { id: "oficina", nome: "Levar à oficina" },
  { id: "lavagem", nome: "Lavagem" },
  { id: "top", nome: "TOP / inspeção" },
  { id: "abastecimento", nome: "Abastecimento" },
  { id: "documentacao", nome: "Documentação" },
  { id: "outros", nome: "Outros" },
];
export const nomeCategoria = id => (CATEGORIAS.find(c => c.id === id) || CATEGORIAS.at(-1)).nome;

export const PRIORIDADES = [
  { id: "alta", nome: "Alta" },
  { id: "media", nome: "Média" },
  { id: "baixa", nome: "Baixa" },
];
export const nomePrioridade = id => (PRIORIDADES.find(p => p.id === id) || PRIORIDADES[1]).nome;

/** A situação é calculada (ver `situacao`), não guardada: "atrasada" e "para
 *  hoje" mudam sozinhas com o passar dos dias. */
export const SITUACOES = {
  programada: "Programada",
  hoje: "Para hoje",
  andamento: "Em andamento",
  atrasada: "Atrasada",
  concluida: "Concluída",
  "concluida-atraso": "Concluída com atraso",
  cancelada: "Cancelada",
};
export const ABERTAS = ["programada", "hoje", "andamento", "atrasada"];

export const MOTIVOS_ATRASO = ["Outra prioridade", "Frota em viagem", "Sem motorista", "Esperando carga ou cliente",
  "Problema mecânico", "Clima ou estrada", "Fornecedor ou terceiro", "Outro motivo"];
export const MOTIVOS_REMARCAR = ["Pedido do cliente", "Frota indisponível", "Sem motorista", "Outra prioridade",
  "Clima ou estrada", "Manutenção da frota", "Outro motivo"];

// ── guardar ──────────────────────────────────────────────────────────────────

const itens = banco.itens;

/** Lê do navegador as programações e as mobilizações. */
export function carregar() {
  const lido = ler();
  troca(itens, Array.isArray(lido?.itens) ? lido.itens.filter(i => i && i.id && ehData(i.data)) : []);
  troca(banco.mobilizacoes, Array.isArray(lido?.mobilizacoes) ? lido.mobilizacoes.filter(M.legivel) : []);
  return itens;
}

export const todos = () => itens;
export const porId = id => itens.find(i => i.id === id);

// ── ler ──────────────────────────────────────────────────────────────────────

/** O último dia do item: o "até", quando ele dura mais de um dia. */
export const prazo = it => (it.dataFim && it.dataFim > it.data ? it.dataFim : it.data);

export function situacao(it, ref = hoje()) {
  if (it.status === "cancelada") return "cancelada";
  if (it.status === "concluida") return it.concluidaEm && it.concluidaEm > prazo(it) ? "concluida-atraso" : "concluida";
  if (prazo(it) < ref) return "atrasada";
  if (it.status === "andamento") return "andamento";
  if (it.data <= ref) return "hoje";
  return "programada";
}

/** Os dias em que o item aparece no calendário (até 62, para um "até" errado
 *  não encher o mês). */
export function diasDo(it) {
  const n = Math.min(difDias(it.data, prazo(it)), 61);
  return Array.from({ length: n + 1 }, (_, i) => somaDias(it.data, i));
}

/** O item cai entre `de` e `ate` (inclusive)? */
export const noPeriodo = (it, de, ate) => it.data <= ate && prazo(it) >= de;

/** Ordem do dia: com hora primeiro (pela hora), depois a prioridade e a frota. */
const PESO_PRIO = { alta: 0, media: 1, baixa: 2 };
export function ordemDoDia(a, b) {
  return (a.horaInicio || "99").localeCompare(b.horaInicio || "99") ||
    (PESO_PRIO[a.prioridade] ?? 1) - (PESO_PRIO[b.prioridade] ?? 1) ||
    (a.frota || "~").localeCompare(b.frota || "~", "pt-BR", { numeric: true }) ||
    a.atividade.localeCompare(b.atividade, "pt-BR");
}

export function casaBusca(it, termo) {
  if (!termo) return true;
  const alvo = semAcento([it.frota, it.atividade, it.onde, it.responsavel, it.obs, nomeCategoria(it.categoria)].join(" "));
  return semAcento(termo).split(/\s+/).filter(Boolean).every(p => alvo.includes(p));
}

/** "08:00–12:00", "08:00" ou "". */
export const horario = it => it.horaInicio ? it.horaInicio + (it.horaFim ? "–" + it.horaFim : "") : "";

/** "F-617 · Viagem para Natal" — o nome do item nas listas. */
export const titulo = it => (it.frota ? it.frota + " · " : "") + it.atividade;

/** Os valores que a equipe já digitou num campo, os mais usados primeiro. */
export function sugestoes(campo) {
  const conta = new Map();
  for (const it of itens) if (it[campo]) conta.set(it[campo], (conta.get(it[campo]) || 0) + 1);
  return [...conta].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR")).map(([v]) => v).slice(0, 40);
}

// ── conferir o que veio do formulário ───────────────────────────────────────

/** Confere e limpa os campos. Devolve { limpo, erros }: `erros` tem o campo
 *  e a frase para mostrar ao lado dele. */
export function conferir(d) {
  const limpo = {
    frota: normalizaFrota(d.frota),
    categoria: CATEGORIAS.some(c => c.id === d.categoria) ? d.categoria : "outros",
    atividade: texto(d.atividade),
    onde: texto(d.onde),
    data: String(d.data || ""),
    dataFim: String(d.dataFim || ""),
    horaInicio: String(d.horaInicio || ""),
    horaFim: String(d.horaFim || ""),
    responsavel: texto(d.responsavel, 80),
    prioridade: PRIORIDADES.some(p => p.id === d.prioridade) ? d.prioridade : "media",
    obs: String(d.obs ?? "").trim().slice(0, 1000),
  };
  const erros = {};
  if (!limpo.atividade) erros.atividade = "Diga o que vai ser feito.";
  if (!ehData(limpo.data)) erros.data = "Escolha o dia.";
  if (limpo.dataFim && !ehData(limpo.dataFim)) erros.dataFim = "Data inválida.";
  else if (limpo.dataFim && limpo.dataFim < limpo.data) erros.dataFim = "O fim não pode ser antes do início.";
  if (limpo.dataFim === limpo.data) limpo.dataFim = "";
  if (limpo.horaInicio && !ehHora(limpo.horaInicio)) erros.horaInicio = "Hora inválida.";
  if (limpo.horaFim && !ehHora(limpo.horaFim)) erros.horaFim = "Hora inválida.";
  else if (limpo.horaFim && !limpo.horaInicio) erros.horaInicio = "Falta a hora de início.";
  else if (limpo.horaFim && !limpo.dataFim && limpo.horaFim <= limpo.horaInicio) erros.horaFim = "Termina antes de começar.";
  return { limpo, erros };
}

// ── mudar ────────────────────────────────────────────────────────────────────

const agora = () => new Date().toISOString();
const anota = (it, txt) => { (it.historico ||= []).push({ quando: agora(), texto: txt }); };

/** As datas em que um item se repete: "dia" (todo dia), "util" (segunda a
 *  sexta) ou "semana" (mesmo dia da semana), de `data` até `ate`. No máximo 120. */
export function repeticoes(data, modo, ate) {
  if (!modo || !ehData(ate) || ate < data) return [data];
  const dias = [];
  for (let d = data; d <= ate && dias.length < 120; d = somaDias(d, modo === "semana" ? 7 : 1)) {
    if (modo === "util" && diaDaSemana(d) > 4) continue;
    dias.push(d);
  }
  return dias.length ? dias : [data];
}

/** Cria um item, ou um por dia de `dias` (a repetição). Devolve os criados. */
export function criar(limpo, dias = [limpo.data]) {
  const dur = limpo.dataFim ? difDias(limpo.data, limpo.dataFim) : 0;
  const grupo = dias.length > 1 ? novoId() : undefined;
  const criados = dias.map(d => {
    const it = { id: novoId(), ...limpo, data: d, dataFim: dur ? somaDias(d, dur) : "",
      status: "programada", remarcacoes: 0, criadaEm: agora(), historico: [] };
    if (grupo) it.grupo = grupo;
    anota(it, dias.length > 1 ? `Programada (repetição, ${dias.length} dias)` : "Programada");
    return it;
  });
  itens.push(...criados);
  salvar();
  return criados;
}

const ROTULOS = { frota: "frota", categoria: "categoria", atividade: "o que fazer", onde: "onde",
  horaInicio: "horário", horaFim: "horário", responsavel: "responsável", prioridade: "prioridade", obs: "observações" };

/** Mudou o dia (ou o "até")? Então é remarcação, e pede o motivo. */
export const remarca = (it, limpo) => it.data !== limpo.data || (it.dataFim || "") !== (limpo.dataFim || "");

export function editar(id, limpo, motivo = "") {
  const it = porId(id);
  if (!it) return null;
  const mudou = [...new Set(Object.keys(ROTULOS).filter(k => (it[k] || "") !== (limpo[k] || "")).map(k => ROTULOS[k]))];
  if (remarca(it, limpo)) {
    const de = brCurto(it.data) + (it.dataFim ? "–" + brCurto(it.dataFim) : "");
    const para = brCurto(limpo.data) + (limpo.dataFim ? "–" + brCurto(limpo.dataFim) : "");
    it.dataOriginal ||= it.data;
    it.remarcacoes = (it.remarcacoes || 0) + 1;
    anota(it, `Remarcada de ${de} para ${para}` + (motivo ? ` — ${motivo}` : ""));
  }
  if (mudou.length) anota(it, "Editada: " + mudou.join(", "));
  Object.assign(it, limpo);
  salvar();
  return it;
}

export function iniciar(id) {
  const it = porId(id);
  it.status = "andamento";
  anota(it, "Iniciada");
  salvar();
}

/** Conclui no dia `quando`. Depois do prazo, guarda o motivo do atraso. */
export function concluir(id, quando, motivo = "", detalhe = "") {
  const it = porId(id);
  it.status = "concluida";
  it.concluidaEm = quando;
  const atraso = difDias(prazo(it), quando);
  if (atraso > 0) {
    it.motivoAtraso = motivo;
    it.detalheAtraso = texto(detalhe, 300);
    anota(it, `Concluída em ${brCurto(quando)}, ${plural(atraso, "dia", "dias")} depois do prazo — ${motivo}` +
      (it.detalheAtraso ? ` (${it.detalheAtraso})` : ""));
  } else {
    delete it.motivoAtraso; delete it.detalheAtraso;
    anota(it, `Concluída em ${brCurto(quando)}`);
  }
  salvar();
}

export function reabrir(id) {
  const it = porId(id);
  it.status = "programada";
  delete it.concluidaEm; delete it.motivoAtraso; delete it.detalheAtraso;
  anota(it, "Reaberta");
  salvar();
}

export function cancelar(id, motivo) {
  const it = porId(id);
  it.status = "cancelada";
  it.motivoCancelamento = texto(motivo, 300);
  anota(it, "Cancelada — " + it.motivoCancelamento);
  salvar();
}

export function restaurar(id) {
  const it = porId(id);
  it.status = "programada";
  delete it.motivoCancelamento;
  anota(it, "Cancelamento desfeito");
  salvar();
}

/** Apaga de vez. Devolve o item e a posição, para o "Desfazer". */
export function excluir(id) {
  const pos = itens.findIndex(i => i.id === id);
  if (pos < 0) return null;
  const [it] = itens.splice(pos, 1);
  salvar();
  return { it, pos };
}
export function devolver({ it, pos }) {
  itens.splice(Math.min(pos, itens.length), 0, it);
  salvar();
}

/** Apaga as programações e as mobilizações. */
export function apagarTudo() {
  troca(itens, []);
  troca(banco.mobilizacoes, []);
  salvar();
}

// ── backup e planilha ────────────────────────────────────────────────────────

export const backup = () => JSON.stringify({ app: "programacao-operacao", versao: 1, exportadoEm: agora(),
  itens, mobilizacoes: banco.mobilizacoes }, null, 2);

const STATUS = ["programada", "andamento", "concluida", "cancelada"];

/** Põe `novos` em `lista`: o mesmo id atualiza, o resto entra no fim. */
function juntar(lista, novos) {
  let entraram = 0, atualizados = 0;
  for (const n of novos) {
    const pos = lista.findIndex(x => x.id === n.id);
    if (pos >= 0) { lista[pos] = n; atualizados++; } else { lista.push(n); entraram++; }
  }
  return [entraram, atualizados];
}

/** Lê um backup. `substituir` troca tudo o que vier no arquivo; senão junta
 *  (o mesmo id é atualizado). Backup antigo, sem mobilizações, não mexe nas
 *  mobilizações. Item sem o mínimo (o que fazer e o dia) é ignorado. */
export function restaurarBackup(textoArquivo, substituir = false) {
  const lido = JSON.parse(textoArquivo);
  const lista = Array.isArray(lido) ? lido : lido?.itens;
  if (!Array.isArray(lista)) throw new Error("O arquivo não é um backup desta programação.");
  const bons = [];
  let ignorados = 0;
  for (const bruto of lista) {
    const { limpo, erros } = conferir(bruto || {});
    if (Object.keys(erros).length) { ignorados++; continue; }
    bons.push({
      ...limpo,
      id: typeof bruto.id === "string" && bruto.id ? bruto.id : novoId(),
      status: STATUS.includes(bruto.status) ? bruto.status : "programada",
      remarcacoes: Number(bruto.remarcacoes) || 0,
      criadaEm: typeof bruto.criadaEm === "string" ? bruto.criadaEm : agora(),
      historico: Array.isArray(bruto.historico)
        ? bruto.historico.filter(h => h && typeof h.texto === "string").map(h => ({ quando: String(h.quando || ""), texto: h.texto }))
        : [],
      ...(ehData(bruto.concluidaEm) ? { concluidaEm: bruto.concluidaEm } : {}),
      ...(ehData(bruto.dataOriginal) ? { dataOriginal: bruto.dataOriginal } : {}),
      ...(bruto.motivoAtraso ? { motivoAtraso: texto(bruto.motivoAtraso), detalheAtraso: texto(bruto.detalheAtraso, 300) } : {}),
      ...(bruto.motivoCancelamento ? { motivoCancelamento: texto(bruto.motivoCancelamento, 300) } : {}),
      ...(typeof bruto.grupo === "string" ? { grupo: bruto.grupo } : {}),
    });
    if (bons.at(-1).status === "concluida" && !bons.at(-1).concluidaEm) bons.at(-1).status = "programada";
  }
  let novos = 0, atualizados = 0;
  if (substituir) { troca(itens, bons); novos = bons.length; }
  else [novos, atualizados] = juntar(itens, bons);

  const mob = { mobNovas: 0, mobAtualizadas: 0, mobIgnoradas: 0 };
  if (Array.isArray(lido?.mobilizacoes)) {
    const { boas, ignoradas } = M.sanear(lido.mobilizacoes);
    mob.mobIgnoradas = ignoradas;
    if (substituir) { troca(banco.mobilizacoes, boas); mob.mobNovas = boas.length; }
    else [mob.mobNovas, mob.mobAtualizadas] = juntar(banco.mobilizacoes, boas);
  }
  salvar();
  return { novos, atualizados, ignorados, ...mob };
}

/** A lista em CSV para o Excel. */
export function planilha(lista, ref = hoje()) {
  const cab = ["Dia", "Até", "Início", "Fim", "Frota", "Categoria", "O que fazer", "Onde", "Responsável",
    "Prioridade", "Situação", "Concluída em", "Motivo do atraso", "Remarcações", "Observações"];
  const br = dataPlanilha;
  const linhas = lista.map(it => [br(it.data), br(it.dataFim), it.horaInicio, it.horaFim, it.frota, nomeCategoria(it.categoria),
    it.atividade, it.onde, it.responsavel, nomePrioridade(it.prioridade), SITUACOES[situacao(it, ref)], br(it.concluidaEm),
    [it.motivoAtraso, it.detalheAtraso].filter(Boolean).join(" — "), it.remarcacoes || 0, it.obs]);
  return csv([cab, ...linhas]);
}
