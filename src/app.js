const path = require('node:path');
const { randomUUID } = require('node:crypto');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const d = require('./domain');
const { createServices } = require('./services');
const { createSecurity } = require('./security');
const { buildReport, dashboard } = require('./reports');

function createApp(store, options = {}) {
  const app = express();
  const services = createServices(store);
  const security = createSecurity(options.secret || randomUUID(), Boolean(options.production));
  app.disable('x-powered-by');
  if (options.production) app.set('trust proxy', 1);
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(helmet({ contentSecurityPolicy: { directives: { 'default-src': ["'self'"], 'script-src': ["'self'"], 'style-src': ["'self'", "'unsafe-inline'"], 'img-src': ["'self'", 'data:'], 'upgrade-insecure-requests': options.production ? [] : null } } }));
  app.use(compression());
  app.use('/assets', express.static(path.join(__dirname, '../public'), { maxAge: options.production ? '1h' : 0, index: false, dotfiles: 'deny' }));
  app.get('/health', (_req, res) => res.json({ status: 'ok', mode: store.mode }));
  app.use(express.urlencoded({ extended: false, limit: '512kb' }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    Object.assign(res.locals, { ...d, path: req.path, mode: store.mode, query: req.query, year: new Date().getFullYear(), today: d.dayKey(new Date()), notice: { saved: 'Alterações salvas com sucesso.', stock: 'Movimentação de estoque registrada.', prices: 'Reajuste aplicado. Os preços das comandas foram preservados.', toggled: 'Situação do cadastro atualizada.' }[req.query.notice] || '' });
    next();
  });
  app.use(security.csrf);
  const render = (res, page, title, data = {}) => res.render('layout', { page, title, ...data });
  const catalogPath = kind => kind === 'books' ? '/livraria' : '/cantina';
  function kindFor(value) { if (!['products', 'books'].includes(value)) throw new d.AppError('Catálogo inválido.', 404); return value; }

  app.get('/', async (_req, res) => {
    const data = await services.data();
    render(res, 'dashboard', 'Visão geral', { ...data, stats: dashboard(data) });
  });
  for (const [url, kind] of [['/cantina', 'products'], ['/livraria', 'books']]) {
    app.get(url, async (req, res) => {
      const search = String(req.query.q || '').trim().slice(0, 120);
      let rows = await store.list(kind);
      rows = rows.filter(i => (!search || [i.name, i.code, i.isbn, i.author].some(v => String(v || '').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))) && (req.query.status === 'inativos' ? !i.active : req.query.status === 'todos' ? true : i.active) && (!req.query.category || i.category === req.query.category) && (!req.query.condition || i.condition === req.query.condition) && (!req.query.low || i.stock <= i.minStock));
      rows.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      const total = rows.length, currentPage = Math.max(1, Math.min(Math.ceil(total / 15) || 1, parseInt(req.query.page, 10) || 1));
      render(res, 'catalog', kind === 'books' ? 'Livraria' : 'Cantina e diversos', { kind, rows: rows.slice((currentPage - 1) * 15, currentPage * 15), total, currentPage, pages: Math.ceil(total / 15), search, base: url });
    });
    app.get(`${url}/novo`, (_req, res) => render(res, 'catalog-form', kind === 'books' ? 'Cadastrar livro' : 'Cadastrar produto', { kind, base: url, item: { active: true, condition: 'novo', group: 'cantina', category: 'salgados', minStock: 0, costCents: 0, priceCents: 0 } }));
    app.get(`${url}/:id/editar`, async (req, res) => render(res, 'catalog-form', 'Editar cadastro', { kind, base: url, item: await services.required(kind, req.params.id) }));
    app.post(url, async (req, res) => { await services.saveCatalog(kind, null, req.body); res.redirect(303, `${url}?notice=saved`); });
    app.post(`${url}/:id`, async (req, res) => { await services.saveCatalog(kind, req.params.id, req.body); res.redirect(303, `${url}?notice=saved`); });
  }
  app.post('/catalogo/:kind/:id/situacao', async (req, res) => { const kind = kindFor(req.params.kind); await services.toggle(kind, req.params.id, req.body); res.redirect(303, `${catalogPath(kind)}?notice=toggled`); });
  app.get('/estoque', async (req, res) => {
    const data = await services.data();
    const items = [...data.products.map(i => ({ ...i, kind: 'products' })), ...data.books.map(i => ({ ...i, kind: 'books' }))].filter(i => i.active).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    let selected = null;
    const [refKind, refId] = String(req.query.ref || '').split(':');
    if (req.query.id || refId) { const kind = kindFor(refKind || req.query.kind); selected = { ...await services.required(kind, String(refId || req.query.id)), kind }; }
    render(res, 'stock', 'Controle de estoque', { items, selected, movements: data.movements.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 30), operationId: randomUUID() });
  });
  app.post('/estoque', async (req, res) => { await services.stock(kindFor(req.body.kind), req.body.id, req.body); res.redirect(303, `/estoque?notice=stock`); });
  app.get('/precos', (_req, res) => render(res, 'prices', 'Reajuste de preços', { preview: null }));
  app.post('/precos/previa', async (req, res) => { const preview = await services.previewPrices(req.body.kind, req.body); render(res, 'prices', 'Confira o reajuste', { preview, token: security.pack(preview) }); });
  app.post('/precos/aplicar', async (req, res) => { await services.applyPrices(security.unpack(req.body.token)); res.redirect(303, `${catalogPath(security.unpack(req.body.token).kind)}?notice=prices`); });
  app.get('/comandas', async (req, res) => {
    const filter = req.query.status === 'pagas' ? 'paga' : req.query.status === 'todas' ? null : 'aberta';
    let rows = await store.list('orders', filter ? { status: filter } : {});
    const search = String(req.query.q || '').trim().slice(0, 120).toLocaleLowerCase('pt-BR');
    if (search) rows = rows.filter(o => [o.number, o.name].some(v => String(v || '').toLocaleLowerCase('pt-BR').includes(search)));
    if (req.query.payment) rows = rows.filter(o => o.payment === req.query.payment);
    if (req.query.from || req.query.to) { const range = d.period(req.query); rows = rows.filter(o => { const date = d.dayKey(o.paidAt || o.createdAt); return date >= range.from && date <= range.to; }); }
    rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const total = rows.length, currentPage = Math.max(1, Math.min(Math.ceil(total / 20) || 1, parseInt(req.query.page, 10) || 1));
    render(res, 'orders', 'Comandas', { rows: rows.slice((currentPage - 1) * 20, currentPage * 20), total, currentPage, pages: Math.ceil(total / 20), balance: rows.reduce((a, o) => a + o.totalCents, 0) });
  });
  app.get('/comandas/:id', async (req, res) => render(res, 'order', 'Detalhe da comanda', { order: await services.required('orders', req.params.id) }));
  app.get('/livraria/movimentacao', async (req, res) => {
    const view = ['acumulado', 'faixas', 'sem-vendas'].includes(req.query.view) ? req.query.view : 'acumulado';
    const reference = req.query.to || d.dayKey(new Date());
    const report = buildReport(await services.data(), { ...req.query, from: reference, to: reference, type: 'livraria', view });
    render(res, 'book-movement', 'Movimentação da livraria', { report });
  });
  app.get('/relatorios', async (req, res) => {
    const data = await services.data();
    render(res, 'reports', 'Relatórios', { report: buildReport(data, req.query) });
  });
  app.get('/relatorios/exportar.csv', async (req, res) => {
    const report = buildReport(await services.data(), req.query);
    const cell = value => { const s = String(value ?? ''); return `"${(typeof value !== 'number' && /^[=+@\-\t\r]/.test(s) ? "'" + s : s).replaceAll('"', '""')}"`; };
    let headers = ['Nome', 'Código/ISBN', 'Condição', 'Quantidade', 'Total (R$)', 'Estoque', 'Mínimo', 'Motivo', 'Data', 'Variação'];
    let rows = report.rows.map(r => [r.name, r.code, r.condition, r.quantity, r.totalCents == null ? '' : d.inputMoney(r.totalCents), r.stock, r.minStock, r.reason, r.createdAt ? d.dateTime(r.createdAt) : '', r.delta]);
    if (report.type === 'livraria' && ['acumulado', 'faixas', 'sem-vendas'].includes(report.view)) {
      headers = ['Livro', 'ISBN', 'Condição', 'Estoque', 'Último lançamento', ...(report.view === 'faixas' ? ['0–29 dias', '30–59 dias', '60–89 dias', '90–179 dias', '180–364 dias'] : ['30 dias', '60 dias', '90 dias', '180 dias', '365 dias'])];
      rows = report.rows.map(r => [r.name, r.code, r.condition, r.stock, r.last ? d.dateTime(r.last) : '', ...(report.view === 'faixas' ? r.bands : r.cumulative)]);
    }
    res.type('text/csv').attachment(`casinha-azul-${report.type}-${report.range.from}.csv`).send('\uFEFF' + [headers, ...rows].map(row => row.map(cell).join(';')).join('\r\n'));
  });
  app.get('/configuracoes', async (_req, res) => render(res, 'settings', 'Configurações', { ...await services.data(), section: 'overview' }));
  for (const [slug, kind, title] of [['voluntarios', 'volunteers', 'Voluntários'], ['kits', 'kits', 'Kits para venda'], ['campanhas', 'campaigns', 'Rifas e campanhas']]) {
    app.get(`/configuracoes/${slug}`, async (req, res) => {
      const data = await services.data(); const item = req.query.edit ? await services.required(kind, String(req.query.edit)) : null;
      render(res, 'settings', title, { ...data, section: kind, slug, item });
    });
    app.post(`/configuracoes/${slug}`, async (req, res) => { await services.saveSetting(kind, req.body.id || null, req.body); res.redirect(303, `/configuracoes/${slug}?notice=saved`); });
    app.post(`/configuracoes/${slug}/:id/situacao`, async (req, res) => { await services.toggle(kind, req.params.id, req.body); res.redirect(303, `/configuracoes/${slug}?notice=toggled`); });
  }
  app.get('/sincronizacao', async (_req, res) => render(res, 'sync', 'Sincronização Clover', { devices: await store.list('devices') }));
  app.get('/api/catalogo', async (_req, res) => res.json({ products: await store.list('products', { active: true }), books: await store.list('books', { active: true }) }));
  app.use((_req, _res, next) => next(new d.AppError('Esta página não foi encontrada.', 404)));
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (!res.locals.mode) Object.assign(res.locals, { ...d, mode: store.mode, path: req.path, query: {}, csrf: '', notice: '', year: new Date().getFullYear(), today: d.dayKey(new Date()) });
    const duplicate = err.code === 11000;
    const status = duplicate ? 409 : err instanceof d.AppError ? err.status : err.status === 413 ? 413 : 500;
    const message = duplicate ? 'Este código ou ISBN e condição já estão cadastrados.' : err instanceof d.AppError ? err.message : status === 413 ? 'O formulário excede o tamanho permitido.' : 'Não foi possível concluir a operação. Confira a conexão com o banco e tente novamente.';
    if (status >= 500) console.error(JSON.stringify({ event: 'request_error', name: err.name, code: err.code, path: req.path }));
    res.status(status); render(res, 'error', status === 404 ? 'Página não encontrada' : 'Vamos conferir?', { message, status });
  });
  return app;
}
module.exports = { createApp };
