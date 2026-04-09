import { io } from 'socket.io-client';

const customUrl = localStorage.getItem('__roms_server_ip');
const socket = io(customUrl || window.location.origin);

export default socket;
