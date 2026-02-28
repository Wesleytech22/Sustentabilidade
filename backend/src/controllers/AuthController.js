const User = require('../models/User');
const jwt = require('jsonwebtoken');

class AuthController {
    async register(req, res) {
        try {
            const { email, password, name, phone, city, state } = req.body;

            // Verificar se usuário já existe
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ error: 'Email já cadastrado' });
            }

            // Criar usuário
            const user = new User({
                email,
                password,
                name,
                phone,
                city,
                state
            });

            await user.save();

            // Gerar token
            const token = jwt.sign(
                { id: user._id, email: user.email, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN }
            );

            res.status(201).json({ user, token });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }

    async login(req, res) {
        try {
            const { email, password } = req.body;

            // Buscar usuário
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(401).json({ error: 'Email ou senha inválidos' });
            }

            // Validar senha
            const isValid = await user.comparePassword(password);
            if (!isValid) {
                return res.status(401).json({ error: 'Email ou senha inválidos' });
            }

            // Gerar token
            const token = jwt.sign(
                { id: user._id, email: user.email, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN }
            );

            res.json({ user, token });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }

    async profile(req, res) {
        try {
            const user = await User.findById(req.userId);
            res.json(user);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new AuthController();