db = db.getSiblingDB('ecoroute');

// Criar coleções
db.createCollection('users');
db.createCollection('collectionpoints');
db.createCollection('routes');
db.createCollection('collections');

// Criar índices
db.users.createIndex({ "email": 1 }, { unique: true });
db.collectionpoints.createIndex({ "userId": 1 });
db.collectionpoints.createIndex({ "location": "2dsphere" });
db.routes.createIndex({ "userId": 1 });
db.routes.createIndex({ "date": -1 });
db.collections.createIndex({ "collectionPointId": 1 });
db.collections.createIndex({ "date": -1 });

print("✅ Banco de dados inicializado com sucesso!");