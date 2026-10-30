// O link que leva os dados de um aparelho para outro: node --test testes/*.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { textoParaLink, linkParaTexto } from "../js/util.js";
import * as D from "../js/dados.js";
import * as M from "../js/mobilizacoes.js";

test("o texto vai e volta igual, com acento", async () => {
  const texto = "Programação: F-617 → Natal, \"carga\" de 40t; ção ã é ü 😀";
  const codigo = await textoParaLink(texto);
  assert.match(codigo, /^1[\w-]+$/, "só caracteres que não estragam um endereço");
  assert.equal(await linkParaTexto(codigo), texto);
});

test("sem compressão (navegador antigo) também abre", async () => {
  const codigo = "0" + Buffer.from("olá, mundo").toString("base64url");
  assert.equal(await linkParaTexto(codigo), "olá, mundo");
});

test("link estragado é recusado", async () => {
  await assert.rejects(linkParaTexto("9abc"));
  await assert.rejects(linkParaTexto("1" + Buffer.from("não é deflate").toString("base64url")));
});

test("o backup inteiro passa pelo link e junta no outro aparelho", async () => {
  D.apagarTudo();
  for (let i = 0; i < 200; i++) {
    const { limpo } = D.conferir({ frota: String(600 + i), atividade: `Viagem ${i} para Natal com carga de sal`, data: "2026-10-29" });
    D.criar(limpo);
  }
  const m = M.criarMob(M.conferirMob({ nome: "Contrato Petrobras" }).limpo);
  M.adicionarFrota(m.id, M.conferirFrota({ frota: "617", carga: "Transformador" }).limpo);
  const backup = D.backup();
  const codigo = await textoParaLink(backup);
  assert.ok(codigo.length < backup.length / 4, `comprime bem (${codigo.length} de ${backup.length})`);
  assert.ok(codigo.length < 60000, "200 programações cabem numa mensagem");

  // o outro aparelho, com uma programação dele
  D.apagarTudo();
  D.criar(D.conferir({ atividade: "Já estava aqui", data: "2026-10-30" }).limpo);
  const r = D.restaurarBackup(await linkParaTexto(codigo), false);
  assert.equal(r.novos, 200);
  assert.equal(r.mobNovas, 1);
  assert.equal(D.todos().length, 201, "nada daqui foi apagado");
  assert.equal(M.todas()[0].frotas[0].carga, "Transformador");
});
