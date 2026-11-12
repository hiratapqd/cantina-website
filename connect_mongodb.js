const path = require('node:path');
const envResult = require('dotenv').config({
    path: path.join(__dirname, '.env'),
    quiet: true
});
const mongoose = require('mongoose');

class ConfigurationError extends Error {}

async function testConnection() {
    try {
        // Variáveis do ambiente (por exemplo, no Render) têm prioridade sobre o .env.
        if (envResult.error && envResult.error.code !== 'ENOENT') {
            throw new ConfigurationError('Não foi possível ler o arquivo .env.');
        }
        const uri = process.env.MONGODB_URI?.trim();
        if (!uri) {
            throw new ConfigurationError('Defina MONGODB_URI no arquivo .env ou no ambiente.');
        }
        if (!/^mongodb(?:\+srv)?:\/\//.test(uri)) {
            throw new ConfigurationError('MONGODB_URI deve começar com mongodb:// ou mongodb+srv://.');
        }

        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000,
            socketTimeoutMS: 5000,
            autoCreate: false,
            autoIndex: false
        });
        await mongoose.connection.db.command({ ping: 1 }, { maxTimeMS: 5000 });
        console.log('Sucesso: conexão com o MongoDB e ping confirmados.');

        const db = mongoose.connection.db;
        const collections = await db.listCollections({}, {
            nameOnly: true,
            maxTimeMS: 5000
        }).toArray();

        console.log(`Banco selecionado: ${db.databaseName}`);
        console.log(`Collections encontradas: ${collections.length}`);
        if (collections.length === 0) {
            console.log('Nenhuma collection encontrada neste banco.');
        } else {
            const names = collections.map(collection => collection.name).sort();
            for (const name of names) {
                console.log(`- ${name}`);
            }
        }
    } catch (err) {
        process.exitCode = 1;
        // Não imprimir a URI ou o erro completo, que pode conter credenciais.
        if (err instanceof ConfigurationError) {
            console.error(err.message);
        } else if (err.code === 18) {
            console.error('Falha de autenticação no MongoDB. Confira usuário, senha e authSource.');
        } else if (err.code === 13) {
            console.error('O usuário do MongoDB não tem permissão para executar esta operação. Confira a permissão listCollections no banco selecionado.');
        } else {
            console.error('Falha na conexão, no ping ou na listagem de collections do MongoDB.');
            console.error(`Tipo: ${err.name}. Confira a URI, DNS, rede e permissões de acesso.`);
        }
    } finally {
        try {
            await mongoose.disconnect();
            console.log('Teste encerrado; conexões liberadas.');
        } catch {
            process.exitCode = 1;
            console.error('Não foi possível encerrar a conexão normalmente.');
        }
    }
}

testConnection();
