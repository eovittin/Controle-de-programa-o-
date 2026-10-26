// O começo de tudo: carrega os dados, escolhe a tela pelo endereço (#/agenda,
// #/semana, #/lista, #/dados) e cuida do tema e do menu.

import { el, hoje } from "./util.js";
import * as D from "./dados.js";
import { ui, aoRedesenhar, redesenhar } from "./estado.js";
import * as T from "./telas.js";
import { abrirFormulario, fechar } from "./caixas.js";
import { avisar } from "./ui.js";

const TELAS = { agenda: T.agenda, semana: T.semana, lista: T.lista, dados: T.dados };
const CHAVE_TEMA = "programacao-operacao:tema";

const rota = () => {
  const v = location.hash.replace(/^#\/?/, "");
  return TELAS[v] ? v : "agenda";
};

function desenhar() {
  ui.vista = rota();
  const tela = TELAS[ui.vista];
  document.title = `${tela.titulo} · Programação da Operação`;
  document.getElementById("titulo").textContent = tela.titulo;
  document.querySelectorAll("[data-tela]").forEach(a => {
    const ativo = a.dataset.tela === ui.vista;
    a.classList.toggle("ativo", ativo);
    if (ativo) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  const barra = tela.barra();
  document.getElementById("tela").replaceChildren(
    barra || "",
    el("div", { id: "conteudo" }, tela.corpo()));
  contadores();
}

function desenharCorpo() {
  document.getElementById("conteudo").replaceChildren(TELAS[ui.vista].corpo());
}

/** O número de atrasadas ao lado de Agenda, no menu e na barra de baixo. */
function contadores() {
  const ref = hoje();
  const n = D.todos().filter(it => D.situacao(it, ref) === "atrasada").length;
  document.querySelectorAll(".conta-atrasadas").forEach(c => {
    c.textContent = n ? String(n) : "";
    c.title = n ? `${n} atrasada(s)` : "";
  });
}

// ── tema ─────────────────────────────────────────────────────────────────────

function lerTema() { try { return localStorage.getItem(CHAVE_TEMA); } catch { return null; } }
function trocarTema() {
  const novo = document.documentElement.dataset.tema === "escuro" ? "claro" : "escuro";
  document.documentElement.dataset.tema = novo;
  try { localStorage.setItem(CHAVE_TEMA, novo); } catch { /* sem guardar, só nesta visita */ }
}

// ── começar ──────────────────────────────────────────────────────────────────

document.documentElement.dataset.tema = lerTema() || "claro";
D.carregar();
D.quandoMudar(ok => {
  if (!ok) avisar("O navegador não deixou guardar. Janela anônima ou memória cheia? Baixe um backup em Dados.", { tempo: 10000 });
});
aoRedesenhar(desenhar, desenharCorpo);

document.getElementById("nova").addEventListener("click", () => abrirFormulario(null, { data: ui.vista === "agenda" ? ui.dia : hoje() }));
document.getElementById("tema").addEventListener("click", trocarTema);
window.addEventListener("hashchange", () => { fechar(); desenhar(); });

// fechar a caixa ao tocar fora dela
const caixa = document.getElementById("caixa");
caixa.addEventListener("click", e => { if (e.target === caixa) fechar(); });

// "N" abre uma nova, fora de campo de texto
document.addEventListener("keydown", e => {
  if (e.key.toLowerCase() !== "n" || e.ctrlKey || e.metaKey || e.altKey || caixa.open) return;
  if (e.target.closest("input, textarea, select, [contenteditable]")) return;
  e.preventDefault();
  abrirFormulario(null, { data: ui.vista === "agenda" ? ui.dia : hoje() });
});

// outra aba mudou os dados: carrega de novo
window.addEventListener("storage", e => {
  if (e.key && e.key.startsWith("programacao-operacao:v")) { D.carregar(); if (!caixa.open) redesenhar(); }
});

// virou o dia com a tela aberta: "para hoje" e "atrasada" mudam
let diaVisto = hoje();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || hoje() === diaVisto) return;
  diaVisto = hoje();
  if (!caixa.open) redesenhar();
});

desenhar();

// funciona sem internet depois da primeira visita
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
