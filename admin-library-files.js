const fs = require('fs');
const path = require('path');

const GAME_EXTENSIONS = new Set(['.html', '.htm']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif', '.bmp', '.ico', '.tif', '.tiff']);

function normalizePath(value) {
  return String(value || '').trim().replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
}

function readGameList(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const start = source.indexOf('[');
  const end = source.lastIndexOf(']');
  if (start < 0 || end < start) throw new Error('data.js does not contain a game list.');
  const games = JSON.parse(source.slice(start, end + 1));
  if (!Array.isArray(games)) throw new Error('data.js does not contain an array.');
  return games;
}

function listMatchingFiles(root, directory, extensions) {
  const folder = path.join(root, directory);
  if (!fs.existsSync(folder)) return [];
  const found = [];
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const filePath = path.join(current, entry.name);
      if (entry.isDirectory()) walk(filePath);
      else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) {
        found.push(path.relative(root, filePath).split(path.sep).join('/'));
      }
    }
  };
  walk(folder);
  return found.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

function unusedPaths(paths, games, property) {
  const used = new Set(games.map(game => normalizePath(game?.[property])).filter(Boolean));
  return paths.filter(file => !used.has(normalizePath(file)));
}

function listUnusedGameAssets(root) {
  const games = readGameList(path.join(root, 'data.js'));
  const gameFiles = listMatchingFiles(root, 'Games', GAME_EXTENSIONS);
  const multifileGameFiles = listMatchingFiles(root, 'MultiFile Games', GAME_EXTENSIONS);
  const images = listMatchingFiles(root, 'Game Images', IMAGE_EXTENSIONS);
  return {
    gameFiles: unusedPaths(gameFiles, games, 'file'),
    multifileGameFiles: unusedPaths(multifileGameFiles, games, 'file'),
    images: unusedPaths(images, games, 'thumb'),
    totals: {
      gameFiles: gameFiles.length,
      multifileGameFiles: multifileGameFiles.length,
      images: images.length,
      listedGames: games.length
    }
  };
}

module.exports = { listUnusedGameAssets, normalizePath, unusedPaths };
