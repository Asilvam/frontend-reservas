import axios from 'axios';
import { io } from 'socket.io-client';

const BACKEND_URL = 'http://localhost:3500'; // Ajustar en produccion

export const api = axios.create({
  baseURL: BACKEND_URL,
  headers: { 'Content-Type': 'application/json' },
});

export const socket = io(BACKEND_URL, {
  autoConnect: false, // Fundamental: lo conectaremos solo cuando React este listo
});
