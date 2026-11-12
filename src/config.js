const path = require('node:path');
const crypto = require('node:crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const mode = process.env.DATA_MODE || (process.env.MONGODB_URI ? 'mongodb' : 'demo');
if (!['demo', 'mongodb'].includes(mode)) throw new Error('DATA_MODE deve ser demo ou mongodb.');
if (mode === 'mongodb' && !process.env.MONGODB_URI) throw new Error('Configure MONGODB_URI.');
if (process.env.NODE_ENV === 'production' && !process.env.APP_SECRET) {
  throw new Error('Configure APP_SECRET com pelo menos 32 caracteres para produção.');
}
if (process.env.APP_SECRET && process.env.APP_SECRET.length < 32) throw new Error('APP_SECRET precisa ter pelo menos 32 caracteres.');

module.exports = {
  mode,
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'),
  production: process.env.NODE_ENV === 'production',
  secret: process.env.APP_SECRET || crypto.randomBytes(32).toString('hex'),
  mongoUri: process.env.MONGODB_URI,
};
