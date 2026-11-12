# Casinha Azul — Sistema de comandas

Premissas do projeto da cantina e livraria Casinha Azul, consolidadas em 10/11/2026.

## Objetivo e estado atual

Controlar as comandas, as vendas e os recebimentos da cantina e livraria, com atendimento na Clover Flex e administração pelo navegador.

O site administrativo inicial foi implementado em 12/11/2026 com Node.js, Express, EJS e MongoDB. Consulte [IMPLEMENTACAO.md](IMPLEMENTACAO.md) para executar, configurar e verificar a aplicação e distinguir o que já funciona das integrações futuras. Ainda não há aplicativo Android instalado na Clover nem integração de pagamentos. O restante deste documento preserva as premissas e o levantamento de requisitos; propostas antigas devem ser lidas junto do estado da implementação.

### Primeiro código: teste de conexão MongoDB

Os materiais de preparação ficam em `preparation/`, separados do código na raiz. O [connect_mongodb.js](../connect_mongodb.js) é um teste de conexão, não o webservice. Ele lê `MONGODB_URI` do `.env` situado ao lado do script, independentemente da pasta em que é executado. Uma variável já configurada no ambiente tem prioridade, permitindo usar as configurações do Render sem publicar o `.env`.

Na raiz do projeto:

```powershell
npm ci
npm run db:check
```

Se ainda não houver `.env`, usar o [exemplo](../.env.example) como referência e preencher a conexão real localmente. Preservar o arquivo existente. O `.env` é ignorado pelo Git e suas credenciais não devem ser incluídas na documentação.

O teste valida a configuração, conecta, executa `ping` e libera as conexões. Não cadastra produtos nem altera dados. Sucesso retorna código zero; configuração inválida, falha de conexão, autenticação ou encerramento retornam código um. Este teste não comprova permissões de leitura/escrita das futuras coleções nem conectividade a partir do Render.

Na execução de 12/11/2026, o servidor MongoDB respondeu com falha de autenticação. Conferir usuário, senha e `authSource` com a configuração do servidor antes de prosseguir. O `.env` existente foi preservado. A ausência de login dos voluntários não elimina a autenticação técnica do banco.

Sequência inicial recomendada:

1. Resolver a autenticação e obter sucesso no teste de conexão.
2. Definir os modelos de produtos, livros, comandas e movimentações de estoque. Para livros, a proposta é uma coleção com condição novo/usado e estoque separado por ISBN e condição.
3. Construir o serviço Node.js com configuração compartilhada de conexão, validação de dados e uma primeira consulta de catálogo.
4. Implementar o cadastro e a edição de um produto para validar um fluxo completo da administração antes de ampliar as telas.
5. Definir o contrato de sincronização com a Clover, incluindo identificadores, reenvios e preços históricos, antes de implementar gravações de comandas.
6. Preparar a publicação no Render e testar sua conexão com o MongoDB a partir desse ambiente, preservando as decisões de acesso sem login individual nesta etapa.

O desenvolvimento deve contar com apoio tanto na organização do produto quanto nas decisões técnicas. O responsável pelo projeto conhece a rotina da Casinha Azul e está começando no desenvolvimento Android/Clover. As escolhas devem ser explicadas em linguagem simples, com recomendações e consequências claras.

## Fontes de referência

- [CONTEXTO_CASINHA_AZUL.txt](CONTEXTO_CASINHA_AZUL.txt): resumo do contexto anterior.
- [conversa_casinha_azul.txt](conversa_casinha_azul.txt): histórico anterior das decisões e propostas.
- [tabela_precos.xlsx](tabela_precos.xlsx): fonte do catálogo de produtos e livros novos, dos códigos e dos preços.
- [Comanda_Casinha_Azul.jpeg](Comanda_Casinha_Azul.jpeg): referência do formulário utilizado em papel.

Este README incorpora também as definições posteriores ao histórico exportado. Novas decisões explícitas do responsável pelo projeto prevalecem sobre propostas anteriores. Não inventar preços nem substituir regras confirmadas por suposições de implementação.

## Acessibilidade e simplicidade

Os atendentes são voluntários, em geral aposentados, alguns com dificuldade de visão. A acessibilidade visual e a facilidade de uso são requisitos centrais.

As telas devem oferecer:

- Letras grandes, com tamanho ajustável.
- Contraste forte, preferencialmente texto escuro sobre fundo claro.
- Botões grandes e espaçados, adequados ao toque.
- Ícones acompanhados de palavras, sem ações representadas apenas por símbolos.
- Poucas opções por tela e navegação simples.
- Número e total da comanda claramente visíveis durante o atendimento, junto do nome quando informado.
- Quantidades e preços destacados, com controles claros para corrigir itens.
- Mensagens simples que expliquem o resultado de uma ação e como corrigir problemas.
- Estados descritos por texto, como “Aberta” e “Paga”, além das cores.
- Indicação legível da conexão e da sincronização.

A interface deverá ser validada com os voluntários e na tela física da Clover. Uma demonstração ampliada no computador não comprova a legibilidade ou a facilidade de toque no aparelho.

Referência inicial para o desenho dos fluxos: tela vertical de 720 × 1440 pixels, sujeita à confirmação da geração do aparelho. Fundo branco (`#FFFFFF`), texto principal escuro (`#1F2937`), botões principais azul-escuro (`#123B64`) com texto branco. Quantidade, nome e valor devem ser reconhecidos como campos de preenchimento, visualmente distintos dos botões de ação. A resolução em pixels não determina diretamente o tamanho dos componentes Android; validar a escala física e a ampliação das letras.

### Fluxo de referência do atendimento

O [Fluxo_Cantina_Revisado.pptx](Fluxo_Cantina_Revisado.pptx) contém a revisão do desenho de referência em evolução, com nome opcional e os ajustes de conferência e recebimento. O [Fluxo_Cantina.pptx](Fluxo_Cantina.pptx) foi preservado, pois estava aberto e bloqueado para gravação durante a revisão. Os exemplos de pessoas e comandas servem para demonstrar as telas.

1. Abrir a comanda com número obrigatório e nome opcional, permitindo continuar sem nome.
2. Selecionar produtos, informar quantidade e conferir preço unitário e subtotal. Confirmar cada inclusão uma única vez antes de navegar.
3. Conferir itens, quantidades e total; permitir corrigir quantidades e remover lançamentos antes de receber.
4. Deixar a comanda aberta e retornar ao início, ou seguir para escolher a forma de pagamento.
5. Confirmar o recebimento antes de marcar a comanda como paga e voltar ao início. Apenas escolher a forma de pagamento não confirma o recebimento.
6. Retomar comandas abertas pelo número ou pelo nome quando informado, mostrando o número e o total ao selecionar a comanda.

Na rifa, o fluxo proposto usa quantidade de números e valor unitário informado no atendimento; o total é calculado. Na sincronização, exibir apenas o estado atual e distinguir dados salvos localmente de dados já enviados. As regras detalhadas de edição e cancelamento ainda deverão ser validadas no protótipo.

## Rotina de atendimento e comandas

- Toda comanda deve ter número. O nome é opcional.
- Para os voluntários, informar o nome facilita localizar a comanda ao acrescentar pedidos ou pagar ao final dos trabalhos. Isso não torna o nome obrigatório.
- Para os assistidos, a comanda pode ser identificada somente pelo número, sem exigir nome ou usar um nome fictício para preencher o campo.
- A busca por número deve funcionar para todas as comandas; a busca por nome considera apenas aquelas em que ele foi informado.
- No balcão, a pessoa pede os produtos; a atendente registra os itens, confere o total, registra a forma de pagamento e realiza a cobrança na máquina ou recebe em dinheiro.
- Trabalhadores podem manter uma comanda aberta, acrescentar pedidos durante o dia e pagar ao final dos trabalhos.
- O sistema deverá atender tanto ao pagamento imediato quanto às comandas que permanecem abertas.

A foto do formulário contém data, produtos, quantidade, valor, livros novos por código, livros usados, bazar, rifa, mensalidade/doação, total e forma de pagamento. O formulário em papel é referência da rotina; sua disposição não precisa ser reproduzida literalmente na tela pequena.

## Catálogo e preços

### Produtos comuns

- Os códigos atuais são internos e independentes do fornecedor.
- A relação com fornecedores poderá evoluir futuramente. O modelo desse cadastro ainda não foi definido.
- Usar a coluna `preco final` para cobrança. A coluna `preco compra` representa custo e não deve ser usada como preço de venda.

Na conferência de 10/11/2026, a planilha continha 65 itens: 47 produtos e 18 livros novos. Não foram encontrados códigos duplicados nem preços finais ausentes ou zerados. A quantidade de itens poderá mudar com futuras atualizações da fonte.

Correções já confirmadas e presentes na planilha:

| Código | Produto | Preço de venda |
| --- | --- | --- |
| 100167 | Chá gelado limão | R$ 8,00 |
| 100168 | Chá gelado pêssego | R$ 8,00 |
| 100196 | Água de coco | R$ 8,00 |

O custo da água de coco é R$ 2,00. Para os demais produtos e livros novos, consultar a planilha; esta tabela não substitui o catálogo.

### Livros novos

- Estão descritos na `tabela_precos.xlsx`.
- Usar o título, o ISBN de 13 dígitos e os preços informados na planilha.
- Usar o preço final de cada livro para a venda; não aplicar o preço fixo dos usados aos novos.
- Nenhum dos livros dessa planilha foi informado como usado, mesmo quando o custo registrado é zero.

### Livros usados

- Devem ter ISBN e título no cadastro.
- São recebidos por doação.
- Custo de compra: R$ 0,00.
- Preço de venda fixo: R$ 10,00.
- Não há livros usados cadastrados na planilha de referência atual.

### Valores informados no atendimento

Bazar, rifa e mensalidade/doação terão o valor preenchido na hora do lançamento.

### Preservação do histórico de preços

Cada lançamento deverá guardar o preço cobrado naquele momento. Uma atualização do catálogo não poderá alterar os preços dos itens já lançados em comandas, inclusive nas comandas abertas.

## Pagamentos

As formas definidas até o momento são:

- Dinheiro.
- Cartão de débito.
- Pix.

Crédito, pagamentos divididos, descontos, estornos e regras de cancelamento ainda não foram definidos.

Registrar a forma de pagamento no sistema é uma operação distinta de executar ou confirmar a transação financeira. A integração automática com a Clover é um objetivo futuro, sujeito à confirmação das capacidades disponíveis no Brasil, acesso aos meios oficiais, aprovações aplicáveis e testes.

Não realizar cobranças reais em demonstrações.

## Atendimento na Clover e administração no navegador

A direção definida é ter duas interfaces que compartilham os mesmos dados:

- **Clover Flex:** trabalho diário de atendimento da Casinha Azul.
- **Navegador:** administração do sistema.

Foi proposta a seguinte divisão funcional, que deverá orientar o detalhamento das telas:

| Atendimento na Clover | Administração no navegador |
| --- | --- |
| Abrir comandas com número e nome opcional | Cadastrar e atualizar produtos e preços |
| Adicionar itens e corrigir quantidades | Cadastrar livros novos e usados |
| Buscar e retomar comandas abertas | Consultar comandas abertas e pagas |
| Conferir total e registrar pagamento | Consultar relatórios e fechamento diário |

A arquitetura proposta utiliza um serviço central para guardar e compartilhar os dados, com armazenamento local na Clover para permitir o atendimento sem conexão. O serviço central será detalhado a partir da proposta de Node.js no Render e MongoDB. As tecnologias da interface administrativa e do aplicativo Clover, versões, planos de hospedagem e forma de distribuição ainda serão escolhidos.

### Serviço central: Node.js no Render e MongoDB

Proposta apresentada pelo responsável pelo projeto:

- **Node.js:** executar o webservice que recebe e valida os registros, aplica as regras de negócio e oferece os dados às duas interfaces.
- **Render:** hospedar o webservice, acessível por HTTPS.
- **MongoDB:** persistir catálogo, comandas, lançamentos, registros de recebimentos e controles necessários à sincronização.
- **MongoDB Atlas:** opção recomendada para hospedar o MongoDB como serviço gerenciado; ainda não foram escolhidos conta, região ou plano. O MongoDB não ficará instalado dentro do processo Node.js.

Fluxo proposto de comunicação:

```text
Clover Flex (dados locais + fila de sincronização) ── HTTPS ──┐
                                                           ├── Node.js no Render ── MongoDB
Administração pelo navegador ────────────────────── HTTPS ──┘
```

Somente o webservice acessará o MongoDB. A Clover e o navegador não receberão credenciais do banco nem se conectarão diretamente a ele. A conexão com o banco será configurada no ambiente do serviço, sem segredos no código ou no README. No Atlas, o acesso de rede deverá ser limitado às origens necessárias ao serviço.

O serviço será responsável por validar dados e calcular ou conferir totais, mesmo quando os clientes também exibirem esses cálculos. Valores monetários deverão ter representação exata, como centavos inteiros, para evitar erros de arredondamento.

### Acesso à administração

A administração será acessada por uma URL HTTPS no navegador, sem instalação no computador. Com conectividade e acesso autorizado pela configuração de rede, poderá ser usada no computador da Casinha Azul ou em outro local; o alcance efetivo desse acesso ainda precisa ser definido.

Como proposta inicial de implementação, o mesmo serviço Node.js poderá entregar as páginas administrativas e a API de dados, por exemplo em `/admin` e `/api`. Esses caminhos são exemplos, não endereços já publicados. Se houver necessidade futura, a interface poderá ter hospedagem separada.

Não haverá login de usuários na primeira etapa. Hospedar no Render não torna o serviço restrito à rede da Casinha Azul: se as rotas ficarem públicas e sem controle de acesso, qualquer pessoa que alcançar os endereços poderá consultar ou alterar os dados expostos. HTTPS protege o transporte, mas não limita quem acessa. O endereço não deverá ser tratado como uma senha.

Para testes públicos sem controle de acesso, usar dados fictícios. Antes de disponibilizar dados reais, definir uma restrição de rede ou de acesso ao ambiente compatível com a decisão de não exigir login individual dos voluntários. O mecanismo ainda não foi escolhido.

### Persistência, disponibilidade e sincronização

- Os dados centrais persistentes ficarão no MongoDB. Arquivos temporários ou memória do processo Node.js não serão o armazenamento definitivo das comandas.
- O sistema de arquivos padrão do Render é efêmero: reinícios e novas publicações podem descartar alterações locais. Isso não deve apagar dados já persistidos no MongoDB.
- O plano gratuito de webservice do Render pode suspender o serviço após 15 minutos sem tráfego e levar aproximadamente um minuto para reativá-lo. É uma opção para demonstração e testes; para o uso diário, avaliar um plano sem suspensão por inatividade. Plano e custos ainda não foram aprovados.
- Se o Render ou o MongoDB estiverem indisponíveis, a Clover deverá continuar guardando os lançamentos localmente. A sincronização depende de conexão e disponibilidade do serviço, e não apenas da volta da internet.
- O uso de MongoDB não implementa automaticamente a sincronização. A aplicação deverá manter a fila local de operações, controlar versões e conflitos e reconhecer operações já recebidas para evitar duplicações.
- A Clover só poderá considerar uma operação sincronizada após confirmação de persistência pelo serviço. Uma resposta perdida ou uma nova tentativa de envio não poderá gerar uma segunda venda.
- As políticas de backup e restauração do MongoDB precisam ser definidas e testadas. Uma cópia sincronizada não substitui um backup.

Referências oficiais para esta proposta, consultadas em 10/11/2026:

- [Web services no Render](https://render.com/tutorials/web-service-vs-static-site/web-services).
- [Limitações dos serviços gratuitos do Render](https://render.com/docs/free).
- [Persistência e comportamento dos serviços Render](https://render.com/docs/faq).
- [Controle de acesso de rede no MongoDB Atlas](https://www.mongodb.com/docs/atlas/security/add-ip-address-to-list/).

## Primeira etapa sem autenticação de usuários

Nesta primeira etapa, não haverá cadastro de atendentes, senha ou tela de login.

Sem autenticação, quem tiver acesso ao sistema poderá utilizar as funções disponíveis, inclusive as administrativas. Não será possível atribuir com segurança cada ação a uma pessoa identificada por login.

Foi proposto manter essa primeira versão em ambiente de testes ou com acesso restrito. A hospedagem proposta passou a ser o Render, com MongoDB separado para persistência. As condições de acesso ao ambiente e o uso com dados reais ainda precisam ser definidos, conforme a seção de serviço central; a proposta de hospedagem não autoriza publicar dados reais sem restrição de acesso.

A ausência de login de usuários não elimina eventuais credenciais técnicas necessárias à comunicação entre os componentes ou à futura integração oficial com a Clover. Essas credenciais não implicam uma tela de login para os voluntários.

## Funcionamento sem internet e sincronização

O requisito é manter os dados na própria Clover enquanto não houver conexão e sincronizá-los automaticamente quando ela voltar.

### Enquanto estiver sem conexão

- Permitir abrir comandas e adicionar ou corrigir itens.
- Permitir consultar as comandas já salvas no aparelho.
- Permitir registrar recebimentos, respeitando a distinção entre registro e confirmação financeira.
- Guardar os dados de forma persistente no aparelho, preservando-os se o aplicativo for fechado ou a Clover reiniciar.
- Utilizar o catálogo e os preços disponíveis localmente.
- Informar claramente que os dados ainda estão somente no aparelho.

### Quando a conexão voltar

- Enviar automaticamente os registros pendentes ao serviço central.
- Buscar atualizações, como alterações de catálogo e preços.
- Evitar duplicações em novas tentativas de envio, usando identificadores únicos para os registros e operações.
- Preservar os preços dos itens já lançados.
- Informar a situação da sincronização e os registros ainda pendentes.

Na administração pelo navegador, estarão disponíveis os dados já sincronizados, com indicação da última atualização. Não se deve apresentar como atualizada uma visão que ainda não recebeu os lançamentos feitos sem conexão.

Exemplos de mensagens previstas:

- “Sem internet — dados salvos neste aparelho”.
- “Sincronizando”.
- “Tudo sincronizado”.

As regras para alterações simultâneas na Clover e na administração ainda precisam ser detalhadas. Uma mudança não poderá sobrescrever silenciosamente dados pendentes de outro dispositivo. A estratégia de numeração visível das comandas também deverá considerar o funcionamento sem conexão e a eventual existência de mais de um aparelho.

### Limites desse funcionamento

Salvar comandas localmente não garante aprovação de cartão nem confirmação de Pix. Essas operações dependem dos respectivos serviços de pagamento e das capacidades efetivamente disponíveis.

Se o aparelho for perdido ou danificado antes da sincronização, registros existentes somente nele poderão ser perdidos. A sincronização deverá ocorrer assim que houver conexão; a estratégia adicional de backup ainda será definida.

O funcionamento sem conexão da administração pelo navegador não foi definido como requisito nesta etapa.

## Propostas anteriores ainda sujeitas a validação

As seguintes ideias foram apresentadas e ainda precisam de detalhamento ou validação; não devem ser tratadas como funcionalidades já aprovadas e implementadas:

- Numeração automática das comandas e busca por número ou nome.
- Tela inicial com “Nova comanda” e “Comandas abertas”.
- Quantidades editáveis, cálculo automático do total e histórico de comandas pagas.
- Organização do atendimento em categorias, como Cantina, Livros e Outros.
- Inclusão de quantos livros forem necessários, sem o limite de três linhas do papel.
- ISBN armazenado como texto e condição novo/usado separada, com identificador próprio do cadastro, permitindo o mesmo ISBN nas duas condições.
- Cadastro de fornecedores separado da identificação interna dos produtos.
- Relatório diário por produto e forma de pagamento, incluindo comandas abertas e valores de mensalidades/doações separados das vendas.
- Demonstração inicial no navegador para experimentar o fluxo antes do desenvolvimento e da instalação na Clover.

## Validação e integração com a Clover

O equipamento informado é uma Clover Flex vinculada à Caixa. Ainda é necessário identificar sua geração/modelo e versão antes de escolher o perfil de emulação, as dependências e a estratégia de instalação.

Uma demonstração no navegador e um aplicativo Android executado no emulador Clover têm finalidades diferentes. Uma demonstração das telas não constitui, por si só, um aplicativo pronto para instalação na Clover.

Pagamentos, impressão, leitura de códigos e outras funções físicas deverão ser validados em equipamento adequado. A disponibilidade desses recursos e a integração no Brasil não devem ser presumidas.

Referências oficiais consultadas durante o levantamento, que deverão ser verificadas novamente na etapa de integração:

- [Desenvolvedores Clover Brasil](https://br.clover.com/desenvolvedores/).
- [Visão geral do emulador Android Clover](https://docs.clover.com/dev/docs/android-emulator-overview).
- [Configuração do emulador Android](https://docs.clover.com/dev/docs/setting-up-an-android-emulator).
- [Kits de desenvolvimento Clover](https://docs.clover.com/dev/docs/clover-dev-kits).
- [Arquitetura de integração Clover](https://docs.apis-fiserv.com/latam/docs/card-present-clover-architecture).
- [Uso da API REST Clover](https://docs.clover.com/dev/docs/making-rest-api-calls).

## Próximas definições

1. Identificar a geração e a versão da Clover Flex utilizada.
2. Detalhar o fluxo de atendimento e validar as telas com os voluntários.
3. Detalhar a proposta de Node.js no Render com MongoDB: escolher a hospedagem do banco (Atlas recomendado), planos, regiões, URL administrativa, restrição de acesso sem login individual e política de backup.
4. Detalhar sincronização, conflitos, numeração e recuperação de falhas.
5. Escolher as tecnologias restantes, incluindo interface administrativa e armazenamento local na Clover, e delimitar as entregas da primeira versão.
6. Planejar os testes no aparelho, inclusive fechamento/reabertura do aplicativo, reinicialização, queda de conexão e reenvio sem duplicação.

Essas definições devem preservar a rotina combinada, os dados de referência e a acessibilidade para os voluntários.
