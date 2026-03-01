const dotenv = require('dotenv');
dotenv.config();

console.log('=== TESTE DO .ENV ===\n');
console.log('📊 MONGODB:');
console.log('  MONGODB_URI:', process.env.MONGODB_URI ? '✅ configurada' : '❌ não configurada');
console.log('  JWT_SECRET:', process.env.JWT_SECRET ? '✅ configurado' : '❌ não configurado');
console.log('  PORT:', process.env.PORT || '3000 (padrão)');
console.log('  NODE_ENV:', process.env.NODE_ENV || 'development (padrão)');

if (process.env.MONGODB_URI) {
    // Mostrar a URI escondendo a senha
    const uri = process.env.MONGODB_URI;
    const senha = uri.match(/:(.*)@/)?.[1];
    if (senha) {
        const uriEscondida = uri.replace(senha, '******');
        console.log('\n📡 MongoDB URI (senha oculta):', uriEscondida);
    }
}

console.log('\n📧 EMAIL:');
console.log('  EMAIL_HOST:', process.env.EMAIL_HOST || '❌ não configurado');
console.log('  EMAIL_PORT:', process.env.EMAIL_PORT || '❌ não configurado');
console.log('  EMAIL_USER:', process.env.EMAIL_USER ? '✅ ' + process.env.EMAIL_USER : '❌ não configurado');
console.log('  EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ configurada (tamanho: ' + process.env.EMAIL_PASS.length + ' caracteres)' : '❌ não configurada');
console.log('  EMAIL_FROM:', process.env.EMAIL_FROM || '❌ não configurado');
console.log('  FRONTEND_URL:', process.env.FRONTEND_URL || '❌ não configurado');

console.log('\n🔧 REDIS:');
console.log('  REDIS_HOST:', process.env.REDIS_HOST || 'localhost (padrão)');
console.log('  REDIS_PORT:', process.env.REDIS_PORT || '6379 (padrão)');

console.log('\n🔌 SOCKET:');
console.log('  SOCKET_PORT:', process.env.SOCKET_PORT || '3001 (padrão)');

console.log('\n=== FIM DO TESTE ===');