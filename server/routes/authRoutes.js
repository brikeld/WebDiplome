import express from 'express';

export function createAuthRoutes({ supabaseAnon }) {
  const router = express.Router();

  router.post('/signup', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const { data, error } = await supabaseAnon.auth.signUp({ email, password });
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ user: data.user, session: data.session });
  });

  router.post('/login', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message });
    return res.json({ user: data.user, session: data.session });
  });

  // Login-free device account. Creates a fresh anonymous Supabase user so the
  // desktop app is plug-and-play (no email/password). Requires "Allow anonymous
  // sign-ins" to be enabled in the Supabase dashboard (Authentication settings).
  router.post('/anonymous', async (_req, res) => {
    const { data, error } = await supabaseAnon.auth.signInAnonymously();
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ user: data.user, session: data.session });
  });

  // Exchange a refresh token for a new session so a device keeps the same
  // identity (and profile) after its access token expires.
  router.post('/refresh', async (req, res) => {
    const refreshToken = String(req.body?.refresh_token || req.body?.refreshToken || '').trim();
    if (!refreshToken) return res.status(400).json({ error: 'refresh_token required' });

    const { data, error } = await supabaseAnon.auth.refreshSession({ refresh_token: refreshToken });
    if (error) return res.status(401).json({ error: error.message });
    return res.json({ user: data.user, session: data.session });
  });

  return router;
}
