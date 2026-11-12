const crypto = require('node:crypto');
const { AppError } = require('./domain');
function createSecurity(secret, production) {
  const sign = value => crypto.createHmac('sha256', secret).update(value).digest('base64url');
  const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  const pack = data => { const value = Buffer.from(JSON.stringify(data)).toString('base64url'); return `${value}.${sign(value)}`; };
  function unpack(token) {
    const [value, signature] = String(token || '').split('.');
    if (!value || !equal(sign(value), signature)) throw new AppError('A prévia não é válida. Gere uma nova prévia.', 403);
    let data;
    try { data = JSON.parse(Buffer.from(value, 'base64url').toString()); } catch { throw new AppError('Prévia inválida.'); }
    if (data.expires < Date.now()) throw new AppError('A prévia expirou. Confira os preços novamente.', 409);
    return data;
  }
  function csrf(req, res, next) {
    let token = req.cookies.ca_csrf;
    const [value, signature] = String(token || '').split('.');
    if (!value || !equal(sign(value), signature)) {
      const nonce = crypto.randomBytes(24).toString('hex');
      token = `${nonce}.${sign(nonce)}`;
      res.cookie('ca_csrf', token, { httpOnly: true, sameSite: 'lax', secure: production, path: '/', maxAge: 8 * 3_600_000 });
    }
    res.locals.csrf = token;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !equal(req.body?._csrf, token)) return next(new AppError('O formulário expirou. Atualize a página e tente novamente.', 403));
    next();
  }
  return { pack, unpack, csrf };
}
module.exports = { createSecurity };
