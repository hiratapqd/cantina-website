const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
const { createMemoryStore } = require('../src/data/store');
const { demoData } = require('../src/data/demo');
const { createServices } = require('../src/services');
const { createApp } = require('../src/app');
const d = require('../src/domain');
const { buildReport } = require('../src/reports');

let server, origin;
const store = createMemoryStore(demoData());
before(async () => {
  server = createApp(store, { secret: 'test-secret-not-for-production-12345678' }).listen(0, '127.0.0.1');
  await once(server, 'listening'); origin = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));

test('todas as telas renderizam com logo, navegação e rodapé solicitado', async () => {
  for (const url of ['/', '/cantina', '/cantina/novo', '/livraria', '/livraria/novo', '/estoque', '/precos', '/comandas', '/relatorios', '/configuracoes', '/configuracoes/voluntarios', '/configuracoes/kits', '/configuracoes/campanhas', '/sincronizacao']) {
    const response = await fetch(origin + url);
    const html = await response.text();
    assert.equal(response.status, 200, `${url}: ${html.slice(-500)}`);
    assert.match(html, /logotipo-casinhazul\.png/);
    assert.match(html, /mailto:hiratabruno@yahoo\.com/);
    assert.match(html, /Nebule Tech Consulting/);
    assert.match(html, /Ambiente de demonstração/);
  }
});
test('páginas de edição, detalhe, filtros e relatórios não têm erros de template', async () => {
  const [product] = await store.list('products'); const [book] = await store.list('books'); const [order] = await store.list('orders');
  const paths = [`/cantina/${product._id}/editar`, `/livraria/${book._id}/editar`, `/estoque?ref=products:${product._id}`, `/comandas/${order._id}`, '/cantina?q=nada&status=inativos', '/comandas?status=pagas&payment=pix'];
  for (const type of ['estoque', 'parados', 'movimentacoes', 'livros', 'livraria', 'recebimentos', 'doacao', 'rifa', 'bazar']) paths.push('/relatorios?type=' + type);
  for (const url of paths) assert.equal((await fetch(origin + url)).status, 200, url);
});
test('interface também funciona com banco vazio e distingue registros ausentes', async () => {
  const emptyStore = createMemoryStore({ products: [], books: [], orders: [], devices: [], campaigns: [], volunteers: [], kits: [], movements: [] });
  const local = createApp(emptyStore).listen(0, '127.0.0.1'); await once(local, 'listening');
  try {
    for (const route of ['/', '/cantina', '/livraria', '/estoque', '/comandas', '/relatorios', '/configuracoes']) assert.equal((await fetch(`http://127.0.0.1:${local.address().port}${route}`)).status, 200, route);
  } finally { await new Promise(resolve => { local.close(resolve); local.closeAllConnections(); }); }
});
test('POST exige CSRF e permite cadastro válido sem autenticação de usuário', async () => {
  const initial = await fetch(origin + '/cantina/novo');
  const cookie = initial.headers.get('set-cookie').split(';')[0];
  const csrf = (await initial.text()).match(/name="_csrf" value="([^"]+)"/)[1];
  const data = { name: 'Produto de teste', code: 'TEST-001', group: 'cantina', category: 'doces', cost: '1,25', price: '5,00', minStock: '3' };
  const blocked = await fetch(origin + '/cantina', { method: 'POST', body: new URLSearchParams(data), redirect: 'manual' });
  assert.equal(blocked.status, 403);
  const created = await fetch(origin + '/cantina', { method: 'POST', headers: { Cookie: cookie }, body: new URLSearchParams({ ...data, _csrf: csrf }), redirect: 'manual' });
  assert.equal(created.status, 303);
  const [item] = await store.list('products', { code: 'TEST-001' });
  assert.equal(item.stock, 0); assert.equal(item.priceCents, 500);
});
test('valores monetários usam centavos exatos e rejeitam entradas ambíguas', () => {
  assert.equal(d.parseMoney('12,50'), 1250); assert.equal(d.parseMoney('0.01'), 1);
  assert.equal(d.reprice(800, 1500), 920);
  for (const value of ['-1', '1.000,00', '1e3', '', 'NaN', '1,234']) assert.throws(() => d.parseMoney(value));
});
test('usados sempre têm custo zero e venda de dez reais, mesmo com formulário manipulado', async () => {
  const service = createServices(createMemoryStore({ books: [] }));
  const row = await service.saveCatalog('books', null, { name: 'Livro doado', isbn: '9788573289442', condition: 'usado', cost: '999', price: '999', minStock: '0' });
  assert.equal(row.costCents, 0); assert.equal(row.priceCents, 1000);
});
test('mesmo ISBN admite novo e usado, mas impede duplicação da condição', async () => {
  const service = createServices(createMemoryStore({ books: [] }));
  const body = { name: 'Título', isbn: '9788573289442', condition: 'novo', cost: '2', price: '3', minStock: 0 };
  await service.saveCatalog('books', null, body); await service.saveCatalog('books', null, { ...body, condition: 'usado' });
  await assert.rejects(service.saveCatalog('books', null, body), /Já existe/);
});
test('estoque não fica negativo; correção a zero é permitida e tem histórico', async () => {
  const local = createMemoryStore(demoData()), service = createServices(local); const [row] = await local.list('products');
  await assert.rejects(service.stock('products', row._id, { type: 'saida', quantity: row.stock + 1, reason: 'Teste saída', version: row.version, operationId: randomUUID() }), /maior que/);
  const id = randomUUID();
  await service.stock('products', row._id, { type: 'contagem', quantity: 0, reason: 'Contagem conferida', version: row.version, operationId: id });
  assert.equal((await local.get('products', row._id)).stock, 0);
  assert.equal((await local.list('movements', { operationId: id }))[0].before, row.stock);
  await assert.rejects(service.stock('products', row._id, { type: 'contagem', quantity: 0, reason: 'Contagem conferida', version: row.version, operationId: id }), /já foi registrada/);
});
test('versão desatualizada não sobrescreve alterações de outra janela', async () => {
  const local = createMemoryStore(demoData()); const [row] = await local.list('products');
  await local.update('products', row._id, row.version, { minStock: 15 });
  await assert.rejects(local.update('products', row._id, row.version, { minStock: 20 }), /outra janela/);
  assert.equal((await local.get('products', row._id)).minStock, 15);
});
test('reajuste exclui usados e preserva preços históricos das comandas', async () => {
  const local = createMemoryStore(demoData()), service = createServices(local);
  const before = await local.list('orders');
  const preview = await service.previewPrices('books', { percent: '15' });
  const [used] = (await local.list('books')).filter(b => b.condition === 'usado');
  assert.ok(preview.rows.every(r => r.id !== used._id));
  await service.applyPrices(preview);
  assert.equal((await local.get('books', used._id)).priceCents, 1000);
  assert.deepEqual(await local.list('orders'), before);
  await assert.rejects(service.applyPrices(preview), /já foi aplicado/);
});
test('reajuste com conflito reverte todas as alterações', async () => {
  const local = createMemoryStore(demoData()), service = createServices(local);
  const preview = await service.previewPrices('products', { percent: '10' });
  const second = preview.rows[1]; await local.update('products', second.id, second.version, { minStock: 13 });
  const before = await local.list('products');
  await assert.rejects(service.applyPrices(preview), /outra janela/);
  assert.deepEqual(await local.list('products'), before); assert.equal((await local.list('priceChanges')).length, 0);
});
test('relatório de recebimentos soma apenas comandas pagas pela data do recebimento', () => {
  const today = new Date().toISOString(); const seed = demoData();
  seed.orders = [{ status: 'aberta', totalCents: 900, createdAt: today, items: [] }, { status: 'paga', payment: 'pix', paidAt: today, totalCents: 800, items: [] }];
  const report = buildReport(seed, { type: 'recebimentos' }); assert.equal(report.totalCents, 800);
});
test('exportação e tratamento de erros retornam conteúdo apropriado', async () => {
  const csv = await fetch(origin + '/relatorios/exportar.csv?type=recebimentos'); assert.equal(csv.status, 200); assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.equal((await fetch(origin + '/nao-existe')).status, 404);
  assert.equal((await fetch(origin + '/relatorios?from=2026-99-99')).status, 400);
  const [order] = await store.list('orders'); const html = await (await fetch(origin + '/comandas/' + order._id)).text();
  assert.match(html, /Identificada somente pelo número/);
});

test('prévia HTTP exige assinatura íntegra e confirma o reajuste uma única vez', async () => {
  const get = await fetch(origin + '/precos');
  const cookie = get.headers.get('set-cookie').split(';')[0];
  const csrf = (await get.text()).match(/name="_csrf" value="([^"]+)"/)[1];
  const post = (url, body) => fetch(origin + url, { method: 'POST', headers: { Cookie: cookie }, body: new URLSearchParams({ ...body, _csrf: csrf }), redirect: 'manual' });
  const preview = await post('/precos/previa', { kind: 'products', percent: '5' }); assert.equal(preview.status, 200);
  const token = (await preview.text()).match(/name="token" value="([^"]+)"/)[1];
  assert.equal((await post('/precos/aplicar', { token: token + 'x' })).status, 403);
  assert.equal((await post('/precos/aplicar', { token })).status, 303);
  assert.equal((await post('/precos/aplicar', { token })).status, 409);
});

test('cadastros auxiliares salvam e kits guardam componentes válidos', async () => {
  const local = createMemoryStore(demoData()), service = createServices(local);
  const volunteer = await service.saveSetting('volunteers', null, { name: 'Pessoa de teste', phone: '' }); assert.equal(volunteer.phone, '');
  const campaign = await service.saveSetting('campaigns', null, { name: 'Bazar de teste', type: 'bazar', goal: '100', startDate: '2026-11-01', endDate: '2026-11-30', description: '' }); assert.equal(campaign.goalCents, 10000);
  await assert.rejects(service.saveSetting('campaigns', null, { name: 'Teste', type: 'rifa', goal: '0', startDate: '2026-11-30', endDate: '2026-11-01', description: '' }), /data final/);
  const [product] = await local.list('products');
  const kit = await service.saveSetting('kits', null, { name: 'Kit exemplo', description: '', price: '20', components: JSON.stringify([{ kind: 'products', catalogId: product._id, quantity: 2 }]) });
  assert.equal(kit.components[0].name, product.name); assert.equal((await local.get('products', product._id)).stock, product.stock);
  await assert.rejects(service.saveSetting('kits', null, { name: 'Kit inválido', price: '10', components: '[null]' }), /inválido/);
});

test('relatórios acumulados e por faixa não contam um lançamento duas vezes na mesma faixa', () => {
  const data = demoData(); const book = data.books[0];
  data.orders = [{ status: 'aberta', createdAt: '2026-11-12T12:00:00Z', items: [{ catalogId: book._id, kind: 'books', name: book.name, quantity: 2, totalCents: 600, occurredAt: '2026-11-12T12:00:00Z' }, { catalogId: book._id, kind: 'books', name: book.name, quantity: 3, totalCents: 900, occurredAt: '2026-10-01T12:00:00Z' }] }];
  const report = buildReport(data, { type: 'livraria', from: '2026-01-01', to: '2026-11-12', view: 'faixas' });
  const row = report.rows.find(r => r.code === book.isbn && r.condition === book.condition);
  assert.deepEqual(row.bands, [2, 3, 0, 0, 0]); assert.deepEqual(row.cumulative, [2, 5, 5, 5, 5]);
});
