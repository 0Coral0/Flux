let users = new Set();

export default function handler(req, res) {
  const { id, action } = req.query;

  if (!id) return res.status(400).json({ error: "Missing user ID" });

  if (action === "join") {
    users.add(id);
    // Remove after 5 minutes automatically
    setTimeout(() => users.delete(id), 300000);
  } else if (action === "leave") {
    users.delete(id);
  }

  res.status(200).json({ active: users.size });
}
