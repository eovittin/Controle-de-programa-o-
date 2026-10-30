// Ferramentas pequenas usadas pelo site todo: montar elementos e lidar com datas.
//
// As datas andam como texto "AAAA-MM-DD" (o dia, sem hora). A conta é feita em
// UTC para o fuso não empurrar o dia para trás ou para a frente; só o "hoje"
// vem do relógio local de quem está usando.

/** Monta um elemento: el("button", { class: "x", onclick }, "texto", outroNo). */
export function el(tag, attrs, ...filhos) {
  const no = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") no.className = v;
    else if (k === "dataset") Object.assign(no.dataset, v);
    else if (k === "style") no.style.cssText = v;
    else if (k === "value") no.value = v;
    else if (k.startsWith("on") && typeof v === "function") no.addEventListener(k.slice(2), v);
    else no.setAttribute(k, v === true ? "" : v);
  }
  for (const f of filhos.flat(Infinity)) {
    if (f == null || f === false) continue;
    no.append(f instanceof Node ? f : String(f));
  }
  return no;
}

const pad = n => String(n).padStart(2, "0");

/** O dia de hoje no relógio de quem usa. */
export const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const ehData = s => /^\d{4}-\d{2}-\d{2}$/.test(s || "") && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
export const ehHora = s => /^([01]\d|2[0-3]):[0-5]\d$/.test(s || "");

const utc = iso => new Date(iso + "T00:00:00Z");
export const somaDias = (iso, n) => {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** Quantos dias de `a` até `b` (positivo quando `b` vem depois). */
export const difDias = (a, b) => Math.round((utc(b) - utc(a)) / 864e5);
/** 0 = segunda … 6 = domingo. */
export const diaDaSemana = iso => (utc(iso).getUTCDay() + 6) % 7;
export const inicioDaSemana = iso => somaDias(iso, -diaDaSemana(iso));

export const SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const SEMANA_LONGA = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
  "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-10-26" → "26/10". */
export const brCurto = iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "";
/** "2026-10-26" → "26/10/2026". */
export const brData = iso => iso ? `${brCurto(iso)}/${iso.slice(0, 4)}` : "";
/** "2026-10-26" → "segunda, 26/10". */
export const porExtenso = iso => `${SEMANA_LONGA[diaDaSemana(iso)]}, ${brCurto(iso)}`;

/** "2026-10" e um número de meses → "2026-11". */
export function somaMes(mes, n) {
  const [a, m] = mes.split("-").map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${pad(t % 12 + 1)}`;
}
/** "2026-10" → "Outubro 2026". */
export function nomeMes(mes) {
  const [a, m] = mes.split("-").map(Number);
  const n = MESES[m - 1];
  return `${n[0].toUpperCase()}${n.slice(1)} ${a}`;
}
/** Quantos dias tem o mês "2026-10". */
export const diasNoMes = mes => {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
};

/** Sem acento e em minúsculas — para a busca. */
export const semAcento = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** "1 dia", "3 dias". */
export const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/** Texto de formulário limpo: sem espaço sobrando e com tamanho máximo. */
export const texto = (v, max = 160) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);

/** "617" → "F-617"; o resto como foi digitado, em maiúsculas. */
export function normalizaFrota(v) {
  const t = texto(v, 30).toUpperCase();
  return /^\d+$/.test(t) ? "F-" + t : t;
}

/** "2026-10-26" → "26/10/2026" para planilha; vazio continua vazio. */
export const dataPlanilha = iso => iso ? iso.split("-").reverse().join("/") : "";

/** Linhas em CSV para o Excel: ponto e vírgula e a marca de UTF-8 na frente,
 *  que é o que o Excel em português espera. */
export function csv(linhas) {
  const cel = v => {
    const s = String(v ?? "");
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + linhas.map(l => l.map(cel).join(";")).join("\r\n");
}

// ── texto ↔ link ─────────────────────────────────────────────────────────────
// Para levar os dados de um aparelho para outro dentro de um link: o texto é
// comprimido e vira base64 sem os caracteres que estragam um endereço. O
// primeiro caractere diz como: "1" comprimido, "0" sem compressão (navegador
// antigo, sem CompressionStream).

function paraBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const deBase64 = t => Uint8Array.from(atob(t.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
const passarPor = async (bytes, transformacao) =>
  new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(transformacao)).arrayBuffer());

export async function textoParaLink(texto) {
  const bytes = new TextEncoder().encode(texto);
  if (typeof CompressionStream === "undefined") return "0" + paraBase64(bytes);
  return "1" + paraBase64(await passarPor(bytes, new CompressionStream("deflate-raw")));
}

export async function linkParaTexto(codigo) {
  const bytes = deBase64(codigo.slice(1));
  if (codigo[0] === "0") return new TextDecoder().decode(bytes);
  if (codigo[0] !== "1") throw new Error("formato desconhecido");
  if (typeof DecompressionStream === "undefined") throw new Error("Este navegador é antigo demais para abrir o link. Use o backup em arquivo.");
  return new TextDecoder().decode(await passarPor(bytes, new DecompressionStream("deflate-raw")));
}
