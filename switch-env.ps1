param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "docker", "prod")]
    [string]$Env
)

Write-Host "🔄 Configurando ambiente: $Env" -ForegroundColor Yellow

$backendEnvPath = "backend\.env"

switch ($Env) {
    "dev" {
        @"
# MongoDB Local (desenvolvimento)
MONGODB_URI="mongodb://localhost:27017/ecoroute-dev"
JWT_SECRET="dev-secret-key-2024"
JWT_EXPIRES_IN="7d"
PORT=3000
NODE_ENV=development
"@ | Set-Content $backendEnvPath
        Write-Host "✅ Ambiente de desenvolvimento configurado" -ForegroundColor Green
        Write-Host "📝 Use: cd backend; node app.js" -ForegroundColor Cyan
    }
    "docker" {
        @"
# MongoDB Docker
MONGODB_URI="mongodb://admin:admin123@localhost:27017/ecoroute?authSource=admin"
JWT_SECRET="docker-secret-key-2024"
JWT_EXPIRES_IN="7d"
PORT=3000
NODE_ENV=development
"@ | Set-Content $backendEnvPath
        Write-Host "✅ Ambiente Docker configurado" -ForegroundColor Green
        Write-Host "📝 Use: docker-compose up --build" -ForegroundColor Cyan
    }
    "prod" {
        @"
# MongoDB Atlas (produção)
MONGODB_URI="mongodb+srv://wesleyMD:hmfDrXCB3jJO1Zqg@sustentabilidade.cn2gymg.mongodb.net/ecoroute?retryWrites=true&w=majority"
JWT_SECRET="ecoroute-super-secret-key-2024"
JWT_EXPIRES_IN="7d"
PORT=3000
NODE_ENV=production
"@ | Set-Content $backendEnvPath
        Write-Host "✅ Ambiente de produção configurado" -ForegroundColor Green
        Write-Host "📝 Use: cd backend; node app.js" -ForegroundColor Cyan
    }
}

Write-Host ""
Write-Host "📋 Arquivo backend\.env atual:" -ForegroundColor Magenta
Get-Content $backendEnvPath