export const SERVER: string = import.meta.env.VITE_IP_SERVER ?? 'http://127.0.0.1:8765'
export const SERVER_HOST = SERVER.replace(/^https?:\/\//, '')
