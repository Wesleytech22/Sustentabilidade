const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Caminho absoluto para o .env
const envPath = path.resolve(__dirname, '.env');
console.log('📁 Caminho do .env:', envPath);

// Verificar se o arquivo existe
if (fs.existsSync(envPath)) {
    console.log('✅ Arquivo .env encontrado!');
    
    // Mostrar o conteúdo do arquivo (primeiras linhas)
    const conteudo = fs.readFileSync(envPath, 'utf8');
    console.log('\n📄 Conteúdo do arquivo:');
    console.log(conteudo);
    
    // Forçar o carregamento com caminho absoluto
    const resultado = dotenv.config({ path: envPath });
    
    if (resultado.error) {
        console.error('❌ Erro ao carregar:', resultado.error);
    } else {
        console.log('\n✅ .env carregado com sucesso!\n');
        
        // Mostrar as variáveis carregadas
        console.log('=== VARIÁVEIS CARREGADAS ===');
        console.log('MONGODB_URI:', process.env.MONGODB_URI || '❌');
        console.log('EMAIL_USER:', process.env.EMAIL_USER || '❌');
        console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ (oculta)' : '❌');
        console.log('JWT_SECRET:', process.env.JWT_SECRET || '❌');
    }
} else {
    console.error('❌ Arquivo .env NÃO encontrado!');
    console.log('📌 Certifique-se de que o arquivo .env existe em:', envPath);
}