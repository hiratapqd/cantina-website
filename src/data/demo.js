const { randomUUID } = require('node:crypto');
const catalog = require('./catalog.json');
function demoData() {
  const now = new Date();
  const ago = hours => new Date(now.getTime() - hours * 3_600_000).toISOString();
  const record = value => ({ _id: randomUUID(), active: true, version: 0, createdAt: ago(24 * 120), updatedAt: ago(2), ...value });
  const products = catalog.items.filter(i => i.kind === 'products').map(({ kind, ...i }, index) => record({ ...i, stock: [24, 18, 6, 12, 3, 28, 16][index % 7], minStock: i.group === 'cantina' ? 8 : 4 }));
  const books = catalog.items.filter(i => i.kind === 'books').map(({ kind, ...i }, index) => record({ ...i, stock: [6, 10, 2, 5][index % 4], minStock: 3 }));
  // Exemplos de doações: mesmo ISBN do novo, cadastro e estoque independentes.
  const donatedBooks = books.slice(0, 5).map((book, index) => record({
    ...book,
    _id: randomUUID(),
    condition: 'usado',
    costCents: 0,
    priceCents: 1000,
    stock: [3, 4, 2, 1, 5][index],
    minStock: 0,
  }));
  books.push(...donatedBooks);
  const volunteers = [record({ name: 'Maria Oliveira', phone: '' }), record({ name: 'José Santos', phone: '' }), record({ name: 'Ana Costa', phone: '' })];
  const orders = Array.from({ length: 31 }, (_, index) => {
    const open = index < 5;
    const selected = [products[index % products.length], index % 4 === 0 ? books[index % books.length] : products[(index + 10) % products.length]];
    const items = selected.map((item, j) => ({ catalogId: item._id, kind: item.isbn ? 'books' : 'products', name: item.name, code: item.code || item.isbn, condition: item.condition || '', category: item.category || 'livros', quantity: j + 1, unitPriceCents: item.priceCents, totalCents: item.priceCents * (j + 1), occurredAt: ago(index < 16 ? 1 + index * 0.15 : 24 + index) }));
    return record({ number: String(124 + index), name: index % 3 === 0 ? '' : volunteers[index % 3].name, phone: '', status: open ? 'aberta' : 'paga', payment: open ? undefined : ['pix', 'debito', 'dinheiro'][index % 3], paidAt: open ? undefined : ago(index < 16 ? 1 + index * 0.15 : 24 + index), createdAt: items[0].occurredAt, items, totalCents: items.reduce((total, item) => total + item.totalCents, 0), deviceId: 'demo-flex' });
  });
  const movements = donatedBooks.map(book => record({
    catalogId: book._id, kind: 'books', name: book.name,
    delta: book.stock, before: 0, after: book.stock,
    reason: 'Doação de livros usados — exemplo de demonstração',
    operationId: randomUUID(), createdAt: ago(3),
  }));
  return { products, books, orders, volunteers, movements, priceChanges: [], kits: [], campaigns: [], devices: [record({ name: 'Clover Flex · exemplo', lastSeenAt: ago(0.02), lastSyncedAt: ago(0.02), pendingCount: 0 })] };
}
module.exports = { demoData };
