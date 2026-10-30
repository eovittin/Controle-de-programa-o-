// As contas das mobilizações, sem navegador: node --test testes/*.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import * as D from "../js/dados.js";
import * as M from "../js/mobilizacoes.js";

const mob = (campos = {}) => {
  const { limpo, erros } = M.conferirMob({ nome: "Contrato Petrobras", local: "Alto do Rodrigues", inicio: "2026-10-20", ...campos });
  assert.deepEqual(erros, {});
  return M.criarMob(limpo);
};
const frota = (m, campos = {}) => {
  const { limpo, erros } = M.conferirFrota({ frota: "617", ...campos }, m);
  assert.deepEqual(erros, {});
  return M.adicionarFrota(m.id, limpo);
};

test("conferir a mobilização: nome obrigatório e datas em ordem", () => {
  assert.ok(M.conferirMob({ nome: "  " }).erros.nome);
  assert.ok(M.conferirMob({ nome: "x", inicio: "2026-10-20", fimPrevisto: "2026-10-19" }).erros.fimPrevisto);
  assert.deepEqual(M.conferirMob({ nome: "x", fimPrevisto: "2026-10-19" }).erros, {}, "fim sem início vale");
});

test("conferir a frota: frota, carga, tipo e as datas que cada situação pede", () => {
  D.apagarTudo();
  const m = mob();
  const ok = M.conferirFrota({ frota: " 617 ", carga: "  Transformador   40t ", tipo: "Prancha 04 eixos", motorista: " Zé  Carlos " }, m);
  assert.deepEqual(ok.erros, {});
  assert.equal(ok.limpo.frota, "F-617");
  assert.equal(ok.limpo.carga, "Transformador 40t");
  assert.equal(ok.limpo.motorista, "Zé Carlos");
  assert.equal(ok.limpo.situacao, "aguardando");
  assert.deepEqual(M.conferirFrota({ frota: "1", carga: 'ab12 / tubos de 6"' }).erros, {}, "carga é texto livre");
  assert.equal(M.conferirFrota({ frota: "1", carga: 'ab12 / tubos de 6"' }).limpo.carga, 'ab12 / tubos de 6"', "do jeito que foi escrita");
  assert.equal(M.conferirFrota({ frota: "1", placa: "ABC1D23" }).limpo.carga, "ABC1D23", "backup antigo: a placa vira carga");
  assert.equal(M.conferirFrota({ frota: "1", tipo: " Carreta " }).limpo.tipo, "Carreta", "tipo que saiu da lista continua");
  assert.ok(!M.TIPOS.includes("Carreta") && M.TIPOS.includes("Linha de eixo"));
  assert.ok(M.conferirFrota({ frota: "" }).erros.frota);
  assert.ok(M.conferirFrota({ frota: "1", situacao: "mobilizada" }).erros.dataMobilizacao);
  const desm = M.conferirFrota({ frota: "1", situacao: "desmobilizada", dataMobilizacao: "2026-10-20" }).erros;
  assert.ok(desm.dataDesmobilizacao && !desm.dataMobilizacao);
  assert.ok(M.conferirFrota({ frota: "1", dataMobilizacao: "2026-10-20", dataDesmobilizacao: "2026-10-19" }).erros.dataDesmobilizacao);
});

test("a mesma frota não entra duas vezes na mesma mobilização", () => {
  D.apagarTudo();
  const m = mob();
  const f = frota(m);
  assert.match(M.conferirFrota({ frota: "F-617" }, m).erros.frota, /já está nesta mobilização/);
  assert.deepEqual(M.conferirFrota({ frota: "F-617" }, m, f.id).erros, {}, "editando ela mesma vale");
});

test("situação da mobilização sai das frotas", () => {
  D.apagarTudo();
  const m = mob();
  assert.equal(M.situacaoMob(m), "vazia");
  const a = frota(m, { frota: "617" });
  const b = frota(m, { frota: "620" });
  assert.equal(M.situacaoMob(m), "planejada");
  M.editarFrota(m.id, a.id, M.conferirFrota({ ...a, situacao: "mobilizando" }).limpo);
  assert.equal(M.situacaoMob(m), "mobilizando");
  M.editarFrota(m.id, a.id, M.conferirFrota({ ...a, situacao: "mobilizada", dataMobilizacao: "2026-10-21" }).limpo);
  assert.equal(M.situacaoMob(m), "ativa");
  assert.deepEqual(M.contas(m), { mobilizada: 1, aguardando: 1 });
  for (const f of [a, b]) {
    M.editarFrota(m.id, f.id, M.conferirFrota({ ...f, situacao: "desmobilizada", dataMobilizacao: "2026-10-21", dataDesmobilizacao: "2026-11-30" }).limpo);
  }
  assert.equal(M.situacaoMob(m), "encerrada");
});

test("atrasada: passou do dia previsto e não chegou", () => {
  const f = { situacao: "aguardando", dataMobilizacao: "2026-10-20" };
  assert.ok(!M.atrasada(f, "2026-10-20"));
  assert.ok(M.atrasada(f, "2026-10-21"));
  assert.ok(M.atrasada({ ...f, situacao: "mobilizando" }, "2026-10-21"));
  assert.ok(!M.atrasada({ ...f, situacao: "mobilizada" }, "2026-10-21"));
  assert.ok(!M.atrasada({ situacao: "aguardando", dataMobilizacao: "" }, "2026-10-21"), "sem data, sem atraso");
});

test("histórico: adicionar, trocar de situação, editar e remover", () => {
  D.apagarTudo();
  const m = mob();
  const f = frota(m, { carga: "Tubos" });
  M.editarFrota(m.id, f.id, M.conferirFrota({ ...f, situacao: "mobilizada", dataMobilizacao: "2026-10-22" }).limpo);
  M.editarFrota(m.id, f.id, M.conferirFrota({ ...f, motorista: "Zé" }).limpo);
  const guardada = M.removerFrota(m.id, f.id);
  assert.equal(m.frotas.length, 0);
  M.devolverFrota(guardada);
  assert.equal(m.frotas[0].id, f.id);
  assert.deepEqual(m.historico.map(h => h.texto), [
    "Mobilização criada",
    "F-617 adicionada — aguardando",
    "F-617: aguardando → mobilizada em 22/10",
    "F-617 editada: motorista",
    "F-617 removida",
    "F-617 voltou (remoção desfeita)",
  ]);
});

test("frota em outra mobilização e o tipo já conhecido", () => {
  D.apagarTudo();
  const a = mob({ nome: "Contrato A" });
  const b = mob({ nome: "Contrato B" });
  const f = frota(a, { carga: "Tubos", tipo: "Cavalo mecânico" });
  assert.equal(M.emOutra("F-617", b.id).m.id, a.id);
  assert.equal(M.emOutra("F-617", a.id), null, "na própria não conta");
  assert.deepEqual(M.conhecida("F-617"), { tipo: "Cavalo mecânico" });
  M.editarFrota(a.id, f.id, M.conferirFrota({ ...f, situacao: "desmobilizada", dataMobilizacao: "2026-10-20", dataDesmobilizacao: "2026-10-25" }).limpo);
  assert.equal(M.emOutra("F-617", b.id), null, "desmobilizada está livre");
});

test("excluir a mobilização e desfazer", () => {
  D.apagarTudo();
  const a = mob({ nome: "A" }), b = mob({ nome: "B" });
  frota(a);
  const guardada = M.excluirMob(a.id);
  assert.deepEqual(M.todas().map(m => m.nome), ["B"]);
  M.devolverMob(guardada);
  assert.deepEqual(M.todas().map(m => m.nome), ["A", "B"]);
  assert.equal(M.porId(a.id).frotas.length, 1);
  assert.ok(b);
});

test("backup leva as mobilizações; backup antigo não mexe nelas", () => {
  D.apagarTudo();
  const m = mob();
  frota(m, { carga: "Transformador" });
  const copia = D.backup();

  D.apagarTudo();
  const r = D.restaurarBackup(copia);
  assert.equal(r.mobNovas, 1);
  assert.equal(M.todas()[0].frotas[0].carga, "Transformador");
  assert.equal(M.todas()[0].historico.length, 2);
  assert.equal(D.restaurarBackup(copia).mobAtualizadas, 1);

  // um backup de antes das mobilizações, mesmo substituindo, deixa elas como estão
  D.restaurarBackup(JSON.stringify({ itens: [] }), true);
  assert.equal(M.todas().length, 1);

  // o que não passa na conferência fica de fora
  const ruim = JSON.stringify({ itens: [], mobilizacoes: [{ nome: "" }, { nome: "Boa", frotas: [{ frota: "" }, { frota: "9", dataMobilizacao: "ontem" }, { frota: "10" }] }] });
  const r2 = D.restaurarBackup(ruim, true);
  assert.equal(r2.mobIgnoradas, 1);
  assert.equal(M.todas().length, 1);
  assert.deepEqual(M.todas()[0].frotas.map(f => f.frota), ["F-10"]);
});

test("a frota guardada com placa passa a ter carga", () => {
  const m = M.atualizar({ id: "a", nome: "x", frotas: [{ frota: "F-1", placa: "ABC1D23" }, { frota: "F-2", carga: "Tubos" }] });
  assert.deepEqual(m.frotas, [{ frota: "F-1", carga: "ABC1D23" }, { frota: "F-2", carga: "Tubos" }]);
});

test("carregar ignora mobilização ilegível", () => {
  assert.ok(M.legivel({ id: "a", nome: "x", frotas: [] }));
  assert.ok(!M.legivel({ id: "a", nome: "x" }));
  assert.ok(!M.legivel(null));
});

test("planilha das mobilizações: uma linha por frota", () => {
  D.apagarTudo();
  const m = mob({ nome: "Contrato; com ponto e vírgula" });
  frota(m, { frota: "617", carga: "Transformador 40t", tipo: "Prancha 06 eixos com dolly", motorista: "Zé", dataMobilizacao: "2026-10-20" });
  frota(m, { frota: "620" });
  mob({ nome: "Vazia" });
  const linhas = M.planilha(M.todas(), "2026-10-25").split("\r\n");
  assert.ok(linhas[0].startsWith("﻿Mobilização;Local;"));
  assert.equal(linhas.length, 4);
  assert.equal(linhas[1], '"Contrato; com ponto e vírgula";Alto do Rodrigues;20/10/2026;;Planejada;F-617;Transformador 40t;Prancha 06 eixos com dolly;Zé;Aguardando;20/10/2026;;Sim');
  assert.ok(linhas[3].startsWith("Vazia;Alto do Rodrigues;20/10/2026;;Sem frotas;;"));
});
