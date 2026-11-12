const config = require('./config');
const { createMemoryStore, createMongoStore } = require('./data/store');
const { demoData } = require('./data/demo');
const { createApp } = require('./app');

async function start() {
  const store = config.mode === 'demo' ? createMemoryStore(demoData()) : await createMongoStore(config.mongoUri);
  const app = createApp(store, config);
  const server = app.listen(config.port, config.host, () => {
    console.log(`Casinha Azul: http://${config.host}:${config.port} · modo ${config.mode}`);
    if (config.mode === 'demo') console.log('Demonstração isolada. Alterações são perdidas ao reiniciar. Nenhum acesso ao MongoDB.');
  });
  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    const timeout = setTimeout(() => process.exit(1), 10_000); timeout.unref();
    server.close(async () => { await store.close(); clearTimeout(timeout); process.exitCode = 0; });
  }
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  server.on('error', error => { console.error(`Falha ao iniciar o servidor (${error.code || error.name}).`); process.exitCode = 1; store.close(); });
}
start().catch(error => { console.error(`Não foi possível iniciar a aplicação (${error.code || error.name}). Confira a configuração do ambiente e as permissões do MongoDB.`); process.exitCode = 1; });
