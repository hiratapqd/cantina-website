const { dayKey, period, paymentNames, categories, minimumStock, isLowStock } = require('./domain');
function inRange(value, range) { return value && dayKey(value) >= range.from && dayKey(value) <= range.to; }
function buildReport(data, query = {}) {
  const range = period(query);
  const type = query.type || 'vendas';
  const unsoldDays = [30, 60, 90, 180, 365].includes(Number(query.days)) ? Number(query.days) : 60;
  let bookSummary = null;
  const paid = data.orders.filter(order => order.status === 'paga' && inRange(order.paidAt, range));
  const entries = data.orders.flatMap(order => order.items.map(item => ({ ...item, order, date: item.occurredAt || order.createdAt }))).filter(item => inRange(item.date, range));
  const types = { vendas: 'Produtos lançados', recebimentos: 'Recebimentos', livros: 'Livros vendidos', doacao: 'Mensalidades e doações', rifa: 'Rifas', bazar: 'Bazar', estoque: 'Estoque mínimo', parados: 'Sem vendas há 60 dias', movimentacoes: 'Movimentação de estoque', livraria: 'Movimentação da livraria' };
  let rows = [], totalCents = 0;
  if (type === 'recebimentos') {
    rows = Object.keys(paymentNames).map(key => ({ name: paymentNames[key], quantity: paid.filter(o => o.payment === key).length, totalCents: paid.filter(o => o.payment === key).reduce((a, o) => a + o.totalCents, 0) }));
  } else if (['estoque', 'parados'].includes(type)) {
    const cutoff = Date.now() - 60 * 86_400_000;
    const items = [...data.products.map(i => ({ ...i, kind: 'products' })), ...data.books.map(i => ({ ...i, kind: 'books' }))];
    rows = items.filter(i => i.active).map(item => {
      const allSales = data.orders.flatMap(o => o.items.map(i => ({ ...i, date: i.occurredAt || o.createdAt }))).filter(i => i.catalogId === item._id);
      const last = allSales.sort((a, b) => new Date(b.date) - new Date(a.date))[0]?.date;
      return { name: item.name, code: item.code || item.isbn, condition: item.condition, stock: item.stock, minStock: minimumStock(item), last, since: last || item.createdAt, kind: item.kind, id: item._id };
    }).filter(i => type === 'estoque' ? isLowStock(i) : new Date(i.since).getTime() <= cutoff);
  } else if (type === 'movimentacoes') {
    rows = data.movements.filter(i => inRange(i.createdAt, range)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (type === 'livraria') {
    const bookEntries = entries.filter(i => i.kind === 'books');
    const allEntries = data.orders.flatMap(o => o.items.map(i => ({ ...i, date: i.occurredAt || o.createdAt }))).filter(i => i.kind === 'books' && dayKey(i.date) <= range.to);
    rows = data.books.map(book => {
      const history = allEntries.filter(i => i.catalogId === book._id);
      const age = i => Math.round((Date.parse(range.to) - Date.parse(dayKey(i.date))) / 86_400_000);
      const intervals = [30, 60, 90, 180, 365];
      const cumulative = intervals.map(days => history.filter(i => age(i) >= 0 && age(i) < days).reduce((a, i) => a + i.quantity, 0));
      const bands = intervals.map((days, index) => history.filter(i => age(i) >= (intervals[index - 1] || 0) && age(i) < days).reduce((a, i) => a + i.quantity, 0));
      const last = history.sort((a, b) => new Date(b.date) - new Date(a.date))[0]?.date;
      return { name: book.name, code: book.isbn, publisher: book.publisher, condition: book.condition, stock: book.stock, minStock: minimumStock(book), last, cumulative, bands, quantity: bookEntries.filter(i => i.catalogId === book._id).reduce((a, i) => a + i.quantity, 0), totalCents: bookEntries.filter(i => i.catalogId === book._id).reduce((a, i) => a + i.totalCents, 0) };
    });
    bookSummary = [30, 60, 90, 180, 365].map((days, index) => ({ days, cumulative: rows.reduce((sum, row) => sum + row.cumulative[index], 0), bands: rows.reduce((sum, row) => sum + row.bands[index], 0), unsold: rows.filter(row => row.cumulative[index] === 0).length }));
    rows = rows.filter(row => query.view !== 'sem-vendas' || row.cumulative[[30, 60, 90, 180, 365].indexOf(unsoldDays)] === 0);
  } else {
    const filtered = entries.filter(i => type === 'livros' ? i.kind === 'books' : ['doacao', 'rifa', 'bazar'].includes(type) ? i.category === type : !['doacao', 'rifa', 'bazar'].includes(i.category) && i.kind !== 'books');
    const map = new Map();
    for (const i of filtered) {
      const key = [i.catalogId || i.name, i.condition || '', i.unitPriceCents].join(':');
      const row = map.get(key) || { name: i.name, code: i.code || '', condition: i.condition, category: categories[i.category] || i.category, quantity: 0, totalCents: 0 };
      row.quantity += i.quantity; row.totalCents += i.totalCents; map.set(key, row);
    }
    rows = [...map.values()].sort((a, b) => b.totalCents - a.totalCents);
  }
  totalCents = rows.reduce((a, r) => a + (r.totalCents || 0), 0);
  return { range, type, view: query.view || 'periodo', title: types[type] || types.vendas, types, rows, totalCents, bookSummary, unsoldDays };
}
function dashboard(data) {
  const today = dayKey(new Date());
  const paid = data.orders.filter(o => o.status === 'paga' && o.paidAt && dayKey(o.paidAt) === today);
  const open = data.orders.filter(o => o.status === 'aberta');
  const low = [...data.products.map(i => ({ ...i, kind: 'products' })), ...data.books.map(i => ({ ...i, kind: 'books' }))].filter(i => i.active && isLowStock(i));
  const payments = Object.entries(paymentNames).map(([key, name]) => ({ key, name, total: paid.filter(o => o.payment === key).reduce((a, o) => a + o.totalCents, 0) }));
  const days = Array.from({ length: 7 }, (_, i) => { const date = new Date(Date.now() - (6 - i) * 86_400_000); const day = dayKey(date); return { label: new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(date).replace('.', ''), total: data.orders.filter(o => o.status === 'paga' && o.paidAt && dayKey(o.paidAt) === day).reduce((a, o) => a + o.totalCents, 0) }; });
  return { paid, open, low, payments, days, received: paid.reduce((a, o) => a + o.totalCents, 0), pending: open.reduce((a, o) => a + o.totalCents, 0), recent: [...data.orders].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5) };
}
module.exports = { buildReport, dashboard, inRange };
