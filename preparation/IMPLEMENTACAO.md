# Site administrativo Casinha Azul

Implementação inicial em 12/11/2026, baseada em `Casinha_Azul_website.pptx` e nas decisões do projeto. As referências ficam em `preparation/`; aplicação, testes e arquivos públicos ficam na raiz.

## Executar no computador

Requisito: Node.js 24 LTS com npm. Na raiz do projeto:

```powershell
npm ci
npm run demo
```

Abra **http://127.0.0.1:3000**. O modo de demonstração usa dados em memória, identificados na interface, e não conecta ao MongoDB. Cadastros e alterações desse modo são perdidos ao reiniciar. O catálogo de demonstração foi extraído da planilha; estoque, comandas, nomes e recebimentos são exemplos.

Para trabalhar com o banco configurado no `.env`:

```powershell
npm run db:check
npm run db:prepare
npm start
```

`db:prepare` cria as coleções necessárias e seus índices, sem inserir registros comerciais. Execute antes de permitir cadastros, pois os índices únicos impedem códigos e ISBN/condição duplicados. Não apaga nem renomeia coleções existentes. A coleção antiga `cantina_diversos`, se existir, permanece intacta; os novos produtos usam `cantina_produtos`.

`npm start` usa `DATA_MODE` do ambiente; quando não definido, usa MongoDB se houver `MONGODB_URI`, ou demonstração se a URI não estiver configurada. `npm run demo` sempre força demonstração. Não existe troca silenciosa para dados de exemplo quando o MongoDB falha. Para desenvolvimento com reinício automático, use `npm run dev`.

O servidor local fica restrito a `127.0.0.1` por padrão. Para expor à rede, configurar `HOST` e as restrições de acesso do ambiente. Não há login individual, conforme a definição desta etapa.

## Configuração

Use `.env.example` como referência; não sobrescreva o `.env` existente.

| Variável | Uso |
| --- | --- |
| `MONGODB_URI` | Conexão, banco e autenticação técnica MongoDB. O nome desejado é `cantina_casinha_Azul`; `authSource` é o banco onde o usuário foi criado. |
| `DATA_MODE` | `mongodb` ou `demo`. |
| `PORT` | Porta HTTP, padrão 3000. |
| `HOST` | Padrão local `127.0.0.1`; em produção, `0.0.0.0`. |
| `APP_SECRET` | Segredo persistente de pelo menos 32 caracteres, obrigatório em produção, para formulários e prévias assinadas. Não é senha de usuário. |
| `NODE_ENV` | `production` habilita cookies seguros e configuração de proxy para HTTPS. |

As variáveis configuradas no ambiente têm prioridade sobre o `.env`. Segredos não vão para o código, HTML, logs ou repositório. Em desenvolvimento, sem `APP_SECRET`, uma chave temporária é gerada por execução: atualizar a página após reiniciar o servidor renova os formulários.

## Importar o catálogo

`src/data/catalog.json` é um retrato de referência da planilha na data da implementação. Não contém saldo real de estoque. Para conferir os registros sem acessar o banco:

```powershell
npm run catalog:import
```

Para inserir somente os cadastros ausentes no MongoDB, depois de preparar os índices:

```powershell
npm run catalog:import -- --apply
```

O comando com `--apply` grava no banco: estoque inicial zero, sem modificar preços ou saldos de registros já existentes. Não migra automaticamente dados de outras coleções ou formatos. Antes de importar novamente uma planilha alterada, atualizar e conferir o retrato JSON. A atualização da fonte não é automática.

## Funcionalidades

- Início com recebimentos por forma de pagamento, comandas abertas, alertas de estoque, acervo e histórico dos últimos sete dias.
- Catálogo com busca, filtros, paginação, cadastro, edição, desativação e reativação.
- Livros novos/usados com estoque separado por ISBN e condição. Usados sempre com custo zero e venda de R$ 10,00, validados também no servidor.
- Estoque com entrada, saída e correção de contagem, motivo obrigatório, prevenção de saldo negativo e histórico.
- Reajuste percentual com prévia assinada, validade de 15 minutos, confirmação, histórico e detecção de alterações concorrentes. Usados, custos e preços históricos das comandas ficam preservados.
- Consulta de comandas abertas/pagas por número, nome opcional, pagamento e período; detalhe com itens e preços registrados. Não altera ou cobra comandas pelo navegador.
- Relatórios de produtos lançados, recebimentos, livros, doações, rifas, bazar, estoque mínimo e itens sem vendas há 60 dias. Livraria com período, acumulados e faixas sem sobreposição. Exportação CSV e impressão.
- Cadastro de voluntários sem criar contas de acesso, kits com componentes e campanhas com tipo, período e meta.
- Sincronização mostra somente registros disponíveis no servidor; não presume que a Clover está online.
- Logo no canto superior esquerdo, menu no cabeçalho e rodapé com marca e link `mailto:hiratabruno@yahoo.com` em “desenvolvido por Nebule Tech Consulting”. O link abre o programa de e-mail; não envia uma mensagem automaticamente.
- Layout responsivo, navegação por teclado, foco visível, campos rotulados e preferência de letras ampliadas guardada somente no navegador.

Em relatórios de itens, a data é a do lançamento; nos recebimentos, a data é a do pagamento. Dias e horários são apresentados em `America/Sao_Paulo`. Valores monetários são armazenados como centavos inteiros. Prazos de 30/60/90/180/365 dias são relativos à data final selecionada. O relatório geral de itens parados considera também a data de cadastro; a visão “sem vendas” da livraria inclui cadastros novos sem lançamentos e informa essa distinção.

## Arquitetura e manutenção

Aplicação única, sem etapa de compilação do frontend: **Express + EJS**, JavaScript de aprimoramento progressivo e CSS próprio. Mongoose encapsula a persistência. Zod valida entradas. Helmet, cookies de formulário, CSRF e escape de HTML protegem o transporte das ações no navegador. Não há dependência de CDN ou fontes externas para a interface.

```text
src/
  app.js            Rotas HTTP, composição das páginas e erros
  server.js         Inicialização e encerramento do processo
  config.js         Variáveis de ambiente
  domain.js         Validação, dinheiro, datas e regras compartilhadas
  services.js       Operações de catálogo, estoque e reajuste
  reports.js        Cálculos dos relatórios e do painel
  security.js       Formulários CSRF e prévias assinadas
  data/             Modelos, repositórios MongoDB/memória e dados demonstrativos
  views/            Páginas e componentes EJS
public/             CSS, JavaScript do navegador e logo
scripts/            Preparação do banco, importação e demonstração
test/               Testes HTTP e regras de negócio
```

Coleções: `cantina_produtos`, `cantina_livros`, `cantina_comandas`, `cantina_movimentacoes_estoque`, `cantina_alteracoes_precos`, `cantina_voluntarios`, `cantina_kits`, `cantina_campanhas` e `cantina_dispositivos`.

O campo `version` permite detectar edições concorrentes. Movimentação de estoque e reajustes usam transações para salvar os saldos e o histórico juntos. É necessário **MongoDB replica set ou Atlas**; em servidor standalone, essas ações falham explicitamente sem gravar parcialmente. A configuração consultada durante a implementação informou replica set, mas operações de escrita no banco real não foram executadas para os testes.

## Verificação

```powershell
npm run check
npm test
```

Os testes usam armazenamento isolado em memória, servidor HTTP temporário e as mesmas rotas e serviços da aplicação. Não consultam o `.env` nem escrevem no banco real. Cobrem renderização com e sem dados, CSRF, cadastro, centavos, livros usados, duplicações, estoque, histórico, conflitos e recebimentos. As páginas principais também foram consultadas com MongoDB, somente para leitura. A ferramenta de navegador não conseguiu abrir a prévia nesta sessão; a avaliação visual e de toque com os voluntários continua necessária.

## Render

`render.yaml` prepara um webservice Node.js com instalação `npm ci --omit=dev`, inicialização `npm start`, variável `PORT` fornecida pelo Render e verificação `/health`. Configurar `MONGODB_URI` no painel do serviço e manter o `APP_SECRET` gerado. Escolher região e plano conforme o uso. Preparar coleções/índices e conferir a rede a partir do ambiente de hospedagem antes da utilização.

Nenhum serviço foi publicado durante esta implementação. Como não há autenticação individual, usar ambiente de demonstração ou acesso restrito antes de disponibilizar dados reais. CSRF e HTTPS não substituem controle de acesso. As permissões técnicas do banco são independentes do login dos voluntários.

## Etapas que continuam separadas

- Aplicativo Android/Clover, armazenamento offline, protocolo autenticado de sincronização e integração oficial de pagamentos.
- Envio automático ou em lote de WhatsApp/e-mail. O detalhe de uma comanda com telefone permite apenas abrir um rascunho no WhatsApp, para confirmação manual.
- Sorteio de rifas, gestão de números individuais e associação dos lançamentos às campanhas pela futura integração. As campanhas existentes mostram arrecadação somente quando há itens vinculados.
- Venda de kits com baixa automática dos componentes; o cadastro atual guarda a composição, sem movimentar estoque.
- Backup, restauração, política de acesso ao ambiente e validação com os voluntários.

Referências: [Express](https://expressjs.com/en/5x/guide/error-handling/), [Mongoose](https://mongoosejs.com/docs/transactions.html) e [Render](https://render.com/docs/deploy-node-express-app).
