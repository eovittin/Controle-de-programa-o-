// Passar os dados para outro aparelho por um link: o backup inteiro vai,
// comprimido, depois do # do endereço (#/receber?d=…). O que vem depois do #
// não é mandado para o GitHub: só quem recebe o link vê. No outro aparelho, o
// site tira os dados do endereço e pergunta se junta.

import { el, textoParaLink, linkParaTexto, plural } from "./util.js";
import * as D from "./dados.js";
import * as M from "./mobilizacoes.js";
import { redesenhar } from "./estado.js";
import { abrir, fechar } from "./caixas.js";
import { avisar } from "./ui.js";

// mais que isso não cabe numa mensagem do WhatsApp
const LIMITE = 60000;

const oQue = (n, nm) => [plural(n, "programação", "programações"), plural(nm, "mobilização", "mobilizações")].join(" e ");

/** O aviso depois de juntar um backup (em arquivo ou por link). */
export function resumoRestauracao(r) {
  const conta = (novas, atualizadas) => `${plural(novas, "nova", "novas")}, ${plural(atualizadas, "atualizada", "atualizadas")}`;
  const partes = [`programações: ${conta(r.novos, r.atualizados)}`];
  if (r.mobNovas || r.mobAtualizadas) partes.push(`mobilizações: ${conta(r.mobNovas, r.mobAtualizadas)}`);
  const ignoradas = r.ignorados + r.mobIgnoradas;
  return `Dados recebidos — ${partes.join("; ")}` + (ignoradas ? `; ${ignoradas} ignorada(s) por estarem incompletas` : "") + ".";
}

export async function abrirEnviar() {
  const link = `${location.origin}${location.pathname}#/receber?d=${await textoParaLink(D.backup())}`;
  const campo = el("textarea", { class: "link-transferencia", readonly: true, rows: 3, value: link, "aria-label": "O link" });
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      avisar("Link copiado. Cole numa mensagem para você mesmo.");
    } catch {
      campo.focus();
      campo.select();
      avisar("Não deu para copiar sozinho: o link está selecionado, copie com Ctrl+C.");
    }
  };
  const compartilhar = async () => {
    try {
      await navigator.share({ title: "Programação da Operação", text: "Abra no outro aparelho para levar a programação:", url: link });
    } catch (e) {
      if (e.name !== "AbortError") avisar("Não deu para compartilhar. Use Copiar link.");
    }
  };
  const podeCompartilhar = typeof navigator.share === "function";

  abrir("Enviar para outro aparelho", el("div", { class: "form" },
    el("p", {}, `Este link leva ${oQue(D.todos().length, M.todas().length)} deste aparelho.`),
    el("ol", { class: "passos" },
      el("li", {}, "Mande o link para você mesmo: no WhatsApp, por e-mail…"),
      el("li", {}, "No outro aparelho, abra o link no navegador em que você usa a programação."),
      el("li", {}, "Lá, toque em ", el("b", {}, "Juntar"), ". Nada do que já está lá é apagado.")),
    link.length > LIMITE
      ? el("p", { class: "aviso-atraso" }, "São muitos dados para um link: talvez não caiba numa mensagem. Se não abrir, use Baixar backup.")
      : null,
    campo,
    el("p", { class: "dica" }, "Quem tiver o link vê esses dados: mande só para você.")), [
    el("button", { type: "button", onclick: fechar }, "Fechar"),
    el("button", { type: "button", class: podeCompartilhar ? "" : "primario", onclick: copiar }, "Copiar link"),
    podeCompartilhar ? el("button", { type: "button", class: "primario", onclick: compartilhar }, "Compartilhar (WhatsApp…)") : null,
  ]);
}

/** O endereço é um link de transferência? Tira os dados dele (para não
 *  ficarem no histórico nem voltarem num recarregar), vai para a Agenda e
 *  pergunta se junta. Devolve true se era. */
export function receber() {
  const achado = location.hash.match(/^#\/receber\?d=([\w-]+)$/);
  if (!achado) return false;
  history.replaceState(null, "", location.pathname + location.search + "#/agenda");
  perguntar(achado[1]);
  return true;
}

async function perguntar(codigo) {
  let texto, lido;
  try {
    texto = await linkParaTexto(codigo);
    lido = JSON.parse(texto);
  } catch (e) {
    avisar(e.message.startsWith("Este navegador") ? e.message
      : "Este link está incompleto ou estragado. Gere outro no aparelho de origem.", { tempo: 10000 });
    return;
  }
  const n = Array.isArray(lido?.itens) ? lido.itens.length : 0;
  const nm = Array.isArray(lido?.mobilizacoes) ? lido.mobilizacoes.length : 0;
  const data = new Date(lido?.exportadoEm);
  const quando = Number.isNaN(data.getTime()) ? ""
    : data.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  abrir("Dados de outro aparelho", el("div", { class: "form" },
    el("p", {}, `Este link trouxe ${oQue(n, nm)}` + (quando ? `, enviadas em ${quando}` : "") + "."),
    el("p", { class: "dica" }, "Juntar acrescenta o que ainda não está aqui e atualiza o que já está. Nada daqui é apagado.")), [
    el("button", { type: "button", onclick: fechar }, "Agora não"),
    el("button", { type: "button", class: "primario", onclick: () => {
      try {
        const r = D.restaurarBackup(texto, false);
        fechar();
        redesenhar();
        avisar(resumoRestauracao(r), { tempo: 9000 });
      } catch (e) {
        avisar(e.message, { tempo: 8000 });
      }
    } }, "Juntar"),
  ]);
}
