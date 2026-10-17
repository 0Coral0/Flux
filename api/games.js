// /api/games.js
import gameList from '../data.js'; // adjust path

export default function handler(req, res) {
    res.status(200).json(gameList);
}
