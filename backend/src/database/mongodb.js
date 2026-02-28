// backend/src/database/mongodb.js
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const uri = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_CLUSTER}/${process.env.MONGODB_DATABASE}?retryWrites=true&w=majority`;
        
        await mongoose.connect(uri);
        console.log('✅ MongoDB Conectado!');
    } catch (error) {
        console.error('Erro:', error);
    }
};