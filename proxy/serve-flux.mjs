import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// A separate localhost origin keeps the proxy worker away from Flux's app data.
const app = express();
const fluxRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
app.use((req, res, next) => {
  if (/^\/(?:proxy|node_modules|api)(?:\/|$)/i.test(req.path)) return res.sendStatus(404);
  next();
});
app.use(express.static(fluxRoot, { dotfiles: 'deny' }));
app.listen(3031, '127.0.0.1', () => console.log('Flux: http://127.0.0.1:3031/ — select Browser in the sidebar.'));
