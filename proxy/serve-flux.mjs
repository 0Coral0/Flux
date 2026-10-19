import express from 'express';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

// A separate localhost origin keeps the proxy worker away from Flux's app data.
const app = express();
const fluxRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
app.use((req, res, next) => {
  let publicPath;
  try { publicPath = posix.normalize(decodeURIComponent(req.path).replaceAll('\\', '/')); }
  catch { return res.sendStatus(400); }
  if (/^\/(?:proxy|discord-bridge|node_modules|api)(?:\/|$)/i.test(publicPath)) return res.sendStatus(404);
  next();
});
app.use(express.static(fluxRoot, { dotfiles: 'deny' }));
app.listen(3031, '127.0.0.1', () => console.log('Flux: http://127.0.0.1:3031/ — select Browser in the sidebar.'));
