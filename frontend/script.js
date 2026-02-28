// API Configuration
const API_URL = 'http://localhost:3000/api';
let authToken = localStorage.getItem('token');
let currentUser = null;

// ========== UTILITIES ==========

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showLoading() {
    document.getElementById('loadingModal').classList.add('show');
}

function hideLoading() {
    document.getElementById('loadingModal').classList.remove('show');
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// ========== AUTHENTICATION ==========

// Login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    showLoading();
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('token', authToken);
            localStorage.setItem('user', JSON.stringify(currentUser));
            
            showToast('Login realizado com sucesso!');
            showDashboard();
        } else {
            showToast(data.error || 'Erro ao fazer login', 'error');
        }
    } catch (error) {
        showToast('Erro de conexão com o servidor', 'error');
    } finally {
        hideLoading();
    }
});

// Register
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const userData = {
        email: document.getElementById('regEmail').value,
        password: document.getElementById('regPassword').value,
        name: document.getElementById('regName').value,
        phone: document.getElementById('regPhone').value,
        city: document.getElementById('regCity').value,
        state: document.getElementById('regState').value
    };
    
    showLoading();
    
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Cadastro realizado com sucesso! Faça login.');
            showLogin();
        } else {
            showToast(data.error || 'Erro ao cadastrar', 'error');
        }
    } catch (error) {
        showToast('Erro de conexão com o servidor', 'error');
    } finally {
        hideLoading();
    }
});

// Logout
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    authToken = null;
    currentUser = null;
    showLogin();
}

// ========== UI NAVIGATION ==========

function showLogin() {
    document.getElementById('loginContainer').style.display = 'flex';
    document.getElementById('registerContainer').style.display = 'none';
    document.getElementById('dashboardContainer').style.display = 'none';
}

function showRegister() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('registerContainer').style.display = 'flex';
    document.getElementById('dashboardContainer').style.display = 'none';
}

function showDashboard() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('registerContainer').style.display = 'none';
    document.getElementById('dashboardContainer').style.display = 'flex';
    
    // Carregar dados do usuário
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        document.getElementById('userName').textContent = user.name;
        document.getElementById('userRole').textContent = 
            user.role === 'ADMIN' ? 'Administrador' : 'Cooperativa';
    }
    
    // Atualizar data
    document.getElementById('currentDate').textContent = 
        new Date().toLocaleDateString('pt-BR', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    
    // Carregar dados
    loadDashboardData();
    loadPoints();
    loadRoutes();
}

function showSection(section) {
    // Atualizar active na sidebar
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.classList.remove('active');
    });
    event.target.closest('a').classList.add('active');
    
    // Esconder todas as seções
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Mostrar seção selecionada
    document.getElementById(`${section}Section`).style.display = 'block';
    
    // Atualizar título
    const titles = {
        'dashboard': 'Dashboard',
        'points': 'Pontos de Coleta',
        'routes': 'Rotas Otimizadas',
        'impact': 'Impacto Ambiental'
    };
    document.getElementById('pageTitle').textContent = titles[section];
}

// ========== DASHBOARD ==========

async function loadDashboardData() {
    try {
        // Simular dados (depois substituir por chamadas reais à API)
        document.getElementById('statPoints').textContent = '12';
        document.getElementById('statRoutes').textContent = '5';
        document.getElementById('statWaste').textContent = '2.450 kg';
        document.getElementById('statCarbon').textContent = '324 kg';
        document.getElementById('treesSaved').textContent = '48';
        document.getElementById('waterSaved').textContent = '12.500 L';
        document.getElementById('energySaved').textContent = '850 kWh';
        
        // Inicializar gráficos
        initCharts();
    } catch (error) {
        showToast('Erro ao carregar dados', 'error');
    }
}

function initCharts() {
    // Gráfico de Coletas por Tipo
    const ctx1 = document.getElementById('wasteChart').getContext('2d');
    new Chart(ctx1, {
        type: 'doughnut',
        data: {
            labels: ['Plástico', 'Papel', 'Vidro', 'Metal'],
            datasets: [{
                data: [850, 1200, 400, 2450],
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4CAF50'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
    
    // Gráfico de Impacto Ambiental
    const ctx2 = document.getElementById('impactChart').getContext('2d');
    new Chart(ctx2, {
        type: 'line',
        data: {
            labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
            datasets: [{
                label: 'CO₂ Economizado (kg)',
                data: [120, 190, 300, 450, 520, 324],
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// ========== PONTOS DE COLETA ==========

async function loadPoints() {
    const pointsGrid = document.getElementById('pointsGrid');
    
    // Dados simulados (depois substituir por chamada à API)
    const mockPoints = [
        {
            id: 1,
            name: 'Cooperativa Recicla Vida',
            address: 'Rua das Flores, 123',
            city: 'São Paulo',
            state: 'SP',
            types: ['plastico', 'papel', 'vidro'],
            capacity: 5000,
            currentVolume: 2350
        },
        {
            id: 2,
            name: 'Ecoponto Vila Nova',
            address: 'Av. Principal, 456',
            city: 'São Paulo',
            state: 'SP',
            types: ['metal', 'papel', 'plastico'],
            capacity: 3000,
            currentVolume: 1200
        },
        {
            id: 3,
            name: 'Ponto Verde Centro',
            address: 'Praça Central, 789',
            city: 'São Paulo',
            state: 'SP',
            types: ['vidro', 'metal', 'papel'],
            capacity: 4000,
            currentVolume: 3100
        }
    ];
    
    pointsGrid.innerHTML = mockPoints.map(point => `
        <div class="point-card">
            <h3>${point.name}</h3>
            <p class="point-address">
                <i class="fas fa-map-marker-alt"></i>
                ${point.address}, ${point.city} - ${point.state}
            </p>
            <div class="point-types">
                ${point.types.map(type => 
                    `<span class="type-tag">${type}</span>`
                ).join('')}
            </div>
            <p class="point-capacity">
                <i class="fas fa-weight-hanging"></i>
                Capacidade: ${point.currentVolume}/${point.capacity} kg
            </p>
        </div>
    `).join('');
}

function filterPoints() {
    const search = document.getElementById('pointSearch').value.toLowerCase();
    const filter = document.getElementById('pointFilter').value;
    
    // Implementar filtro
    console.log('Filtrar pontos:', { search, filter });
}

function showAddPointModal() {
    document.getElementById('pointModal').classList.add('show');
}

// ========== ROTAS ==========

async function loadRoutes() {
    const routesList = document.getElementById('routesList');
    
    // Dados simulados
    const mockRoutes = [
        {
            id: 1,
            name: 'Rota Zona Norte',
            date: '2026-03-01',
            points: 5,
            distance: 45.2,
            waste: 1200,
            status: 'PLANNED'
        },
        {
            id: 2,
            name: 'Rota Centro',
            date: '2026-03-01',
            points: 8,
            distance: 32.5,
            waste: 2450,
            status: 'COMPLETED'
        }
    ];
    
    routesList.innerHTML = mockRoutes.map(route => `
        <div class="point-card">
            <div style="display: flex; justify-content: space-between;">
                <h3>${route.name}</h3>
                <span class="type-tag" style="background: ${route.status === 'COMPLETED' ? '#4CAF50' : '#FFA500'}; color: white;">
                    ${route.status}
                </span>
            </div>
            <p><i class="fas fa-calendar"></i> ${formatDate(route.date)}</p>
            <p><i class="fas fa-map-marker-alt"></i> ${route.points} pontos</p>
            <p><i class="fas fa-road"></i> ${route.distance} km</p>
            <p><i class="fas fa-weight-hanging"></i> ${route.waste} kg</p>
        </div>
    `).join('');
}

function showOptimizeRouteModal() {
    showToast('Funcionalidade em desenvolvimento', 'success');
}

// ========== MODALS ==========

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

// Formulário de Ponto de Coleta
document.getElementById('pointForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const pointData = {
        name: document.getElementById('pointName').value,
        address: document.getElementById('pointAddress').value,
        city: document.getElementById('pointCity').value,
        state: document.getElementById('pointState').value,
        latitude: parseFloat(document.getElementById('pointLat').value),
        longitude: parseFloat(document.getElementById('pointLng').value),
        capacity: parseFloat(document.getElementById('pointCapacity').value),
        wasteTypes: Array.from(document.querySelectorAll('#pointForm input[type="checkbox"]:checked'))
            .map(cb => cb.value)
    };
    
    showLoading();
    
    try {
        // Simular criação (depois substituir por chamada à API)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        showToast('Ponto de coleta criado com sucesso!');
        closeModal('pointModal');
        loadPoints();
        
        // Limpar formulário
        document.getElementById('pointForm').reset();
    } catch (error) {
        showToast('Erro ao criar ponto', 'error');
    } finally {
        hideLoading();
    }
});

// ========== INITIALIZATION ==========

// Verificar se usuário já está logado
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
        currentUser = JSON.parse(user);
        showDashboard();
    } else {
        showLogin();
    }
});

// Fechar modal ao clicar fora
window.onclick = (event) => {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('show');
    }
};