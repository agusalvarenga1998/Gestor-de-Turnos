import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// El directorio raíz del servidor (donde está package.json del server)
export const serverRootDir = path.join(__dirname, '..', '..');
export const uploadsDir = path.join(serverRootDir, 'uploads');
