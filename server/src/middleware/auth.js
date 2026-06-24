const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const token = req.cookies?.deck_token;
  if (!token) {
    return res.status(401).json({ error: "Not signed in." });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Session expired. Please sign in again." });
  }
}

module.exports = { requireAuth };
