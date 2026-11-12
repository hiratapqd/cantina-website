const { randomUUID } = require('node:crypto');
const { AppError } = require('../domain');

function createMemoryStore(seed) {
  const data = structuredClone(seed);
  let queue = Promise.resolve();
  const repo = {
    mode: 'demo',
    async list(name, filter = {}) { return structuredClone((data[name] || []).filter(row => Object.entries(filter).every(([key, value]) => row[key] === value))); },
    async get(name, id) { return structuredClone((data[name] || []).find(row => row._id === id) || null); },
    async insert(name, value) {
      const duplicate = (data[name] || []).some(row => name === 'products' ? row.code === value.code : name === 'books' ? row.isbn === value.isbn && row.condition === value.condition : name === 'movements' ? row.operationId === value.operationId : name === 'priceChanges' ? row.operationId === value.operationId && row.catalogId === value.catalogId : false);
      if (duplicate) throw new AppError('Este cadastro ou operação já existe.', 409);
      const row = { _id: randomUUID(), version: 0, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...value };
      (data[name] ||= []).push(row); return structuredClone(row);
    },
    async update(name, id, version, values) {
      const row = (data[name] || []).find(r => r._id === id && r.version === Number(version));
      if (!row) throw new AppError('Este registro mudou em outra janela. Atualize a página e tente novamente.', 409);
      Object.assign(row, values, { version: row.version + 1, updatedAt: new Date().toISOString() }); return structuredClone(row);
    },
    async atomic(callback) {
      const execute = async () => {
        const before = structuredClone(data);
        try { return await callback(repo); }
        catch (error) { for (const key of Object.keys(data)) delete data[key]; Object.assign(data, before); throw error; }
      };
      const result = queue.then(execute, execute); queue = result.catch(() => {}); return result;
    },
    async close() {},
  };
  return repo;
}
async function createMongoStore(uri) {
  const { models, mongoose } = require('./models');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, autoCreate: false, autoIndex: false });
  await mongoose.connection.db.command({ ping: 1 });
  function repository(session) {
    return {
      mode: 'mongodb',
      list: (name, filter = {}) => models[name].find(filter).session(session || null).lean().exec(),
      get: (name, id) => models[name].findById(id).session(session || null).lean().exec(),
      async insert(name, value) { const [doc] = await models[name].create([value], session ? { session } : {}); return doc.toObject(); },
      async update(name, id, version, values) {
        const row = await models[name].findOneAndUpdate({ _id: id, version: Number(version) }, { $set: values, $inc: { version: 1 } }, { new: true, runValidators: true, session }).lean();
        if (!row) throw new AppError('Este registro mudou em outra janela. Atualize a página e tente novamente.', 409);
        return row;
      },
      async atomic(callback) {
        try { return await mongoose.connection.transaction(s => callback(repository(s))); }
        catch (error) {
          if (error.code === 20 || /replica set|Transaction numbers/.test(error.message)) throw new AppError('Esta operação exige MongoDB em replica set ou Atlas para salvar o histórico com segurança.', 503);
          throw error;
        }
      },
      close: () => mongoose.disconnect(),
    };
  }
  return repository();
}
module.exports = { createMemoryStore, createMongoStore };
