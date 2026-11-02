// O que as telas dividem: a barra de filtros, a lista já filtrada e a linha
// de um item com os botões rápidos.

import { el, brCurto } from "./util.js";
import * as D from "./dados.js";
import { ui, redesenharCorpo } from "./estado.js";
import { abrirFicha, abrirConcluir, abrirFormulario, iniciarItem } from "./caixas.js";
import { seloDe } from "./ui.js";

/** Os itens que passam pela busca e pela categoria. */
export const filtrados = () => D.todos().filter(it =>
  (!ui.categoria || it.categoria === ui.categoria) && D.casaBusca(it, ui.busca));

/** O cartão de filtros no alto: o que é da tela (`antes`), a busca e a
 *  categoria, e o que é da tela no fim (`depois`). */
export function barraFiltros(antes = [], depois = []) {
  const busca = el("input", {
    type: "search", class: "busca", value: ui.busca, "aria-label": "Buscar",
    placeholder: "Buscar frota, o que fazer, onde, responsável…",
    oninput: e => { ui.busca = e.target.value; redesenharCorpo(); },
  });
  const cat = el("select", { class: "filtro-cat", "aria-label": "Categoria", onchange: e => { ui.categoria = e.target.value; redesenharCorpo(); } },
    el("option", { value: "" }, "Todas as categorias"),
    D.CATEGORIAS.map(c => el("option", { value: c.id, selected: c.id === ui.categoria }, c.nome)));
  return el("div", { class: "barra" }, antes, busca, cat, depois);
}

/** Concluir (e Iniciar, quando ainda não começou), para usar sem abrir a
 *  ficha. Com `dia`, num item de vários dias, conclui só aquele dia. */
export function botoesRapidos(it, { remarcar = false, dia = null, ref } = {}) {
  const s = dia ? D.situacaoDia(it, dia, ref) : D.situacao(it, ref);
  if (!D.ABERTAS.includes(s)) return [];
  const doDia = dia && D.variosDias(it);
  return [
    remarcar ? el("button", { type: "button", class: "mini", onclick: () => abrirFormulario(it) }, "Remarcar")
      : it.status !== "andamento" && s !== "atrasada" ? el("button", { type: "button", class: "mini", onclick: () => iniciarItem(it.id) }, "Iniciar") : null,
    el("button", { type: "button", class: "mini forte", onclick: () => abrirConcluir(it.id, dia) }, doDia ? "Concluir o dia" : "Concluir"),
  ];
}

/** "2 de 5 dias feitos · falta 26/10" — num item de vários dias ainda aberto. */
function progresso(it, ref) {
  if (!D.variosDias(it) || it.status === "concluida" || it.status === "cancelada") return "";
  const total = D.diasDo(it).length;
  const pendentes = D.diasPendentes(it);
  const passados = pendentes.filter(d => d < ref);
  return `${total - pendentes.length} de ${total} dias feitos` + (passados.length ? ` · falta ${passados.map(brCurto).join(", ")}` : "");
}

/** Uma linha de item: o ponto na cor da situação, o que é, o detalhe e os
 *  botões. Tocar abre a ficha. Com `dia`, a situação e os botões são os
 *  daquele dia. */
export function linhaItem(it, { ref, remarcar = false, mostraDia = false, dia = null } = {}) {
  const s = dia ? D.situacaoDia(it, dia, ref) : D.situacao(it, ref);
  const sub = [mostraDia ? D.prazo(it) === it.data ? brCurto(it.data) : `${brCurto(it.data)} a ${brCurto(D.prazo(it))}` : "",
    D.horario(it), D.nomeCategoria(it.categoria), it.onde, it.responsavel, progresso(it, ref)].filter(Boolean).join(" · ");
  return el("div", { class: "item s-" + s, dataset: { id: it.id }, onclick: () => abrirFicha(it.id) },
    el("i", { class: "ponto", "aria-hidden": "true" }),
    el("div", { class: "item-meio" },
      el("button", { type: "button", class: "item-tit" }, it.frota ? el("b", {}, it.frota + " · ") : null, it.atividade,
        it.prioridade === "alta" ? el("span", { class: "tag alta" }, "Alta") : null),
      sub ? el("div", { class: "item-sub" }, sub) : null,
      el("div", { class: "item-pe", onclick: e => e.stopPropagation() }, seloDe(s), el("span", { class: "vao" }),
        botoesRapidos(it, { remarcar, dia, ref }))));
}

export const vazio = texto => el("p", { class: "vazio" }, texto);

/** Um cartão branco, com título. */
export function cartao(titulo, conteudo, { sub = "", classe = "", pe = null } = {}) {
  return el("section", { class: "cartao " + classe },
    el("header", { class: "cartao-cab" }, el("h2", {}, titulo), sub ? el("span", { class: "cartao-sub" }, sub) : null),
    conteudo, pe);
}
