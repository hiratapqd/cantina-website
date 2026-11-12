const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');
const { Schema } = mongoose;
const base = { _id: { type: String, default: randomUUID }, version: { type: Number, default: 0 }, active: { type: Boolean, default: true } };
const money = { type: Number, min: 0, required: true };
const stock = { type: Number, min: 0, default: 0 };
function model(name, collection, fields, indexes = []) {
  const schema = new Schema({ ...base, ...fields }, { timestamps: true, strict: 'throw', autoIndex: false, autoCreate: false });
  for (const [keys, options] of indexes) schema.index(keys, options);
  return mongoose.models[name] || mongoose.model(name, schema, collection);
}
const catalog = { name: { type: String, required: true }, costCents: money, priceCents: money, stock, minStock: stock };
const models = {
  products: model('Product', 'cantina_produtos', { ...catalog, code: { type: String, required: true }, group: { type: String, enum: ['cantina', 'diversos'] }, category: String }, [[{ code: 1 }, { unique: true }]]),
  books: model('Book', 'cantina_livros', { ...catalog, isbn: { type: String, required: true }, condition: { type: String, enum: ['novo', 'usado'], required: true }, author: String, publisher: String, dictatedBy: String }, [[{ isbn: 1, condition: 1 }, { unique: true }]]),
  orders: model('Order', 'cantina_comandas', {
    number: { type: String, required: true }, name: { type: String, default: '' }, phone: String,
    status: { type: String, enum: ['aberta', 'paga'], required: true }, totalCents: money,
    payment: { type: String, enum: ['pix', 'debito', 'dinheiro'] }, paidAt: Date, deviceId: String,
    items: [{ _id: false, catalogId: String, kind: String, name: String, code: String, condition: String, category: String, quantity: Number, unitPriceCents: Number, totalCents: Number, campaignId: String, occurredAt: Date }],
  }, [[{ status: 1, createdAt: -1 }, {}], [{ paidAt: -1, payment: 1 }, {}]]),
  movements: model('Movement', 'cantina_movimentacoes_estoque', { catalogId: String, kind: String, name: String, delta: Number, before: Number, after: Number, reason: String, operationId: String }, [[{ operationId: 1 }, { unique: true }], [{ catalogId: 1, createdAt: -1 }, {}]]),
  volunteers: model('Volunteer', 'cantina_voluntarios', { name: String, phone: String }),
  kits: model('Kit', 'cantina_kits', { name: String, priceCents: money, description: String, components: [{ _id: false, catalogId: String, kind: String, name: String, quantity: Number }] }),
  campaigns: model('Campaign', 'cantina_campanhas', { name: String, type: { type: String, enum: ['rifa', 'bazar', 'doacao'] }, goalCents: Number, startDate: String, endDate: String, description: String }),
  devices: model('Device', 'cantina_dispositivos', { name: String, lastSeenAt: Date, lastSyncedAt: Date, pendingCount: Number }),
  priceChanges: model('PriceChange', 'cantina_alteracoes_precos', { kind: String, catalogId: String, name: String, before: Number, after: Number, operationId: String }, [[{ operationId: 1, catalogId: 1 }, { unique: true }]]),
};
module.exports = { models, mongoose };
