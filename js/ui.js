// Peças de tela que se repetem: ícones, avisos, o selo de situação e baixar
// arquivo.

import { el } from "./util.js";
import { SITUACOES, situacao } from "./dados.js";

// Desenhos em linha (24×24), em vez de emoji: ficam iguais em todo aparelho.
// Os do menu estão direto no index.html.
const DESENHOS = {
  imprimir: '<path d="M7 9V3h10v6M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7" rx="1"/>',
  baixar: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
};

export function icone(nome) {
  const s = el("span", { class: "ico", "aria-hidden": "true" });
  s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${DESENHOS[nome] || ""}</svg>`;
  return s;
}

/** O selo da situação: o ponto na cor e o nome escrito. */
export const seloSituacao = (it, ref) => {
  const s = situacao(it, ref);
  return el("span", { class: "selo s-" + s }, SITUACOES[s]);
};

/** Aviso no pé da tela, que some sozinho. Com `acao`, leva um botão
 *  (o "Desfazer"). */
export function avisar(texto, { acao = null, rotulo = "Desfazer", tempo = 5000 } = {}) {
  const caixa = document.getElementById("avisos");
  const aviso = el("div", { class: "aviso", role: "status" }, el("span", {}, texto),
    acao ? el("button", { type: "button", class: "link", onclick: () => { acao(); aviso.remove(); } }, rotulo) : null);
  caixa.append(aviso);
  // no máximo três de cada vez: o mais velho sai
  while (caixa.children.length > 3) caixa.firstElementChild.remove();
  setTimeout(() => aviso.remove(), tempo);
}

/** Entrega um arquivo para quem está usando. */
export function baixar(nome, conteudo, tipo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = el("a", { href: url, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Botões que escolhem um entre vários (um toque), como um rádio. */
export function segmentos(opcoes, atual, aoEscolher, { rotulo = "", classe = "" } = {}) {
  const grupo = el("div", { class: "segmentos " + classe, role: "radiogroup", "aria-label": rotulo });
  for (const [valor, nome] of opcoes) {
    grupo.append(el("button", {
      type: "button", class: "seg" + (valor === atual ? " on" : ""), role: "radio",
      "aria-checked": valor === atual ? "true" : "false",
      onclick: e => {
        grupo.querySelectorAll(".seg").forEach(b => { b.classList.remove("on"); b.setAttribute("aria-checked", "false"); });
        e.currentTarget.classList.add("on");
        e.currentTarget.setAttribute("aria-checked", "true");
        aoEscolher(valor);
      } }, nome));
  }
  return grupo;
}
