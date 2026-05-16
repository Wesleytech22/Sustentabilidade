const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/ecoroute-dev')
    .then(() => {
        console.log('✅ Conectado ao MongoDB local!');
        process.exit(0);
    })
    .catch(e => {
        console.error('❌ Erro:', e.message);
        process.exit(1);
    });