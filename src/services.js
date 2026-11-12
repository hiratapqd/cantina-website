const { randomUUID } = require('node:crypto');
const d = require('./domain');
const CATALOGS = ['products', 'books'];
function createServices(store) {
  const required = async (kind, id) => {
    const item = await store.get(kind, id);
    if (!item) throw new d.AppError('Registro não encontrado.', 404);
    return item;
  };
  async function saveCatalog(kind, id, body) {
    if (!CATALOGS.includes(kind)) throw new d.AppError('Catálogo inválido.');
    const data = d.validate(kind === 'books' ? d.bookSchema : d.productSchema, {
      ...body, costCents: kind === 'books' && body.condition === 'usado' ? 0 : d.parseMoney(body.cost),
      priceCents: kind === 'books' && body.condition === 'usado' ? 1000 : d.parseMoney(body.price),
      minStock: kind === 'books' && body.condition === 'usado' ? 0 : body.minStock,
    });
    const identity = kind === 'books' ? { isbn: data.isbn, condition: data.condition } : { code: data.code };
    if ((await store.list(kind, identity)).some(row => row._id !== id)) throw new d.AppError('Já existe um cadastro com este código ou ISBN e condição.', 409);
    if (id) {
      const before = await required(kind, id);
      if (!before.active) throw new d.AppError('Reative o cadastro antes de editar.');
      if (kind === 'books' && before.condition !== data.condition) throw new d.AppError('Cadastre a outra condição separadamente para preservar estoque e histórico.');
      if (before.priceCents !== data.priceCents) {
        return store.atomic(async tx => {
          const result = await tx.update(kind, id, body.version, data);
          await tx.insert('priceChanges', { kind, catalogId: id, name: data.name, before: before.priceCents, after: data.priceCents, operationId: randomUUID() });
          return result;
        });
      }
      return store.update(kind, id, body.version, data);
    }
    return store.insert(kind, { ...data, stock: 0 });
  }
  async function stock(kind, id, body) {
    if (!CATALOGS.includes(kind)) throw new d.AppError('Catálogo inválido.');
    const quantity = Number(body.quantity);
    if (!Number.isSafeInteger(quantity) || quantity < (body.type === 'contagem' ? 0 : 1) || quantity > 1_000_000) throw new d.AppError('Informe uma quantidade inteira válida. Zero é permitido somente na correção de contagem.');
    if (!['entrada', 'saida', 'contagem'].includes(body.type)) throw new d.AppError('Selecione o tipo da movimentação.');
    const reason = String(body.reason || '').trim();
    if (reason.length < 3 || reason.length > 300) throw new d.AppError('Descreva o motivo da movimentação (3 a 300 caracteres).');
    if (!/^[a-f\d-]{36}$/.test(body.operationId || '')) throw new d.AppError('Atualize o formulário antes de registrar a movimentação.');
    return store.atomic(async tx => {
      if ((await tx.list('movements', { operationId: body.operationId })).length) throw new d.AppError('Esta movimentação já foi registrada. Atualize a página.', 409);
      const item = await tx.get(kind, id);
      if (!item || !item.active) throw new d.AppError('Cadastro inexistente ou inativo.');
      const after = body.type === 'contagem' ? quantity : item.stock + (body.type === 'entrada' ? quantity : -quantity);
      if (after < 0) throw new d.AppError('A saída é maior que o estoque disponível.');
      if (after > 1_000_000) throw new d.AppError('Estoque fora do limite permitido.');
      await tx.update(kind, id, body.version, { stock: after });
      return tx.insert('movements', { catalogId: id, kind, name: item.name, delta: after - item.stock, before: item.stock, after, reason, operationId: body.operationId });
    });
  }
  async function previewPrices(kind, body) {
    if (!CATALOGS.includes(kind)) throw new d.AppError('Catálogo inválido.');
    const basisPoints = d.parsePercent(body.percent);
    const rows = (await store.list(kind, { active: true })).filter(row => kind !== 'books' || row.condition === 'novo').map(row => ({ id: row._id, name: row.name, version: row.version, before: row.priceCents, after: d.reprice(row.priceCents, basisPoints) }));
    if (rows.length > 1000) throw new d.AppError('Divida o reajuste em lotes menores de até 1.000 produtos.');
    if (rows.some(row => row.after < 1 || row.after > 100_000_000)) throw new d.AppError('O reajuste produziria preços fora dos limites permitidos.');
    return { kind, basisPoints, rows, operationId: randomUUID(), expires: Date.now() + 15 * 60_000 };
  }
  async function applyPrices(preview) {
    if (!preview.rows.length) throw new d.AppError('Não há preços para alterar.');
    return store.atomic(async tx => {
      if ((await tx.list('priceChanges', { operationId: preview.operationId })).length) throw new d.AppError('Este reajuste já foi aplicado.', 409);
      for (const row of preview.rows) {
        const item = await tx.get(preview.kind, row.id);
        if (!item || !item.active || (preview.kind === 'books' && item.condition !== 'novo') || item.priceCents !== row.before) throw new d.AppError('O catálogo mudou. Gere uma nova prévia.', 409);
        await tx.update(preview.kind, row.id, row.version, { priceCents: row.after });
        await tx.insert('priceChanges', { kind: preview.kind, catalogId: row.id, name: item.name, before: row.before, after: row.after, operationId: preview.operationId });
      }
    });
  }
  async function data() {
    const names = ['products', 'books', 'orders', 'devices', 'campaigns', 'volunteers', 'kits', 'movements'];
    const values = await Promise.all(names.map(name => store.list(name)));
    return Object.fromEntries(names.map((name, i) => [name, values[i]]));
  }
  async function toggle(kind, id, body) {
    if (!['products', 'books', 'volunteers', 'kits', 'campaigns'].includes(kind)) throw new d.AppError('Cadastro inválido.');
    const item = await required(kind, id);
    return store.update(kind, id, body.version, { active: !item.active });
  }
  async function saveSetting(kind, id, body) {
    let value;
    if (kind === 'volunteers') value = d.validate(d.volunteerSchema, body);
    else if (kind === 'campaigns') value = d.validate(d.campaignSchema, { ...body, goalCents: d.parseMoney(body.goal) });
    else if (kind === 'kits') {
      let components;
      try { components = JSON.parse(body.components || '[]'); } catch { throw new d.AppError('A composição do kit é inválida.'); }
      if (!Array.isArray(components) || !components.length || components.length > 30) throw new d.AppError('Adicione de 1 a 30 componentes ao kit.');
      const seen = new Set();
      for (const c of components) {
        if (!c || typeof c !== 'object' || !CATALOGS.includes(c.kind) || !Number.isSafeInteger(c.quantity) || c.quantity < 1 || c.quantity > 1000) throw new d.AppError('Componente inválido.');
        const item = await required(c.kind, c.catalogId);
        if (!item.active || seen.has(c.catalogId)) throw new d.AppError('Use componentes ativos, sem repetição.');
        seen.add(c.catalogId); c.name = item.name;
      }
      value = { name: String(body.name || '').trim(), description: String(body.description || '').trim(), priceCents: d.parseMoney(body.price), components: components.map(({ catalogId, kind, name, quantity }) => ({ catalogId, kind, name, quantity })) };
      if (!value.name || value.name.length > 180 || value.description.length > 300 || value.priceCents < 1) throw new d.AppError('Confira o nome e o preço do kit.');
    } else throw new d.AppError('Cadastro inválido.');
    if (id) { await required(kind, id); return store.update(kind, id, body.version, value); }
    return store.insert(kind, value);
  }
  return { required, saveCatalog, stock, previewPrices, applyPrices, data, toggle, saveSetting };
}
module.exports = { createServices };
