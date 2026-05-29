export function extractBearerToken(headerValue) {
  const match = String(headerValue || '').match(/^bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function isWorkerAuthorized(expectedToken, providedToken) {
  return Boolean(expectedToken && providedToken && expectedToken === providedToken);
}

export function requireHostedUser(supabase) {
  return async (req, res, next) => {
    try {
      const token = extractBearerToken(req.headers.authorization);
      if (!token) return res.status(401).json({ error: 'Missing bearer token' });
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) return res.status(401).json({ error: 'Invalid bearer token' });
      req.authUser = data.user;
      req.authToken = token;
      return next();
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  };
}

export function requireWorker(config) {
  return (req, res, next) => {
    const provided = req.headers['x-ai-worker-token'];
    if (!isWorkerAuthorized(config.aiWorkerToken, provided)) {
      return res.status(401).json({ error: 'Invalid worker token' });
    }
    return next();
  };
}
