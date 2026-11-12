# Casinha Azul

Site administrativo da cantina e livraria, em Node.js, Express, EJS e MongoDB.

```powershell
npm ci
npm run demo
```

Abra **http://127.0.0.1:3000**. A demonstração é isolada e não altera o MongoDB.

Configuração do banco, comandos, estrutura, funcionalidades, testes e publicação no Render estão em [preparation/IMPLEMENTACAO.md](preparation/IMPLEMENTACAO.md). As premissas e os desenhos permanecem em [preparation/README.md](preparation/README.md).

Para usar o banco real, confira o `.env`, prepare os índices com `npm run db:prepare` e execute `npm start`. Não há login de usuários nesta etapa; mantenha o acesso restrito ao ambiente autorizado.
