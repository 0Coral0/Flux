process.env.PORT ||= '3040';
await import('./server.mjs');
await import('./serve-flux.mjs');