// As quatro telas: Agenda (o mês), Semana (os dias em colunas), Lista e
// Dados. Cada uma tem a barra do alto e o corpo; a busca redesenha só o corpo.

import { el, hoje, somaDias, difDias, inicioDaSemana, brCurto, brData, porExtenso, nomeMes, somaMes,
  diasNoMes, SEMANA, plural } from "./util.js";
import * as D from "./dados.js";
import { ui, redesenhar } from "./estado.js";
import { filtrados, barraFiltros, linhaItem, vazio, cartao } from "./comum.js";
import { abrirFicha, abrirFormulario, confirmar } from "./caixas.js";
import { icone, avisar, baixar, seloSituacao } from "./ui.js";

const nav = (anterior, rotulo, proximo, rotuloSetas) => el("div", { class: "nav" },
  el("button", { type: "button", class: "seta", "aria-label": `${rotuloSetas} anterior`, onclick: anterior }, "‹"),
  el("b", { class: "nav-rot" }, rotulo),
  el("button", { type: "button", class: "seta", "aria-label": `Próxim${rotuloSetas === "Semana" ? "a" : "o"} ${rotuloSetas.toLowerCase()}`, onclick: proximo }, "›"));

const botaoHoje = (mostrar, acao) => mostrar ? el("button", { type: "button", class: "pilula", onclick: acao }, "Hoje") : null;

const imprimir = () => el("button", { type: "button", class: "so-icone", title: "Imprimir", "aria-label": "Imprimir", onclick: () => print() }, icone("imprimir"));

// ── Agenda ───────────────────────────────────────────────────────────────────

/** O anel do mês: a parte de cada situação, e no meio quanto saiu no prazo. */
function anel(partes, centro, rotulo) {
  const total = partes.reduce((s, p) => s + p.valor, 0);
  const L = 96, R = 37, C = 2 * Math.PI * R;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${L} ${L}`);
  svg.setAttribute("class", "anel-svg");
  svg.setAttribute("aria-hidden", "true");
  const circulo = (cor, frac = 1, inicio = 0) => {
    const c = document.createElementNS(ns, "circle");
    Object.entries({ cx: L / 2, cy: L / 2, r: R, fill: "none", "stroke-width": 11 }).forEach(([k, v]) => c.setAttribute(k, v));
    c.style.stroke = cor;
    if (frac < 1) {
      c.setAttribute("stroke-dasharray", `${Math.max(0, frac * C - 2)} ${C}`);
      c.setAttribute("stroke-dashoffset", String(-inicio * C));
    }
    c.setAttribute("transform", `rotate(-90 ${L / 2} ${L / 2})`);
    return c;
  };
  svg.append(circulo("var(--papel3)"));
  let ac = 0;
  for (const p of partes) if (p.valor && total) { svg.append(circulo(p.cor, p.valor / total, ac)); ac += p.valor / total; }
  return el("div", { class: "anel" },
    el("div", { class: "anel-roda" }, svg, el("div", { class: "anel-meio" }, el("b", {}, centro), el("small", {}, rotulo))),
    el("ul", { class: "anel-leg" }, partes.map(p => el("li", {},
      el("i", { style: `background:${p.cor}` }), el("span", {}, p.rotulo), el("b", {}, String(p.valor))))));
}

function mudarMes(mes) {
  ui.mes = mes;
  ui.dia = mes === hoje().slice(0, 7) ? hoje() : mes + "-01";
  redesenhar();
}

export const agenda = {
  titulo: "Agenda",
  barra() {
    const h = hoje();
    return barraFiltros([
      nav(() => mudarMes(somaMes(ui.mes, -1)), nomeMes(ui.mes), () => mudarMes(somaMes(ui.mes, 1)), "Mês"),
      botaoHoje(ui.mes !== h.slice(0, 7) || ui.dia !== h, () => { ui.dia = h; mudarMes(h.slice(0, 7)); }),
    ]);
  },
  corpo() {
    const ref = hoje();
    const lista = filtrados();
    const inicio = inicioDaSemana(ui.mes + "-01");
    const semanas = Math.ceil((difDias(inicio, ui.mes + "-01") + diasNoMes(ui.mes)) / 7);
    const fim = somaDias(inicio, semanas * 7 - 1);

    const porDia = new Map();
    for (const it of lista) {
      if (!D.noPeriodo(it, inicio, fim)) continue;
      for (const d of D.diasDo(it)) {
        if (!porDia.has(d)) porDia.set(d, []);
        porDia.get(d).push(it);
      }
    }
    for (const l of porDia.values()) l.sort(D.ordemDoDia);

    const escolher = d => {
      if (d.slice(0, 7) !== ui.mes) { ui.dia = d; ui.mes = d.slice(0, 7); redesenhar(); return; }
      ui.dia = d;
      redesenhar();
    };
    const MAX = 3;
    const celulas = [];
    for (let i = 0; i < semanas * 7; i++) {
      const d = somaDias(inicio, i);
      const doDia = porDia.get(d) || [];
      const cabem = doDia.length > MAX ? MAX - 1 : MAX;
      celulas.push(el("div", {
        class: "dia" + (d.slice(0, 7) !== ui.mes ? " fora" : "") + (i % 7 >= 5 ? " fim" : "") +
          (d === ref ? " hoje" : "") + (d === ui.dia ? " sel" : ""),
        onclick: () => escolher(d) },
        el("div", { class: "dia-cab" },
          el("button", { type: "button", class: "dia-add", title: "Programar neste dia", "aria-label": "Programar em " + porExtenso(d),
            onclick: e => { e.stopPropagation(); abrirFormulario(null, { data: d }); } }, "+"),
          el("button", { type: "button", class: "dia-num", "aria-label": porExtenso(d) + (doDia.length ? ` · ${doDia.length}` : ""),
            onclick: e => { e.stopPropagation(); escolher(d); } }, String(Number(d.slice(8))))),
        el("div", { class: "dia-evs" },
          doDia.slice(0, cabem).map(it => el("button", {
            type: "button", class: "ev s-" + D.situacao(it, ref), title: `${D.titulo(it)} — ${D.SITUACOES[D.situacao(it, ref)]}`,
            onclick: e => { e.stopPropagation(); abrirFicha(it.id); } },
            it.horaInicio && d === it.data ? el("span", { class: "ev-hora" }, it.horaInicio) : null,
            it.frota ? el("b", {}, it.frota) : null, " ", it.atividade)),
          doDia.length > cabem ? el("button", { type: "button", class: "ev-mais", onclick: e => { e.stopPropagation(); escolher(d); } },
            `+${doDia.length - cabem} mais`) : null),
        doDia.length ? el("div", { class: "pontos", "aria-hidden": "true" },
          doDia.slice(0, 4).map(it => el("i", { class: "s-" + D.situacao(it, ref) }))) : null));
    }

    const legenda = el("div", { class: "legenda" }, ["programada", "hoje", "andamento", "atrasada", "concluida", "cancelada"]
      .map(s => el("span", { class: "s-" + s }, el("i"), D.SITUACOES[s])));

    // a coluna da direita: o dia tocado, as atrasadas e o resumo do mês
    const doDia = lista.filter(it => D.noPeriodo(it, ui.dia, ui.dia)).sort(D.ordemDoDia);
    const cDia = cartao(ui.dia === ref ? "Hoje" : "Dia", el("div", { class: "lista-itens" },
      doDia.length ? doDia.map(it => linhaItem(it, { ref })) : vazio("Nada programado neste dia.")), {
      sub: porExtenso(ui.dia),
      pe: el("button", { type: "button", class: "largo", onclick: () => abrirFormulario(null, { data: ui.dia }) }, "+ Programar neste dia"),
    });

    const atrasadas = lista.filter(it => D.situacao(it, ref) === "atrasada").sort((a, b) => D.prazo(a).localeCompare(D.prazo(b)));
    const MOSTRA = 6;
    const cAtrasadas = atrasadas.length ? cartao(`${plural(atrasadas.length, "atrasada", "atrasadas")}`, el("div", { class: "lista-itens" },
      atrasadas.slice(0, MOSTRA).map(it => linhaItem(it, { ref, remarcar: true, mostraDia: true }))), {
      classe: "alerta",
      pe: atrasadas.length > MOSTRA ? el("button", { type: "button", class: "largo",
        onclick: () => { ui.periodo = "tudo"; ui.filtro = "atrasadas"; location.hash = "#/lista"; } }, `Ver todas (${atrasadas.length})`) : null,
    }) : null;

    const doMes = lista.filter(it => D.noPeriodo(it, ui.mes + "-01", ui.mes + "-" + diasNoMes(ui.mes)));
    const conta = s => doMes.filter(it => D.situacao(it, ref) === s).length;
    const noPrazo = conta("concluida"), tarde = conta("concluida-atraso"), atrasando = conta("atrasada");
    const abertas = conta("programada") + conta("hoje") + conta("andamento");
    const venceu = noPrazo + tarde + atrasando;
    const cResumo = cartao("Resumo do mês", doMes.length ? anel([
      { rotulo: "Feitas no prazo", valor: noPrazo, cor: "var(--verde)" },
      { rotulo: "Feitas com atraso", valor: tarde, cor: "var(--laranja)" },
      { rotulo: "Atrasadas", valor: atrasando, cor: "var(--vermelho)" },
      { rotulo: "A fazer", valor: abertas, cor: "var(--azul)" },
    ], venceu ? Math.round(noPrazo * 100 / venceu) + "%" : "—", "no prazo") : vazio("Nada programado neste mês."), {
      sub: nomeMes(ui.mes),
    });

    return el("div", { class: "agenda" },
      el("div", { class: "agenda-cal" },
        el("section", { class: "cal" },
          el("div", { class: "cal-sem" }, SEMANA.map((s, i) => el("span", { class: i >= 5 ? "fim" : "" }, s))),
          el("div", { class: "cal-grade" }, celulas),
          legenda)),
      el("aside", { class: "trilho" }, cDia, cAtrasadas, cResumo));
  },
};

// ── Semana ───────────────────────────────────────────────────────────────────

function mudarSemana(seg) {
  ui.semana = seg;
  redesenhar();
}

export const semana = {
  titulo: "Semana",
  barra() {
    const seg = ui.semana, dom = somaDias(seg, 6);
    const atual = inicioDaSemana(hoje());
    return barraFiltros([
      nav(() => mudarSemana(somaDias(seg, -7)), `${brCurto(seg)} a ${brData(dom)}`, () => mudarSemana(somaDias(seg, 7)), "Semana"),
      botaoHoje(seg !== atual, () => mudarSemana(atual)),
    ], [imprimir()]);
  },
  corpo() {
    const ref = hoje();
    const seg = ui.semana;
    const lista = filtrados().filter(it => D.noPeriodo(it, seg, somaDias(seg, 6)));
    const colunas = SEMANA.map((nome, i) => {
      const d = somaDias(seg, i);
      const doDia = lista.filter(it => D.noPeriodo(it, d, d)).sort(D.ordemDoDia);
      return el("section", { class: "col" + (d === ref ? " hoje" : "") + (i >= 5 ? " fim" : "") },
        el("header", { class: "col-cab" },
          el("div", {}, el("span", { class: "col-nome" }, nome), el("b", { class: "col-dia" }, brCurto(d))),
          el("span", { class: "col-conta" }, doDia.length ? String(doDia.length) : ""),
          el("button", { type: "button", class: "dia-add sempre", title: "Programar neste dia", "aria-label": "Programar em " + porExtenso(d),
            onclick: () => abrirFormulario(null, { data: d }) }, "+")),
        el("div", { class: "col-itens" }, doDia.length ? doDia.map(it => cartaoSemana(it, d, ref)) : el("p", { class: "col-vazio" }, "—")));
    });
    return el("div", { class: "semana" }, colunas);
  },
};

function cartaoSemana(it, d, ref) {
  const s = D.situacao(it, ref);
  const total = difDias(it.data, D.prazo(it)) + 1;
  const parte = total > 1 ? `dia ${difDias(it.data, d) + 1} de ${total}` : "";
  const hora = it.horaInicio && d === it.data ? D.horario(it) : "";
  return el("button", { type: "button", class: "sem-item s-" + s, onclick: () => abrirFicha(it.id) },
    el("div", { class: "sem-topo" }, el("span", { class: "sem-hora" }, [hora, parte].filter(Boolean).join(" · ") || "Dia todo"),
      it.prioridade === "alta" ? el("span", { class: "tag alta" }, "Alta") : null),
    el("div", { class: "sem-tit" }, it.frota ? el("b", {}, it.frota + " ") : null, it.atividade),
    it.onde || it.responsavel ? el("div", { class: "sem-sub" }, [it.onde, it.responsavel].filter(Boolean).join(" · ")) : null,
    el("div", { class: "sem-pe" }, el("span", { class: "sem-cat" }, D.nomeCategoria(it.categoria)), seloSituacao(it, ref)));
}

// ── Lista ────────────────────────────────────────────────────────────────────

const PERIODOS = [["semana", "Esta semana"], ["7dias", "Próximos 7 dias"], ["mes", "Este mês"], ["proximo", "Próximo mês"],
  ["passado", "Mês passado"], ["tudo", "Tudo"]];
const FILTROS = [["todas", "Todas as situações"], ["abertas", "Em aberto"], ["atrasadas", "Atrasadas"],
  ["concluidas", "Concluídas"], ["canceladas", "Canceladas"]];

function intervalo(periodo, ref) {
  const mes = ref.slice(0, 7);
  const doMes = m => [m + "-01", m + "-" + diasNoMes(m)];
  switch (periodo) {
    case "semana": { const s = inicioDaSemana(ref); return [s, somaDias(s, 6)]; }
    case "7dias": return [ref, somaDias(ref, 6)];
    case "mes": return doMes(mes);
    case "proximo": return doMes(somaMes(mes, 1));
    case "passado": return doMes(somaMes(mes, -1));
    default: return ["0000-01-01", "9999-12-31"];
  }
}

const passaFiltro = (s, filtro) => filtro === "abertas" ? D.ABERTAS.includes(s)
  : filtro === "atrasadas" ? s === "atrasada"
  : filtro === "concluidas" ? s === "concluida" || s === "concluida-atraso"
  : filtro === "canceladas" ? s === "cancelada"
  : true;

function listaDaTela(ref = hoje()) {
  const [de, ate] = intervalo(ui.periodo, ref);
  return filtrados()
    .filter(it => D.noPeriodo(it, de, ate) && passaFiltro(D.situacao(it, ref), ui.filtro))
    .sort((a, b) => a.data.localeCompare(b.data) || D.ordemDoDia(a, b));
}

const seletor = (opcoes, atual, rotulo, aoMudar) => el("select", { "aria-label": rotulo, onchange: e => aoMudar(e.target.value) },
  opcoes.map(([v, n]) => el("option", { value: v, selected: v === atual }, n)));

export const lista = {
  titulo: "Lista",
  barra() {
    return barraFiltros([
      seletor(PERIODOS, ui.periodo, "Período", v => { ui.periodo = v; redesenhar(); }),
      seletor(FILTROS, ui.filtro, "Situação", v => { ui.filtro = v; redesenhar(); }),
    ], [
      el("button", { type: "button", onclick: () => {
        const l = listaDaTela();
        if (!l.length) return avisar("Nada na lista para exportar.");
        baixar(`programacao-${hoje()}.csv`, D.planilha(l), "text/csv;charset=utf-8");
      } }, icone("baixar"), "Excel"),
      imprimir(),
    ]);
  },
  corpo() {
    const ref = hoje();
    const l = listaDaTela(ref);
    if (!l.length) {
      return el("div", { class: "cartao" }, vazio(D.todos().length
        ? "Nada nesse período com esses filtros."
        : "Ainda não há nada programado. Comece pelo + Nova, no alto."));
    }
    const atrasadas = l.filter(it => D.situacao(it, ref) === "atrasada").length;
    const grupos = new Map();
    for (const it of l) {
      if (!grupos.has(it.data)) grupos.set(it.data, []);
      grupos.get(it.data).push(it);
    }
    return el("div", { class: "lista" },
      el("p", { class: "lista-resumo" }, plural(l.length, "programação", "programações"),
        atrasadas ? el("span", { class: "s-atrasada selo" }, plural(atrasadas, "atrasada", "atrasadas")) : null),
      [...grupos].map(([d, its]) => el("section", { class: "cartao grupo" },
        el("h2", { class: "grupo-cab" + (d === ref ? " hoje" : "") }, d === ref ? "Hoje · " + porExtenso(d) : porExtenso(d),
          d.slice(0, 4) !== ref.slice(0, 4) ? " de " + d.slice(0, 4) : ""),
        el("div", { class: "lista-itens" }, its.map(it => linhaItem(it, { ref, mostraDia: !!it.dataFim }))))));
  },
};

// ── Dados ────────────────────────────────────────────────────────────────────

export const dados = {
  titulo: "Dados",
  barra: () => null,
  corpo() {
    const n = D.todos().length;
    const arquivo = el("input", { type: "file", accept: ".json,application/json", hidden: true });
    let substituir = false;
    arquivo.addEventListener("change", async () => {
      const f = arquivo.files[0];
      arquivo.value = "";
      if (!f) return;
      try {
        const r = D.restaurarBackup(await f.text(), substituir);
        redesenhar();
        avisar(`Backup restaurado: ${plural(r.novos, "nova", "novas")}, ${plural(r.atualizados, "atualizada", "atualizadas")}` +
          (r.ignorados ? `, ${r.ignorados} ignorada(s) por estarem incompletas` : "") + ".", { tempo: 8000 });
      } catch (e) {
        avisar(e instanceof SyntaxError ? "Esse arquivo não é um backup (.json) válido." : e.message, { tempo: 8000 });
      }
    });
    const restaurar = trocar => {
      substituir = trocar;
      if (trocar && n) {
        confirmar("Substituir tudo?", `As ${n} programações deste navegador serão trocadas pelas do arquivo.`, "Escolher o arquivo", () => arquivo.click());
      } else arquivo.click();
    };

    return el("div", { class: "dados" },
      cartao("Onde ficam os seus dados", el("div", {},
        el("p", {}, "Tudo fica guardado ", el("b", {}, "neste navegador, neste aparelho"),
          ". Ninguém mais vê, e nada vai para a internet. Se você limpar os dados do navegador, a programação vai junto — por isso baixe um backup de vez em quando."),
        el("p", {}, "Para usar em outro aparelho: baixe o backup aqui e restaure lá."),
        el("p", { class: "dados-num" }, el("b", {}, String(n)), " ", n === 1 ? "programação guardada" : "programações guardadas"))),
      cartao("Backup", el("div", { class: "botoes" },
        el("button", { type: "button", class: "primario", disabled: !n, onclick: () => {
          baixar(`backup-programacao-${hoje()}.json`, D.backup(), "application/json");
          avisar("Backup baixado.");
        } }, icone("baixar"), "Baixar backup"),
        el("button", { type: "button", onclick: () => restaurar(false) }, "Restaurar backup (juntar)"),
        el("button", { type: "button", onclick: () => restaurar(true) }, "Restaurar backup (substituir tudo)"),
        arquivo), { sub: "arquivo .json" }),
      cartao("Planilha", el("div", { class: "botoes" },
        el("button", { type: "button", disabled: !n, onclick: () => baixar(`programacao-completa-${hoje()}.csv`, D.planilha(
          [...D.todos()].sort((a, b) => a.data.localeCompare(b.data) || D.ordemDoDia(a, b))), "text/csv;charset=utf-8") },
          icone("baixar"), "Exportar tudo para o Excel")), { sub: "arquivo .csv" }),
      cartao("Apagar tudo", el("div", {},
        el("p", {}, "Apaga todas as programações deste navegador. Não tem volta — baixe o backup antes."),
        el("button", { type: "button", class: "perigo", disabled: !n, onclick: () => confirmar("Apagar tudo?",
          `As ${n} programações deste navegador serão apagadas. Não tem como desfazer.`, "Apagar tudo",
          () => { D.apagarTudo(); redesenhar(); avisar("Tudo apagado."); }, { perigo: true }) }, "Apagar tudo"))));
  },
};
