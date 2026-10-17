// /api/popular-games.js

// Example static data — replace with DB for real counts
let games = [
  { name: "Big Tower Tiny Square 2", plays: 120 },
  { name: "Pixel Racer", plays: 95 },
  { name: "Escape Classroom", plays: 75 },
  { name: "Sky Jumpers", plays: 50 }
];

export default function handler(req, res) {
  // Sort descending by plays
  const sorted = [...games].sort((a, b) => b.plays - a.plays);
  res.status(200).json(sorted);
}
