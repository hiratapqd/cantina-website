const config = require('../src/config');
const { mongoose, models } = require('../src/data/models');
(async () => {
  if (!config.mongoUri) throw new Error('Configure MONGODB_URI.');
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000, autoCreate: false, autoIndex: false });
  for (const [name, model] of Object.entries(models)) {
    await model.createCollection();
    await model.createIndexes();
    console.log(`Estrutura preparada: ${name}`);
  }
})().catch(error => { console.error(`Não foi possível preparar o banco (${error.code || error.name}). Confira permissões e possíveis códigos duplicados.`); process.exitCode = 1; }).finally(() => mongoose.disconnect());
