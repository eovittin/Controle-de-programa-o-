// O que a tela está mostrando agora (vista, mês, dia escolhido, filtros), e
// o jeito de pedir para ela se redesenhar. Fica num lugar só para as telas e
// as caixas não precisarem se conhecer.

import { hoje, inicioDaSemana } from "./util.js";

const h = hoje();
export const ui = {
  vista: "agenda",
  mes: h.slice(0, 7),         // o mês da Agenda
  dia: h,                     // o dia tocado na Agenda
  semana: inicioDaSemana(h),  // a segunda-feira da Semana
  busca: "",
  categoria: "",
  periodo: "mes",             // Lista
  filtro: "todas",            // Lista
};

let tudo = () => {}, corpo = () => {};
export function aoRedesenhar(fnTudo, fnCorpo) { tudo = fnTudo; corpo = fnCorpo; }
/** A tela inteira (troca de mês, de vista…). */
export const redesenhar = () => tudo();
/** Só o conteúdo, sem a barra de filtros — para a busca não perder o foco. */
export const redesenharCorpo = () => corpo();
