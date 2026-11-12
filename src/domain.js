const { z } = require('zod');

class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const groups = { cantina: 'Cantina', diversos: 'Diversos' };
const categories = {
  salgados: 'Salgados', lanches: 'Lanches', doces: 'Doces', bebidas: 'Bebidas',
  cafes: 'Cafés', sabonetes: 'Sabonetes', banhos: 'Banhos', sprays: 'Sprays',
  escalda_pes: 'Escalda-pés', outros: 'Outros',
};
const paymentNames = { pix: 'Pix', debito: 'Cartão de débito', dinheiro: 'Dinheiro' };
const campaignNames = { rifa: 'Rifa', bazar: 'Bazar', doacao: 'Doação' };
const shortText = z.string().trim().min(1, 'Preencha os campos obrigatórios.').max(180, 'Use até 180 caracteres.');
const integer = z.coerce.number().int('Informe uma quantidade inteira.').min(0).max(1_000_000);
const cents = z.number().int().min(0).max(100_000_000);
const optionalText = z.string().trim().max(300).default('');
const productSchema = z.object({
  name: shortText, code: z.string().trim().regex(/^[a-zA-Z0-9._-]{1,40}$/, 'Código inválido.'),
  group: z.enum(Object.keys(groups)), category: z.enum(Object.keys(categories)),
  costCents: cents, priceCents: cents.min(1, 'O preço de venda deve ser maior que zero.'), minStock: integer,
});
const bookSchema = z.object({
  name: shortText, isbn: z.string().trim().regex(/^\d{13}$/, 'O ISBN deve conter 13 dígitos.'),
  condition: z.enum(['novo', 'usado']), author: optionalText, publisher: optionalText, dictatedBy: optionalText,
  costCents: cents, priceCents: cents.min(1), minStock: integer,
}).transform(value => value.condition === 'usado' ? { ...value, costCents: 0, priceCents: 1000, minStock: 0 } : value);
const volunteerSchema = z.object({ name: shortText, phone: z.string().trim().regex(/^(?:\d{10,13})?$/, 'Use somente dígitos no telefone, com DDD.').default('') });
const campaignSchema = z.object({
  name: shortText, type: z.enum(['rifa', 'bazar', 'doacao']), goalCents: cents, description: optionalText,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine(value => [value.startDate, value.endDate].every(date => !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date), 'Informe datas válidas.').refine(value => value.endDate >= value.startDate, 'A data final deve ser igual ou posterior à inicial.');

function parseMoney(value) {
  const raw = String(value ?? '').trim();
  if (!/^\d+(?:,\d{1,2}|\.\d{1,2})?$/.test(raw)) throw new AppError('Informe o valor sem separador de milhar, por exemplo 12,50.');
  const [whole, fraction = ''] = raw.replace(',', '.').split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount > 100_000_000) throw new AppError('Valor fora do limite permitido.');
  return amount;
}
function validate(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError(result.error.issues.map(issue => issue.message).join(' '));
  return result.data;
}
function reprice(priceCents, basisPoints) {
  return Math.round(priceCents * (10_000 + basisPoints) / 10_000);
}
function parsePercent(value) {
  const raw = String(value ?? '').trim().replace(',', '.');
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(raw)) throw new AppError('Informe um percentual com até duas casas decimais.');
  const n = Math.round(Number(raw) * 100);
  if (n <= -10_000 || n > 100_000 || n === 0) throw new AppError('Informe um percentual diferente de zero, maior que -100% e até 1.000%.');
  return n;
}
const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((value || 0) / 100);
const inputMoney = value => ((value || 0) / 100).toFixed(2).replace('.', ',');
const dayKey = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
function dateTime(value) {
  return value ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Sem comunicação';
}
function period(query = {}) {
  const today = dayKey(new Date());
  const from = query.from || today, to = query.to || today;
  for (const date of [from, to]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new AppError('Selecione datas válidas.');
  }
  if (from > to) throw new AppError('A data inicial deve ser anterior à final.');
  return { from, to };
}
function minimumStock(item) { return item.condition === 'usado' ? 0 : item.minStock; }
function isLowStock(item) { return item.condition !== 'usado' && item.stock <= minimumStock(item); }
module.exports = { AppError, groups, categories, paymentNames, campaignNames, productSchema, bookSchema, volunteerSchema, campaignSchema, validate, parseMoney, parsePercent, reprice, money, inputMoney, dayKey, dateTime, period, minimumStock, isLowStock };
