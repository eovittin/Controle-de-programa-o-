# Programação da Operação

**Abrir o site: https://eovittin.github.io/Controle-de-programa-o-/**

Agenda de programação da operação: o que cada frota faz, em que dia e hora,
quem faz, e o que atrasou. É um site estático, que roda inteiro no navegador
e é publicado pelo GitHub Pages. Não precisa de servidor nem de conta em nada.

O visual segue o da agenda do site [gestaomkt](https://zodkaps.github.io/gestaomkt/#/movimentacoes):
menu lateral azul-marinho, cartões brancos e cada item como uma etiqueta
colorida no seu dia.

## As telas

| tela | o que mostra |
|---|---|
| **Agenda** | O mês em calendário, cada programação no seu dia, na cor da situação. Ao lado: o dia tocado (Hoje, de início), as **atrasadas** com Concluir e Remarcar, e o **resumo do mês** num anel (feitas no prazo, com atraso, atrasadas, a fazer). No celular, cada etiqueta vira um ponto e o dia tocado aparece embaixo. |
| **Semana** | Segunda a domingo em colunas, cada dia na ordem da hora. O **+** de cada coluna programa naquele dia. Dá para imprimir. |
| **Lista** | Tudo em lista, separado por dia, com filtro de período e de situação. **Excel** baixa o que está na tela em `.csv`. |
| **Mobilizações** (Gestão) | Cada contrato, cliente ou obra para onde vão frotas, com as frotas dentro. Ver [Mobilizações](#mobilizações). |
| **Dados e backup** | Baixar e restaurar o backup, exportar para o Excel e apagar tudo. |

Em todas: a **busca** (frota, o que fazer, onde, responsável — sem precisar de
acento) e o filtro de **categoria**. O **+ Nova** fica no alto; a tecla **N**
também abre.

## Uma programação

- **Frota** — "617" vira "F-617" sozinho.
- **Categoria** — Viagem, Carregamento, Entrega / descarga, Levar à oficina,
  Lavagem, TOP / inspeção, Abastecimento, Documentação, Outros.
- **O que fazer** (obrigatório), **Onde**, **Responsável**, **Prioridade**
  (Alta, Média, Baixa) e **Observações**.
- **Dia** (obrigatório) e, se durar mais de um dia, **Até o dia** — a viagem de
  três dias aparece nos três.
- **Das / Às** — o horário, opcional.
- **Repetir** (só na nova) — todo dia, dias úteis ou toda semana, até uma
  data. Cada repetição vira uma programação própria (no máximo 120 de uma vez).

Os campos de texto sugerem o que já foi digitado antes.

### As situações

A situação é calculada pela data — ninguém precisa marcar "atrasada".

| situação | quando |
|---|---|
| Programada | o dia ainda não chegou |
| Para hoje | é hoje (ou está dentro do "até") |
| Em andamento | alguém tocou em **Iniciar** |
| Atrasada | passou do último dia e não foi concluída |
| Concluída | concluída até o último dia |
| Concluída com atraso | concluída depois do último dia |
| Cancelada | cancelada, com o motivo; não conta como feita nem como atrasada |

### O que fica registrado

- **Concluir depois do prazo pede o porquê** (outra prioridade, frota em
  viagem, sem motorista, esperando carga ou cliente, problema mecânico, clima
  ou estrada, fornecedor ou terceiro, ou outro motivo escrito).
- **Mudar o dia é remarcação e pede o motivo.** A ficha mostra quantas vezes
  foi remarcada e qual era a data original.
- **Cancelar pede o motivo**, e dá para desfazer.
- Cada programação tem o seu **histórico**: quando foi criada, iniciada,
  concluída, remarcada, editada (e o que mudou), cancelada.
- **Excluir** apaga de vez, mas o aviso no pé da tela tem **Desfazer** por
  alguns segundos.

## Mobilizações

Em **Gestão → Mobilizações**. Uma mobilização é um contrato, cliente ou obra
para onde a operação manda frotas: tem **nome** (obrigatório), **local**,
**início**, **fim previsto** e observações. O **+ Nova mobilização** fica no
alto da tela; ao criar, a caixa de adicionar frota já abre.

Dentro de cada mobilização, **+ Adicionar frota**:

- **Frota** (obrigatória — "617" vira "F-617") e **carga** (o que ela leva,
  escrito livre; sugere as cargas já digitadas). A frota que já foi mobilizada
  antes traz o tipo sozinha.
- **Tipo de veículo** — Cavalo mecânico, Bitrem, Prancha 04 eixos, Prancha 04
  eixos com dolly, Prancha 05 eixos, Prancha 06 eixos, Prancha 06 eixos com
  dolly, Linha de eixo, Carga seca, Veículo leve, Outro. A frota cadastrada
  com um tipo que saiu da lista continua com ele (aparece como *tipo antigo*)
  até alguém escolher outro.
- **Motorista**.
- **Situação** — Aguardando, Em mobilização, Mobilizada, Desmobilizada.
- **Datas** — a de mobilização e a de desmobilização. Enquanto não aconteceu,
  é previsão; **Mobilizada** pede o dia em que chegou, e **Desmobilizada**, o
  dia em que saiu.

**Adicionar e outra** grava e abre a caixa de novo, já com a situação e as
datas da anterior — para cadastrar várias frotas seguidas.

Cada frota tem **um botão com o próximo passo**: *Iniciar mobilização* (vale
na hora), *Chegou* e *Desmobilizar* (abrem a caixa com a data de hoje, para
conferir). Tocar na frota abre para editar ou **remover da mobilização** (com
*Desfazer*).

- A mesma frota **não entra duas vezes** na mesma mobilização. Se ela está
  ativa em **outra** mobilização, o site avisa onde; tocar de novo grava
  mesmo assim (pode ser troca de contrato).
- Frota **atrasada**: passou o dia previsto de mobilização e ela ainda não
  chegou. Aparece em vermelho, entra no número do alto e no contador ao lado
  de *Mobilizações* no menu.
- A **situação da mobilização** sai das frotas: Sem frotas, Planejada,
  Mobilizando, Ativa ou Encerrada (todas desmobilizadas).
- No alto, os números: mobilizações em andamento, frotas mobilizadas, em
  mobilização, aguardando e atrasadas. A busca acha mobilização, frota, carga
  e motorista; o filtro mostra as em andamento, as encerradas ou todas;
  **Excel** baixa a lista com uma linha por frota.
- Tudo o que muda fica no **histórico** da mobilização (em *Editar*):
  frota adicionada, troca de situação com a data, edição, remoção.

## Onde ficam os dados

Tudo fica **no navegador de quem usa** (`localStorage`). Ninguém mais vê, e
nada vai para a internet. Por isso:

- **cada aparelho tem a sua programação** — para passar de um para outro, use
  *Dados e backup → Baixar backup* num e *Restaurar backup* no outro;
- **limpar os dados do navegador apaga a programação e as mobilizações** —
  baixe o backup de vez em quando;
- em janela anônima o navegador não guarda (o site avisa).

O backup é um arquivo `.json`, com as programações e as mobilizações.
*Restaurar (juntar)* acrescenta o que não existe e atualiza o que já existe;
*Restaurar (substituir tudo)* troca tudo pelo que está no arquivo (um backup
de antes das mobilizações não mexe nelas).

Depois da primeira visita o site abre **sem internet** (`sw.js`), e no celular
dá para instalá-lo na tela inicial ("Adicionar à tela de início").

## Publicação (GitHub Pages)

O site é publicado pelo GitHub Pages a partir da branch **`main`**, pasta
**`/ (root)`** (em **Settings → Pages**), no endereço
https://eovittin.github.io/Controle-de-programa-o-/.

Cada mudança enviada para a `main` publica de novo sozinha, em um ou dois
minutos.

## Mudar as listas

As categorias, as prioridades e os motivos prontos ficam no começo de
[`js/dados.js`](js/dados.js) (`CATEGORIAS`, `PRIORIDADES`, `MOTIVOS_ATRASO`,
`MOTIVOS_REMARCAR`). Para trocar uma categoria de nome, mude só o `nome` — o
`id` é o que fica guardado nas programações que já existem. Os tipos de
veículo das mobilizações ficam em `TIPOS`, no começo de
[`js/mobilizacoes.js`](js/mobilizacoes.js).

## Os arquivos

| arquivo | o que é |
|---|---|
| `index.html` | a página: menu, topo e a barra de baixo do celular |
| `css/estilo.css` | o visual, claro e escuro, computador, celular e impressão |
| `js/app.js` | o começo: escolhe a tela pelo endereço (`#/agenda`, `#/semana`, `#/lista`, `#/mobilizacoes`, `#/dados`), tema e atalhos |
| `js/armazem.js` | onde tudo fica guardado no navegador |
| `js/dados.js` | as programações: situações, conferir o formulário, remarcar, concluir; e o backup e o CSV |
| `js/mobilizacoes.js` | as mobilizações e as frotas delas: situações, conferir, histórico, backup e CSV |
| `js/telas.js` | Agenda, Semana, Lista e Dados |
| `js/tela-mobilizacoes.js` | a tela Mobilizações e as caixas de mobilização e de frota |
| `js/caixas.js` | as caixas: nova/editar, ficha, concluir, cancelar, confirmar |
| `js/comum.js` | o que as telas dividem: filtros e a linha de um item |
| `js/estado.js` | o que a tela está mostrando (mês, dia, filtros) |
| `js/ui.js`, `js/util.js` | ícones, avisos, datas |
| `sw.js` | deixa o site abrir sem internet |
| `testes/*.test.mjs` | os testes das contas (programações e mobilizações) |

Mudou algum arquivo do site? Suba a `VERSAO` em `sw.js` (e, se criou arquivo
novo, acrescente-o na lista), senão quem já abriu pode ver a versão antiga até
recarregar duas vezes.

## Testes

```bash
node --test testes/*.test.mjs
```

Para ver o site no computador antes de publicar:

```bash
python3 -m http.server 8000   # e abrir http://localhost:8000
```
