// As caixas que abrem por cima da tela: a programação (nova e editar), a
// ficha do item, concluir e cancelar. Uma <dialog> só, reaproveitada.

import { el, hoje, ehData, difDias, brCurto, brData, porExtenso, inicioDaSemana, plural } from "./util.js";
import * as D from "./dados.js";
import { ui, redesenhar } from "./estado.js";
import { icone, avisar, seloSituacao, segmentos } from "./ui.js";

const caixa = () => document.getElementById("caixa");

export function abrir(titulo, corpo, rodape) {
  const d = caixa();
  d.replaceChildren(el("div", { class: "cx" },
    el("header", { class: "cx-cab" }, el("h2", { id: "caixa-titulo" }, titulo),
      el("button", { type: "button", class: "cx-fechar so-icone", "aria-label": "Fechar", onclick: fechar }, icone("fechar"))),
    el("div", { class: "cx-corpo" }, corpo),
    rodape ? el("footer", { class: "cx-pe" }, rodape) : null));
  if (!d.open) d.showModal();
  d.querySelector(".cx-corpo").scrollTop = 0;
  (d.querySelector("[autofocus]") || d.querySelector(".cx-cab button")).focus();
}
export const fechar = () => caixa().close();

/** Fecha, redesenha e dá o recado. */
export function pronto(recado) {
  fechar();
  redesenhar();
  if (recado) avisar(recado);
}

// ── campos ───────────────────────────────────────────────────────────────────

export function campo(rotulo, controle, { nome = "", dica = "", classe = "" } = {}) {
  return el("div", { class: "campo " + classe, dataset: { campo: nome } },
    el("label", { class: "rot", for: controle.id || null }, rotulo),
    controle,
    dica ? el("small", { class: "dica" }, dica) : null,
    el("small", { class: "erro", role: "alert" }));
}

export function entrada(nome, valor, attrs = {}) {
  return el("input", { id: "f-" + nome, name: nome, value: valor || "", autocomplete: "off", ...attrs });
}

export function lista(id, valores) {
  return el("datalist", { id }, valores.map(v => el("option", { value: v })));
}

/** Põe cada erro debaixo do seu campo e leva o foco ao primeiro. */
export function mostrarErros(form, erros) {
  form.querySelectorAll(".campo").forEach(c => {
    const msg = erros[c.dataset.campo] || "";
    c.classList.toggle("com-erro", !!msg);
    c.querySelector(".erro").textContent = msg;
  });
  const primeiro = form.querySelector(".com-erro");
  if (primeiro) {
    primeiro.scrollIntoView({ block: "nearest" });
    (primeiro.querySelector("input, textarea, select, button") || primeiro).focus();
  }
  return !primeiro;
}

/** O porquê, para tocar: os motivos prontos e o detalhe escrito. "Outro
 *  motivo" exige o detalhe. */
function blocoMotivo(motivos, nome, rotulo) {
  let escolhido = "";
  const detalhe = el("input", { id: "f-" + nome + "-det", placeholder: "Detalhe (opcional)", autocomplete: "off" });
  const bloco = campo(rotulo, el("div", {},
    segmentos(motivos.map(m => [m, m]), "", v => {
      escolhido = v;
      detalhe.placeholder = v === "Outro motivo" ? "Escreva o motivo" : "Detalhe (opcional)";
    }, { rotulo, classe: "chips" }),
    detalhe), { nome });
  return {
    bloco,
    erro: () => !escolhido ? "Escolha o motivo." : escolhido === "Outro motivo" && !detalhe.value.trim() ? "Escreva o motivo." : "",
    motivo: () => escolhido,
    detalhe: () => detalhe.value.trim(),
    texto: () => [escolhido === "Outro motivo" ? "" : escolhido, detalhe.value.trim()].filter(Boolean).join(": "),
  };
}

// ── nova programação e editar ────────────────────────────────────────────────

/** `it` para editar; sem ele é nova, com `padrao` preenchendo os campos
 *  (o dia tocado, ou a cópia de outro item). */
export function abrirFormulario(it = null, padrao = {}) {
  const base = it || { categoria: "viagem", prioridade: "media", data: ui.dia || hoje(), ...padrao };
  let categoria = base.categoria, prioridade = base.prioridade;

  const frota = entrada("frota", base.frota, { list: "sug-frota", placeholder: "Ex.: 617 ou F-617", autofocus: true });
  const atividade = entrada("atividade", base.atividade, { list: "sug-atividade", placeholder: "Ex.: Viagem para Natal com carga" });
  const onde = entrada("onde", base.onde, { list: "sug-onde", placeholder: "Origem, destino, cliente, fornecedor…" });
  const data = entrada("data", base.data, { type: "date", required: true });
  const dataFim = entrada("dataFim", base.dataFim, { type: "date", min: base.data });
  const horaInicio = entrada("horaInicio", base.horaInicio, { type: "time" });
  const horaFim = entrada("horaFim", base.horaFim, { type: "time" });
  const responsavel = entrada("responsavel", base.responsavel, { list: "sug-responsavel", placeholder: "Motorista ou quem faz" });
  const obs = el("textarea", { id: "f-obs", name: "obs", rows: 3, placeholder: "Carga, contato, documentos…", value: base.obs || "" });

  const valores = () => ({ frota: frota.value, categoria, atividade: atividade.value, onde: onde.value, data: data.value,
    dataFim: dataFim.value, horaInicio: horaInicio.value, horaFim: horaFim.value, responsavel: responsavel.value,
    prioridade, obs: obs.value });

  // remarcar (só ao editar): aparece quando o dia muda
  const remarcar = it ? blocoMotivo(D.MOTIVOS_REMARCAR, "motivo", "Por que mudou o dia?") : null;
  if (remarcar) remarcar.bloco.classList.add("destaque");
  const verRemarcar = () => {
    if (!remarcar) return;
    const muda = D.remarca(it, D.conferir(valores()).limpo);
    remarcar.bloco.hidden = !muda;
  };

  // repetir (só na nova)
  const repetir = el("select", { id: "f-repetir" },
    [["", "Não repete"], ["dia", "Todo dia"], ["util", "Dias úteis (seg a sex)"], ["semana", "Toda semana, no mesmo dia"]]
      .map(([v, n]) => el("option", { value: v }, n)));
  const repetirAte = entrada("repetirAte", "", { type: "date" });
  const contaRepeticao = el("small", { class: "dica" });
  const blocoAte = campo("Até", repetirAte, { nome: "repetirAte" });
  const verRepetir = () => {
    blocoAte.hidden = !repetir.value;
    repetirAte.min = data.value;
    const n = repetir.value && ehData(repetirAte.value) ? D.repeticoes(data.value, repetir.value, repetirAte.value).length : 0;
    contaRepeticao.textContent = n > 1 ? `Vai criar ${n} programações${n === 120 ? " (o máximo)" : ""}.` : "";
  };

  data.addEventListener("change", () => { dataFim.min = data.value; verRemarcar(); verRepetir(); });
  dataFim.addEventListener("change", verRemarcar);
  repetir.addEventListener("change", verRepetir);
  repetirAte.addEventListener("change", verRepetir);

  const form = el("form", { class: "form", novalidate: true, onsubmit: e => { e.preventDefault(); salvar(); } },
    lista("sug-frota", D.sugestoes("frota")),
    lista("sug-atividade", D.sugestoes("atividade")),
    lista("sug-onde", D.sugestoes("onde")),
    lista("sug-responsavel", D.sugestoes("responsavel")),
    el("div", { class: "linha-frota" },
      campo("Frota", frota, { nome: "frota" }),
      campo("Prioridade", segmentos(D.PRIORIDADES.map(p => [p.id, p.nome]), prioridade, v => { prioridade = v; }, { rotulo: "Prioridade" }), { nome: "prioridade" })),
    campo("Categoria", segmentos(D.CATEGORIAS.map(c => [c.id, c.nome]), categoria, v => { categoria = v; }, { rotulo: "Categoria", classe: "chips" }), { nome: "categoria" }),
    campo("O que fazer *", atividade, { nome: "atividade" }),
    campo("Onde", onde, { nome: "onde" }),
    el("div", { class: "linha-2" },
      campo("Dia *", data, { nome: "data" }),
      campo("Até o dia", dataFim, { nome: "dataFim", dica: "Só se durar mais de um dia." })),
    el("div", { class: "linha-2" },
      campo("Das", horaInicio, { nome: "horaInicio" }),
      campo("Às", horaFim, { nome: "horaFim" })),
    remarcar ? remarcar.bloco : null,
    campo("Responsável", responsavel, { nome: "responsavel" }),
    campo("Observações", obs, { nome: "obs" }),
    it ? null : el("div", { class: "linha-2" },
      campo("Repetir", el("div", {}, repetir, contaRepeticao), { nome: "repetir" }),
      blocoAte),
    el("button", { type: "submit", hidden: true }));

  verRemarcar();
  verRepetir();

  function salvar() {
    const { limpo, erros } = D.conferir(valores());
    if (!it && repetir.value && !ehData(repetirAte.value)) erros.repetirAte = "Até quando?";
    else if (!it && repetir.value && repetirAte.value < limpo.data) erros.repetirAte = "Tem de ser depois do dia.";
    if (remarcar && D.remarca(it, limpo) && remarcar.erro()) erros.motivo = remarcar.erro();
    if (!mostrarErros(form, erros)) return;

    if (it) {
      D.editar(it.id, limpo, remarcar && D.remarca(it, limpo) ? remarcar.texto() : "");
    } else {
      const dias = D.repeticoes(limpo.data, repetir.value, repetirAte.value);
      D.criar(limpo, dias);
    }
    // a tela vai para o dia do item, para ele aparecer
    ui.dia = limpo.data;
    ui.mes = limpo.data.slice(0, 7);
    ui.semana = inicioDaSemana(limpo.data);
    const n = it ? 0 : D.repeticoes(limpo.data, repetir.value, repetirAte.value).length;
    pronto(it ? "Alterações salvas." : n > 1 ? `${n} programações criadas.` : "Programação criada.");
  }

  abrir(it ? "Editar programação" : padrao.atividade ? "Nova programação (cópia)" : "Nova programação", form, [
    el("button", { type: "button", onclick: it ? () => abrirFicha(it.id) : fechar }, it ? "Voltar" : "Cancelar"),
    el("button", { type: "button", class: "primario", onclick: salvar }, it ? "Salvar" : "Programar"),
  ]);
}

// ── a ficha ──────────────────────────────────────────────────────────────────

export const quandoHist = iso => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

export function abrirFicha(id) {
  const it = D.porId(id);
  if (!it) return;
  const s = D.situacao(it);
  const aberta = D.ABERTAS.includes(s);
  const linha = (rot, valor) => valor ? [el("dt", {}, rot), el("dd", {}, valor)] : null;

  const corpo = el("div", { class: "ficha" },
    el("div", { class: "ficha-selos" }, seloSituacao(it), el("span", { class: "tag" }, D.nomeCategoria(it.categoria)),
      it.prioridade === "alta" ? el("span", { class: "tag alta" }, "Prioridade alta") : null),
    el("h3", { class: "ficha-tit" }, it.frota ? el("b", {}, it.frota + " · ") : null, it.atividade),
    el("dl", { class: "ficha-dados" },
      linha("Quando", porExtenso(it.data) + (it.dataFim ? " até " + porExtenso(it.dataFim) : "")),
      linha("Horário", D.horario(it)),
      linha("Onde", it.onde),
      linha("Responsável", it.responsavel),
      linha("Prioridade", D.nomePrioridade(it.prioridade)),
      linha("Remarcada", it.remarcacoes ? `${it.remarcacoes}×` + (it.dataOriginal ? ` (era ${brData(it.dataOriginal)})` : "") : ""),
      linha("Concluída em", it.concluidaEm ? brData(it.concluidaEm) : ""),
      linha("Motivo do atraso", [it.motivoAtraso, it.detalheAtraso].filter(Boolean).join(" — ")),
      linha("Cancelada", it.motivoCancelamento),
      linha("Observações", it.obs ? el("span", { class: "quebra" }, it.obs) : "")),
    it.historico?.length ? el("section", { class: "historico" }, el("h4", {}, "Histórico"),
      el("ol", {}, [...it.historico].reverse().map(h => el("li", {}, el("time", {}, quandoHist(h.quando)), el("span", {}, h.texto)))))
      : null);

  const excluirB = el("button", { type: "button", class: "perigo-link", onclick: () => excluirItem(it.id) }, "Excluir");
  const editarB = el("button", { type: "button", onclick: () => abrirFormulario(it) }, "Editar");
  const duplicarB = el("button", { type: "button", onclick: () => duplicar(it) }, "Duplicar");
  const acoes = aberta
    ? [excluirB, el("span", { class: "vao" }),
        el("button", { type: "button", onclick: () => abrirCancelar(it.id) }, "Cancelar programação"),
        duplicarB, editarB,
        it.status !== "andamento" ? el("button", { type: "button", onclick: () => { D.iniciar(it.id); pronto("Marcada como em andamento."); } }, "Iniciar") : null,
        el("button", { type: "button", class: "primario", onclick: () => abrirConcluir(it.id) }, "Concluir")]
    : s === "cancelada"
      ? [excluirB, el("span", { class: "vao" }), duplicarB,
          el("button", { type: "button", class: "primario", onclick: () => { D.restaurar(it.id); pronto("Cancelamento desfeito."); } }, "Desfazer cancelamento")]
      : [excluirB, el("span", { class: "vao" }), duplicarB, editarB,
          el("button", { type: "button", onclick: () => { D.reabrir(it.id); pronto("Reaberta."); } }, "Reabrir")];

  abrir("Programação", corpo, acoes);
}

function duplicar(it) {
  const { frota, categoria, atividade, onde, horaInicio, horaFim, responsavel, prioridade, obs } = it;
  abrirFormulario(null, { frota, categoria, atividade, onde, horaInicio, horaFim, responsavel, prioridade, obs, data: it.data });
}

export function excluirItem(id) {
  const guardado = D.excluir(id);
  if (!guardado) return;
  fechar();
  redesenhar();
  avisar("Programação excluída.", { acao: () => { D.devolver(guardado); redesenhar(); }, tempo: 8000 });
}

// ── concluir ─────────────────────────────────────────────────────────────────

export function abrirConcluir(id) {
  const it = D.porId(id);
  if (!it) return;
  const h = hoje();
  const quando = entrada("quando", h, { type: "date", max: h });
  const motivo = blocoMotivo(D.MOTIVOS_ATRASO, "motivo", "Por que atrasou?");
  const aviso = el("p", { class: "aviso-atraso" });
  const ver = () => {
    const atraso = ehData(quando.value) ? difDias(D.prazo(it), quando.value) : 0;
    aviso.hidden = motivo.bloco.hidden = atraso <= 0;
    aviso.textContent = `O prazo era ${brCurto(D.prazo(it))}: concluída ${plural(atraso, "dia", "dias")} depois.`;
    return atraso;
  };
  quando.addEventListener("change", ver);

  const form = el("form", { class: "form", novalidate: true, onsubmit: e => { e.preventDefault(); salvar(); } },
    el("p", { class: "ficha-tit" }, it.frota ? el("b", {}, it.frota + " · ") : null, it.atividade),
    campo("Concluída em", quando, { nome: "quando" }),
    aviso, motivo.bloco,
    el("button", { type: "submit", hidden: true }));
  ver();

  function salvar() {
    const erros = {};
    if (!ehData(quando.value)) erros.quando = "Escolha o dia.";
    else if (quando.value > h) erros.quando = "Não dá para concluir no futuro.";
    else if (ver() > 0 && motivo.erro()) erros.motivo = motivo.erro();
    if (!mostrarErros(form, erros)) return;
    const atrasou = ver() > 0;
    D.concluir(it.id, quando.value, atrasou ? motivo.motivo() : "", atrasou ? motivo.detalhe() : "");
    pronto(atrasou ? "Concluída com atraso." : "Concluída.");
  }

  abrir("Concluir", form, [
    el("button", { type: "button", onclick: () => abrirFicha(it.id) }, "Voltar"),
    el("button", { type: "button", class: "primario", onclick: salvar }, "Concluir"),
  ]);
}

// ── cancelar ─────────────────────────────────────────────────────────────────

export function abrirCancelar(id) {
  const it = D.porId(id);
  if (!it) return;
  const motivo = el("textarea", { id: "f-motivo", rows: 3, placeholder: "Ex.: cliente desmarcou a carga", autofocus: true });
  const form = el("form", { class: "form", novalidate: true, onsubmit: e => { e.preventDefault(); salvar(); } },
    el("p", { class: "ficha-tit" }, it.frota ? el("b", {}, it.frota + " · ") : null, it.atividade),
    campo("Por que cancelar? *", motivo, { nome: "motivo", dica: "Cancelada não conta como feita nem como atrasada. Dá para desfazer depois." }));

  function salvar() {
    if (!mostrarErros(form, motivo.value.trim() ? {} : { motivo: "Diga o motivo." })) return;
    D.cancelar(it.id, motivo.value);
    pronto("Programação cancelada.");
  }

  abrir("Cancelar programação", form, [
    el("button", { type: "button", onclick: () => abrirFicha(it.id) }, "Voltar"),
    el("button", { type: "button", class: "primario perigo", onclick: salvar }, "Cancelar programação"),
  ]);
}

/** Iniciar direto da lista, sem abrir a ficha. */
export function iniciarItem(id) {
  D.iniciar(id);
  redesenhar();
  avisar("Marcada como em andamento.");
}

/** Pergunta antes de algo sem volta. */
export function confirmar(titulo, texto, rotulo, acao, { perigo = false } = {}) {
  abrir(titulo, el("p", {}, texto), [
    el("button", { type: "button", onclick: fechar, autofocus: true }, "Voltar"),
    el("button", { type: "button", class: "primario" + (perigo ? " perigo" : ""), onclick: () => { fechar(); acao(); } }, rotulo),
  ]);
}
