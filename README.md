# Casinha Azul

Site administrativo da cantina e livraria, em Node.js, Express, EJS e MongoDB.

```powershell
npm ci
npm run demo
```

Abra **http://127.0.0.1:3000**. A demonstração é isolada e não altera o MongoDB.

Para publicar a demonstração no Render, crie um **Blueprint** conectado ao repositório e use o `render.yaml` da raiz. Ele configura o serviço `casinha-azul-demo` no plano gratuito, executa `npm run demo` e gera o `APP_SECRET`. Não é necessário configurar MongoDB.

Se o serviço já foi criado manualmente, ajuste **Build Command** para `npm ci --omit=dev`, **Start Command** para `npm run demo` e **Health Check Path** para `/health`. Nas variáveis de ambiente, use `NODE_VERSION=24.14.1`, `NODE_ENV=production`, `DATA_MODE=demo`, `HOST=0.0.0.0` e um `APP_SECRET` aleatório de pelo menos 32 caracteres. Mantenha a porta `PORT` fornecida pelo Render. Depois, faça um novo deploy.

Ao abrir `/health`, a resposta esperada é `{"status":"ok","mode":"demo"}`. As alterações da demonstração são compartilhadas entre visitantes e se perdem quando o processo reinicia.

Configuração do banco, comandos, estrutura, funcionalidades, testes e publicação no Render estão em [preparation/IMPLEMENTACAO.md](preparation/IMPLEMENTACAO.md). As premissas e os desenhos permanecem em [preparation/README.md](preparation/README.md).

Para usar o banco real, confira o `.env`, prepare os índices com `npm run db:prepare` e execute `npm start`. Não há login de usuários nesta etapa; mantenha o acesso restrito ao ambiente autorizado.
