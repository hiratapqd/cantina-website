const catalog = require('../src/data/catalog.json');
const { productSchema, bookSchema, validate } = require('../src/domain');
const config = require('../src/config');
const { mongoose, models } = require('../src/data/models');
(async () => {
  const rows = catalog.items.map(({ kind, ...value }) => ({ kind, value: { ...validate(kind === 'books' ? bookSchema : productSchema, value), stock: 0, active: true } }));
  console.log(`Fonte: ${catalog.source} · ${rows.length} cadastros validados.`);
  if (!process.argv.includes('--apply')) {
    console.log('Prévia somente. Nenhuma conexão ao banco. Use --apply para inserir os cadastros que ainda não existem, com estoque zero.');
    return;
  }
  if (!config.mongoUri) throw new Error('Configure MONGODB_URI.');
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000, autoCreate: false, autoIndex: false });
  let inserted = 0;
  for (const { kind, value } of rows) {
    const identity = kind === 'books' ? { isbn: value.isbn, condition: value.condition } : { code: value.code };
    const result = await models[kind].updateOne(identity, { $setOnInsert: { ...value } }, { upsert: true, runValidators: true });
    inserted += result.upsertedCount;
  }
  console.log(`${inserted} novos cadastros inseridos. Cadastros existentes não foram alterados.`);
})().catch(error => { console.error(`Não foi possível importar o catálogo (${error.code || error.name}).`); process.exitCode = 1; }).finally(() => mongoose.disconnect());
