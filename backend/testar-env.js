const dotenv = require('dotenv');
dotenv.config();

console.log('=== TESTE DO .ENV ===\n');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '✅ configurada' : '❌ não configurada');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ configurado' : '❌ não configurado');
console.log('PORT:', process.env.PORT);

if (process.env.MONGODB_URI) {
    // Mostrar a URI escondendo a senha
    const uri = process.env.MONGODB_URI;
    const senha = uri.match(/:(.*)@/)?.[1];
    if (senha) {
        const uriEscondida = uri.replace(senha, '******');
        console.log('\n📡 URI (senha oculta):', uriEscondida);
    }
}