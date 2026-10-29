// Deixa o site abrir sem internet depois da primeira visita.
//
// Responde com a cópia guardada (rápido e funciona offline) e, ao mesmo
// tempo, busca a versão nova para a próxima vez. Mudou a lista de arquivos?
// Acrescente aqui e suba a VERSAO.

const VERSAO = "v3";
const ARQUIVOS = [
  "./", "index.html", "manifest.json", "logo.svg", "css/estilo.css",
  "js/app.js", "js/armazem.js", "js/caixas.js", "js/comum.js", "js/dados.js", "js/estado.js", "js/mobilizacoes.js",
  "js/tela-mobilizacoes.js", "js/telas.js", "js/ui.js", "js/util.js",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(nomes => Promise.all(nomes.filter(n => n !== VERSAO).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const pedido = e.request;
  if (pedido.method !== "GET" || new URL(pedido.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSAO).then(async cache => {
    const guardada = await cache.match(pedido, { ignoreSearch: true });
    const nova = fetch(pedido).then(r => {
      if (r.ok) cache.put(pedido, r.clone());
      return r;
    }).catch(() => guardada);
    if (guardada) { e.waitUntil(nova); return guardada; }
    return nova;
  }));
});
