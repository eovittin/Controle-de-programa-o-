// As contas da programação, sem navegador: node --test testes/

import { test } from "node:test";
import assert from "node:assert/strict";
import * as D from "../js/dados.js";

const novo = (campos = {}) => {
  const { limpo, erros } = D.conferir({ atividade: "Viagem para Natal", data: "2026-10-20", ...campos });
  assert.deepEqual(erros, {});
  return D.criar(limpo)[0];
};

test("situação conforme o dia de referência", () => {
  D.apagarTudo();
  const it = novo({ data: "2026-10-20" });
  assert.equal(D.situacao(it, "2026-10-19"), "programada");
  assert.equal(D.situacao(it, "2026-10-20"), "hoje");
  assert.equal(D.situacao(it, "2026-10-21"), "atrasada");
  D.iniciar(it.id);
  assert.equal(D.situacao(it, "2026-10-20"), "andamento");
  assert.equal(D.situacao(it, "2026-10-21"), "atrasada", "em andamento depois do prazo continua atrasada");
});

test("item de vários dias: atrasa só depois do último", () => {
  D.apagarTudo();
  const it = novo({ data: "2026-10-20", dataFim: "2026-10-22" });
  assert.equal(D.situacao(it, "2026-10-21"), "hoje");
  assert.equal(D.situacao(it, "2026-10-22"), "hoje");
  assert.equal(D.situacao(it, "2026-10-23"), "atrasada");
  assert.deepEqual(D.diasDo(it), ["2026-10-20", "2026-10-21", "2026-10-22"]);
  assert.ok(D.noPeriodo(it, "2026-10-22", "2026-10-30"));
  assert.ok(!D.noPeriodo(it, "2026-10-23", "2026-10-30"));
});

test("concluir no prazo e com atraso", () => {
  D.apagarTudo();
  const a = novo({ data: "2026-10-20" });
  D.concluir(a.id, "2026-10-20");
  assert.equal(D.situacao(a, "2026-10-25"), "concluida");
  assert.equal(a.motivoAtraso, undefined);

  const b = novo({ data: "2026-10-20" });
  D.concluir(b.id, "2026-10-23", "Sem motorista", "motorista de férias");
  assert.equal(D.situacao(b, "2026-10-25"), "concluida-atraso");
  assert.equal(b.motivoAtraso, "Sem motorista");
  assert.match(b.historico.at(-1).texto, /3 dias depois do prazo — Sem motorista \(motorista de férias\)/);

  D.reabrir(b.id);
  assert.equal(b.concluidaEm, undefined);
  assert.equal(D.situacao(b, "2026-10-25"), "atrasada");
});

test("cancelar e desfazer", () => {
  D.apagarTudo();
  const it = novo();
  D.cancelar(it.id, "Cliente desmarcou");
  assert.equal(D.situacao(it, "2026-10-25"), "cancelada");
  D.restaurar(it.id);
  assert.equal(it.motivoCancelamento, undefined);
  assert.equal(D.situacao(it, "2026-10-25"), "atrasada");
});

test("conferir: frota, campos obrigatórios e horários", () => {
  assert.equal(D.normalizaFrota(" 617 "), "F-617");
  assert.equal(D.normalizaFrota("f-617"), "F-617");
  assert.equal(D.normalizaFrota("ABC1D23"), "ABC1D23");

  const { erros } = D.conferir({ atividade: " ", data: "" });
  assert.ok(erros.atividade && erros.data);

  assert.ok(D.conferir({ atividade: "x", data: "2026-10-20", dataFim: "2026-10-19" }).erros.dataFim);
  assert.ok(D.conferir({ atividade: "x", data: "2026-10-20", horaInicio: "10:00", horaFim: "09:00" }).erros.horaFim);
  assert.ok(D.conferir({ atividade: "x", data: "2026-10-20", horaFim: "09:00" }).erros.horaInicio);
  // atravessar a meia-noite vale quando tem "até"
  assert.deepEqual(D.conferir({ atividade: "x", data: "2026-10-20", dataFim: "2026-10-21", horaInicio: "22:00", horaFim: "06:00" }).erros, {});
  // "até" igual ao dia some
  assert.equal(D.conferir({ atividade: "x", data: "2026-10-20", dataFim: "2026-10-20" }).limpo.dataFim, "");
  // categoria e prioridade desconhecidas caem no padrão
  const { limpo } = D.conferir({ atividade: "x", data: "2026-10-20", categoria: "?", prioridade: "?" });
  assert.equal(limpo.categoria, "outros");
  assert.equal(limpo.prioridade, "media");
});

test("repetição: todo dia, dias úteis e toda semana", () => {
  // 2026-10-23 é sexta
  assert.deepEqual(D.repeticoes("2026-10-23", "util", "2026-10-27"), ["2026-10-23", "2026-10-26", "2026-10-27"]);
  assert.deepEqual(D.repeticoes("2026-10-23", "dia", "2026-10-25"), ["2026-10-23", "2026-10-24", "2026-10-25"]);
  assert.deepEqual(D.repeticoes("2026-10-23", "semana", "2026-11-06"), ["2026-10-23", "2026-10-30", "2026-11-06"]);
  assert.deepEqual(D.repeticoes("2026-10-23", "", "2026-11-06"), ["2026-10-23"]);
  assert.equal(D.repeticoes("2026-01-01", "dia", "2027-12-31").length, 120);

  D.apagarTudo();
  const { limpo } = D.conferir({ atividade: "Lavagem", data: "2026-10-23", dataFim: "2026-10-24" });
  const criados = D.criar(limpo, D.repeticoes("2026-10-23", "semana", "2026-11-06"));
  assert.equal(criados.length, 3);
  assert.equal(criados[2].dataFim, "2026-11-07", "a duração vai junto");
  assert.ok(criados.every(c => c.grupo === criados[0].grupo));
});

test("editar: mudar o dia é remarcação e fica no histórico", () => {
  D.apagarTudo();
  const it = novo({ data: "2026-10-20", frota: "617" });
  const { limpo } = D.conferir({ ...it, data: "2026-10-22", responsavel: "Zé" });
  assert.ok(D.remarca(it, limpo));
  D.editar(it.id, limpo, "Frota indisponível");
  assert.equal(it.data, "2026-10-22");
  assert.equal(it.dataOriginal, "2026-10-20");
  assert.equal(it.remarcacoes, 1);
  const textos = it.historico.map(h => h.texto);
  assert.ok(textos.includes("Remarcada de 20/10 para 22/10 — Frota indisponível"));
  assert.ok(textos.includes("Editada: responsável"));

  const { limpo: de_novo } = D.conferir({ ...it, data: "2026-10-25" });
  D.editar(it.id, de_novo, "Outra prioridade");
  assert.equal(it.remarcacoes, 2);
  assert.equal(it.dataOriginal, "2026-10-20", "guarda a primeira data");
});

test("ordem do dia: hora, prioridade, frota", () => {
  D.apagarTudo();
  const a = novo({ atividade: "A", frota: "620" });
  const b = novo({ atividade: "B", frota: "617", horaInicio: "09:00" });
  const c = novo({ atividade: "C", frota: "617", horaInicio: "07:30" });
  const d = novo({ atividade: "D", frota: "999", prioridade: "alta" });
  assert.deepEqual([a, b, c, d].sort(D.ordemDoDia).map(i => i.atividade), ["C", "B", "D", "A"]);
});

test("busca sem acento, por pedaços", () => {
  D.apagarTudo();
  const it = novo({ frota: "617", atividade: "Levar à oficina", onde: "Mossoró", responsavel: "João" });
  assert.ok(D.casaBusca(it, "617"));
  assert.ok(D.casaBusca(it, "oficina mossoro"));
  assert.ok(D.casaBusca(it, "JOAO"));
  assert.ok(!D.casaBusca(it, "natal"));
});

test("excluir e desfazer devolvem ao mesmo lugar", () => {
  D.apagarTudo();
  const [a, b, c] = [novo({ atividade: "a" }), novo({ atividade: "b" }), novo({ atividade: "c" })];
  const guardado = D.excluir(b.id);
  assert.deepEqual(D.todos().map(i => i.id), [a.id, c.id]);
  D.devolver(guardado);
  assert.deepEqual(D.todos().map(i => i.id), [a.id, b.id, c.id]);
});

test("backup: baixar, juntar, substituir e ignorar o incompleto", () => {
  D.apagarTudo();
  const a = novo({ atividade: "a" });
  D.concluir(a.id, "2026-10-21", "Outra prioridade");
  const copia = D.backup();

  D.apagarTudo();
  novo({ atividade: "local" });
  const r = D.restaurarBackup(copia);
  assert.deepEqual(r, { novos: 1, atualizados: 0, ignorados: 0, mobNovas: 0, mobAtualizadas: 0, mobIgnoradas: 0 });
  assert.equal(D.todos().length, 2);
  const volta = D.porId(a.id);
  assert.equal(volta.concluidaEm, "2026-10-21");
  assert.equal(volta.motivoAtraso, "Outra prioridade");
  assert.equal(volta.historico.length, a.historico.length);

  assert.equal(D.restaurarBackup(copia).atualizados, 1, "o mesmo id atualiza");

  const lixo = JSON.stringify({ itens: [{ atividade: "", data: "x" }, { atividade: "ok", data: "2026-10-01", status: "inventado" }] });
  const r2 = D.restaurarBackup(lixo, true);
  assert.deepEqual(r2, { novos: 1, atualizados: 0, ignorados: 1, mobNovas: 0, mobAtualizadas: 0, mobIgnoradas: 0 });
  assert.equal(D.todos()[0].status, "programada");

  assert.throws(() => D.restaurarBackup('{"outra":"coisa"}'), /não é um backup/);
  assert.throws(() => D.restaurarBackup("não é json"), SyntaxError);
});

test("planilha CSV para o Excel", () => {
  D.apagarTudo();
  const it = novo({ frota: "617", categoria: "viagem", atividade: 'Levar "urgente"; com nota', obs: "linha 1\nlinha 2" });
  const csv = D.planilha([it], "2026-10-19");
  assert.ok(csv.startsWith("﻿Dia;Até;"));
  const linha = csv.split("\r\n")[1];
  assert.ok(linha.startsWith("20/10/2026;;;;F-617;Viagem;"));
  assert.ok(linha.includes('"Levar ""urgente""; com nota"'));
  assert.ok(linha.includes(";Programada;"));
  assert.ok(linha.endsWith('"linha 1\nlinha 2"'));
});
