import axios from 'axios';

const api = axios.create({
  // Coloque aqui a porta onde o seu BACK-END em Node está rodando (ex: 3000)
  baseURL: 'http://localhost:3333',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Configuração opcional: Envia o token JWT automaticamente em todas as requisições se ele existir
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token'); // Ou o nome que você deu para salvar o token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
