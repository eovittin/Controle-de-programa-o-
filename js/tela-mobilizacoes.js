// A tela Mobilizações (em Gestão): cada mobilização num cartão, com as frotas
// dela, e as caixas de criar e editar a mobilização e de adicionar e editar
// uma frota.

import { el, hoje, brCurto, plural, normalizaFrota } from "./util.js";
import * as M from "./mobilizacoes.js";
import * as D from "./dados.js";
import { ui, redesenhar, redesenharCorpo } from "./estado.js";
import { abrir, fechar, pronto, campo, entrada, lista, mostrarErros, confirmar, quandoHist } from "./caixas.js";
import { icone, avisar, baixar, segmentos } from "./ui.js";
import { vazio } from "./comum.js";

const FILTROS = [["abertas", "Em andamento"], ["encerradas", "Encerradas"], ["todas", "Todas"]];

/** A cor do selo da mobilização, emprestada da situação de frota parecida. */
const COR_MOB = { vazia: "m-desmobilizada", planejada: "m-aguardando", mobilizando: "m-mobilizando",
  ativa: "m-mobilizada", encerrada: "m-desmobilizada" };
const PLURAIS = { aguardando: ["aguardando", "aguardando"], mobilizando: ["em mobilização", "em mobilização"],
  mobilizada: ["mobilizada", "mobilizadas"], desmobilizada: ["desmobilizada", "desmobilizadas"] };
const ORDEM_FROTA = { mobilizando: 0, aguardando: 1, mobilizada: 2, desmobilizada: 3 };

const encerrada = m => M.situacaoMob(m) === "encerrada";
const passa = m => ui.filtroMob === "todas" || (ui.filtroMob === "encerradas") === encerrada(m);

/** As em andamento primeiro, as mais recentes no alto. */
const ordem = (a, b) => encerrada(a) - encerrada(b) ||
  (b.inicio || "").localeCompare(a.inicio || "") || a.nome.localeCompare(b.nome, "pt-BR");

const listaDaTela = () => M.todas().filter(m => passa(m) && M.casaBusca(m, ui.busca)).sort(ordem);

export const mobilizacoes = {
  titulo: "Mobilizações",
  nova: { rotulo: "Nova mobilização", acao: () => abrirMob() },
  barra() {
    return el("div", { class: "barra" },
      el("input", {
        type: "search", class: "busca", value: ui.busca, "aria-label": "Buscar",
        placeholder: "Buscar mobilização, frota, placa, motorista…",
        oninput: e => { ui.busca = e.target.value; redesenharCorpo(); },
      }),
      el("select", { "aria-label": "Situação", onchange: e => { ui.filtroMob = e.target.value; redesenharCorpo(); } },
        FILTROS.map(([v, n]) => el("option", { value: v, selected: v === ui.filtroMob }, n))),
      el("button", { type: "button", onclick: () => {
        const l = listaDaTela();
        if (!l.length) return avisar("Nada na lista para exportar.");
        baixar(`mobilizacoes-${hoje()}.csv`, M.planilha(l), "text/csv;charset=utf-8");
      } }, icone("baixar"), "Excel"));
  },
  corpo() {
    const ref = hoje();
    const todas = M.todas();
    if (!todas.length) {
      return el("div", { class: "cartao boas-vindas" },
        el("h2", {}, "Nenhuma mobilização ainda"),
        el("p", {}, "Uma mobilização é um contrato, cliente ou obra para onde vão frotas. Crie a primeira e adicione as frotas dentro dela."),
        el("button", { type: "button", class: "primario", onclick: () => abrirMob() }, "+ Nova mobilização"));
    }
    const l = listaDaTela();
    return el("div", { class: "mobs" },
      resumo(todas, ref),
      l.length ? l.map(m => cartaoMob(m, ref)) : el("div", { class: "cartao" }, vazio("Nenhuma mobilização com esses filtros.")));
  },
};

function resumo(todas, ref) {
  const frotas = todas.flatMap(m => m.frotas);
  const n = s => frotas.filter(f => f.situacao === s).length;
  const atrasadas = frotas.filter(f => M.atrasada(f, ref)).length;
  const num = (valor, rotulo, classe = "") => el("div", { class: "num " + classe }, el("b", {}, String(valor)), el("span", {}, rotulo));
  return el("div", { class: "nums" },
    num(todas.filter(m => !encerrada(m)).length, "Mobilizações em andamento"),
    num(n("mobilizada"), "Frotas mobilizadas"),
    num(n("mobilizando"), "Em mobilização"),
    num(n("aguardando"), "Aguardando"),
    num(atrasadas, "Atrasadas", atrasadas ? "alerta" : ""));
}

function periodo(m) {
  if (m.inicio && m.fimPrevisto) return `${brCurto(m.inicio)} a ${brCurto(m.fimPrevisto)}`;
  if (m.inicio) return `desde ${brCurto(m.inicio)}`;
  return m.fimPrevisto ? `até ${brCurto(m.fimPrevisto)}` : "";
}

function cartaoMob(m, ref) {
  const s = M.situacaoMob(m);
  const c = M.contas(m);
  const contas = m.frotas.length ? [plural(m.frotas.length, "frota", "frotas"),
    ...Object.keys(PLURAIS).filter(k => c[k]).map(k => plural(c[k], ...PLURAIS[k]))].join(" · ") : "";
  const sub = [m.local, periodo(m)].filter(Boolean).join(" · ");
  const frotas = [...m.frotas].sort((a, b) => ORDEM_FROTA[a.situacao] - ORDEM_FROTA[b.situacao] ||
    a.frota.localeCompare(b.frota, "pt-BR", { numeric: true }));
  return el("section", { class: "cartao mob", dataset: { id: m.id } },
    el("header", { class: "mob-cab" },
      el("div", { class: "mob-tit" }, el("h2", {}, m.nome), sub ? el("p", { class: "mob-sub" }, sub) : null),
      el("span", { class: "selo " + COR_MOB[s] }, M.SITUACOES_MOB[s]),
      el("button", { type: "button", class: "mini", onclick: () => abrirMob(m) }, "Editar")),
    contas ? el("p", { class: "mob-contas" }, contas) : null,
    m.obs ? el("p", { class: "mob-obs quebra" }, m.obs) : null,
    frotas.length ? el("div", { class: "lista-itens" }, frotas.map(f => linhaFrota(m, f, ref))) : vazio("Nenhuma frota ainda."),
    el("button", { type: "button", class: "largo", onclick: () => abrirFrota(m) }, "+ Adicionar frota"));
}

function datasDaFrota(f) {
  const chegou = f.situacao === "mobilizada" || f.situacao === "desmobilizada";
  return [
    f.dataMobilizacao ? (chegou ? "mobilizada em " : "mobilização prevista ") + brCurto(f.dataMobilizacao) : "",
    f.dataDesmobilizacao ? (f.situacao === "desmobilizada" ? "desmobilizada em " : "desmobilização prevista ") + brCurto(f.dataDesmobilizacao) : "",
  ];
}

function linhaFrota(m, f, ref) {
  const atrasou = M.atrasada(f, ref);
  const sub = [f.motorista, ...datasDaFrota(f)].filter(Boolean).join(" · ");
  const prox = M.PROXIMO[f.situacao];
  return el("div", { class: "item m-" + (atrasou ? "atrasada" : f.situacao), dataset: { id: f.id }, onclick: () => abrirFrota(m, f) },
    el("i", { class: "ponto", "aria-hidden": "true" }),
    el("div", { class: "item-meio" },
      el("button", { type: "button", class: "item-tit" }, el("b", {}, f.frota), [f.placa, f.tipo].filter(Boolean).map(t => " · " + t)),
      sub ? el("div", { class: "item-sub" }, sub) : null,
      el("div", { class: "item-pe", onclick: e => e.stopPropagation() },
        el("span", { class: "selo m-" + f.situacao }, M.SITUACOES_FROTA[f.situacao]),
        atrasou ? el("span", { class: "tag alta" }, "Atrasada") : null,
        el("span", { class: "vao" }),
        prox ? el("button", { type: "button", class: "mini forte", onclick: () => proximoPasso(m, f) }, prox[1]) : null)));
}

/** O botão do próximo passo. Começar a mobilização vale na hora; chegar e
 *  desmobilizar abrem a caixa com a data de hoje, para conferir. */
function proximoPasso(m, f) {
  const [proxima] = M.PROXIMO[f.situacao];
  if (proxima === "mobilizando") {
    M.editarFrota(m.id, f.id, M.conferirFrota({ ...f, situacao: proxima }).limpo);
    redesenhar();
    avisar(`${f.frota}: em mobilização.`);
    return;
  }
  abrirFrota(m, f, proxima === "mobilizada"
    ? { situacao: proxima, dataMobilizacao: hoje() }
    : { situacao: proxima, dataDesmobilizacao: hoje() });
}

function historico(m) {
  return m.historico?.length ? el("section", { class: "historico" }, el("h4", {}, "Histórico"),
    el("ol", {}, [...m.historico].reverse().map(h => el("li", {}, el("time", {}, quandoHist(h.quando)), el("span", {}, h.texto)))))
    : null;
}

// ── nova mobilização e editar ────────────────────────────────────────────────

export function abrirMob(m = null) {
  const base = m || { inicio: hoje() };
  const nome = entrada("nome", base.nome, { placeholder: "Ex.: Contrato Petrobras — Alto do Rodrigues", autofocus: true });
  const local = entrada("local", base.local, { placeholder: "Cidade, base ou endereço" });
  const inicio = entrada("inicio", base.inicio, { type: "date" });
  const fimPrevisto = entrada("fimPrevisto", base.fimPrevisto, { type: "date" });
  const obs = el("textarea", { id: "f-obs", rows: 3, value: base.obs || "", placeholder: "Contato no cliente, exigências, documentos…" });

  const form = el("form", { class: "form", novalidate: true, onsubmit: e => { e.preventDefault(); salvar(); } },
    campo("Nome *", nome, { nome: "nome", dica: "O contrato, o cliente ou a obra." }),
    campo("Local", local, { nome: "local" }),
    el("div", { class: "linha-2" },
      campo("Início", inicio, { nome: "inicio" }),
      campo("Fim previsto", fimPrevisto, { nome: "fimPrevisto" })),
    campo("Observações", obs, { nome: "obs" }),
    el("button", { type: "submit", hidden: true }),
    m ? historico(m) : null);

  function salvar() {
    const { limpo, erros } = M.conferirMob({ nome: nome.value, local: local.value, inicio: inicio.value,
      fimPrevisto: fimPrevisto.value, obs: obs.value });
    if (!mostrarErros(form, erros)) return;
    if (m) {
      M.editarMob(m.id, limpo);
      pronto("Mobilização salva.");
      return;
    }
    const nova = M.criarMob(limpo);
    redesenhar();
    avisar("Mobilização criada. Agora adicione as frotas.");
    abrirFrota(nova);
  }

  abrir(m ? "Editar mobilização" : "Nova mobilização", form, [
    m ? el("button", { type: "button", class: "perigo-link", onclick: () => excluirMob(m) }, "Excluir") : null,
    m ? el("span", { class: "vao" }) : null,
    el("button", { type: "button", onclick: fechar }, "Cancelar"),
    el("button", { type: "button", class: "primario", onclick: salvar }, m ? "Salvar" : "Criar e adicionar frotas"),
  ]);
}

function excluirMob(m) {
  const n = m.frotas.length;
  confirmar("Excluir a mobilização?", `"${m.nome}"${n ? ` e ${plural(n, "a frota", "as frotas")} dela` : ""} saem da lista.`, "Excluir", () => {
    const guardada = M.excluirMob(m.id);
    redesenhar();
    avisar("Mobilização excluída.", { acao: () => { M.devolverMob(guardada); redesenhar(); }, tempo: 8000 });
  }, { perigo: true });
}

// ── adicionar e editar frota ─────────────────────────────────────────────────

/** Os nomes das datas mudam com a situação: o que é previsão e o que já
 *  aconteceu. */
const ROTULOS_DATAS = {
  aguardando: ["Mobilização prevista", "Desmobilização prevista"],
  mobilizando: ["Mobilização prevista", "Desmobilização prevista"],
  mobilizada: ["Chegou em *", "Desmobilização prevista"],
  desmobilizada: ["Chegou em *", "Saiu em *"],
};

/** `f` para editar; sem ela, adiciona. `preset` muda campos ao abrir (o
 *  próximo passo, ou o que repetir no "Adicionar outra"). */
export function abrirFrota(m, f = null, preset = {}) {
  const padraoData = m.inicio && m.inicio >= hoje() ? m.inicio : "";
  const base = { situacao: "aguardando", dataMobilizacao: padraoData, ...(f || {}), ...preset };
  let tipo = base.tipo || "", situacao = base.situacao;

  const frota = entrada("frota", base.frota, { list: "sug-mob-frota", placeholder: "Ex.: 617 ou F-617", autofocus: !f });
  const placa = entrada("placa", base.placa, { placeholder: "ABC1D23", autocapitalize: "characters", maxlength: 8 });
  const motorista = entrada("motorista", base.motorista, { list: "sug-mob-motorista", placeholder: "Nome do motorista" });
  const dataMob = entrada("dataMobilizacao", base.dataMobilizacao, { type: "date" });
  const dataDesmob = entrada("dataDesmobilizacao", base.dataDesmobilizacao, { type: "date" });
  // a frota com um tipo que saiu da lista continua com ele até escolher outro
  const tipos = !tipo || M.TIPOS.includes(tipo) ? M.TIPOS : [...M.TIPOS, tipo];
  const segTipo = segmentos(tipos.map(t => [t, M.TIPOS.includes(t) ? t : `${t} (tipo antigo)`]), tipo, v => { tipo = v; },
    { rotulo: "Tipo", classe: "chips" });
  const campoMob = campo("", dataMob, { nome: "dataMobilizacao" });
  const campoDesmob = campo("", dataDesmob, { nome: "dataDesmobilizacao" });
  const verDatas = () => {
    const [a, b] = ROTULOS_DATAS[situacao];
    campoMob.querySelector(".rot").textContent = a;
    campoDesmob.querySelector(".rot").textContent = b;
  };

  // a frota que já foi mobilizada antes traz a placa e o tipo
  frota.addEventListener("change", () => {
    const k = M.conhecida(normalizaFrota(frota.value));
    if (!k) return;
    if (!placa.value && k.placa) placa.value = k.placa;
    if (!tipo && k.tipo) segTipo.querySelectorAll(".seg").forEach(b => { if (b.textContent === k.tipo) b.click(); });
  });

  const form = el("form", { class: "form", novalidate: true, onsubmit: e => { e.preventDefault(); salvar(); } },
    lista("sug-mob-frota", M.sugestoes("frota", D.todos().map(i => i.frota))),
    lista("sug-mob-motorista", M.sugestoes("motorista", D.todos().map(i => i.responsavel))),
    el("div", { class: "linha-2" },
      campo("Frota *", frota, { nome: "frota" }),
      campo("Placa", placa, { nome: "placa" })),
    campo("Tipo de veículo", segTipo, { nome: "tipo" }),
    campo("Motorista", motorista, { nome: "motorista" }),
    campo("Situação", segmentos(Object.entries(M.SITUACOES_FROTA), situacao, v => { situacao = v; verDatas(); },
      { rotulo: "Situação", classe: "chips" }), { nome: "situacao" }),
    el("div", { class: "linha-2" }, campoMob, campoDesmob),
    el("button", { type: "submit", hidden: true }));
  verDatas();

  // a mesma frota ativa em outra mobilização: avisa uma vez, e no segundo
  // toque grava (pode ser troca de contrato)
  let avisada = "";

  function salvar(outra = false) {
    const { limpo, erros } = M.conferirFrota({ frota: frota.value, placa: placa.value, tipo, motorista: motorista.value,
      situacao, dataMobilizacao: dataMob.value, dataDesmobilizacao: dataDesmob.value }, m, f?.id);
    if (!Object.keys(erros).length && limpo.frota !== f?.frota && avisada !== limpo.frota) {
      const em = M.emOutra(limpo.frota, m.id);
      if (em) {
        erros.frota = `${limpo.frota} está em "${em.m.nome}" (${M.SITUACOES_FROTA[em.f.situacao].toLowerCase()}). Toque de novo para gravar mesmo assim.`;
        avisada = limpo.frota;
      }
    }
    if (!mostrarErros(form, erros)) return;
    if (f) {
      M.editarFrota(m.id, f.id, limpo);
      pronto(`${limpo.frota} salva.`);
      return;
    }
    M.adicionarFrota(m.id, limpo);
    if (outra) {
      redesenhar();
      avisar(`${limpo.frota} adicionada.`);
      abrirFrota(m, null, { situacao: limpo.situacao, dataMobilizacao: limpo.dataMobilizacao, dataDesmobilizacao: limpo.dataDesmobilizacao });
      return;
    }
    pronto(`${limpo.frota} adicionada.`);
  }

  abrir(f ? `${f.frota} · ${m.nome}` : `Adicionar frota · ${m.nome}`, form, f
    ? [el("button", { type: "button", class: "perigo-link", onclick: () => remover(m, f) }, "Remover da mobilização"),
        el("span", { class: "vao" }),
        el("button", { type: "button", onclick: fechar }, "Cancelar"),
        el("button", { type: "button", class: "primario", onclick: () => salvar() }, "Salvar")]
    : [el("button", { type: "button", onclick: fechar }, "Cancelar"),
        el("button", { type: "button", onclick: () => salvar(true) }, "Adicionar e outra"),
        el("button", { type: "button", class: "primario", onclick: () => salvar() }, "Adicionar")]);
}

function remover(m, f) {
  const guardada = M.removerFrota(m.id, f.id);
  fechar();
  redesenhar();
  avisar(`${f.frota} removida de ${m.nome}.`, { acao: () => { M.devolverFrota(guardada); redesenhar(); }, tempo: 8000 });
}
