/**
 * Authentication middleware for dashboard routes
 * Protects admin routes by checking session authentication
 */

export function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }

  res.status(401).json({ error: 'Unauthorized' });
}

export function checkAuth(req, res) {
  res.json({
    authenticated: !!(req.session && req.session.authenticated),
    username: req.session?.username || null
  });
}
