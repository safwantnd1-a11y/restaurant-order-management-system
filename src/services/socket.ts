import { io, Socket } from 'socket.io-client';

const customUrl = localStorage.getItem('__roms_server_ip');
export let socket: Socket = io(customUrl || window.location.origin);

export const reconnectSocket = (url: string) => {
  socket.disconnect();
  socket = io(url);
};

export default socket;
