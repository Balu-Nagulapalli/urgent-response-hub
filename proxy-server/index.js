const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

const SN_INSTANCE = process.env.SN_INSTANCE;
const SN_USERNAME = process.env.SN_USERNAME;
const SN_PASSWORD = process.env.SN_PASSWORD;
const SN_BASE_URL = SN_INSTANCE ? `https://${SN_INSTANCE.replace(/^https?:\/\//, '')}` : '';

const snAuth = SN_USERNAME && SN_PASSWORD
  ? { auth: { username: SN_USERNAME, password: SN_PASSWORD } }
  : null;

function ensureProxyConfigured() {
  if (!SN_INSTANCE || !SN_USERNAME || !SN_PASSWORD) {
    throw new Error('Proxy ServiceNow credentials are not configured. Check proxy-server/.env.');
  }
}

function sanitizeError(err) {
  return err?.response?.data?.error?.message || err?.response?.data?.error || err?.message || 'Request failed';
}

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    proxy: 'service-now',
    configured: Boolean(SN_INSTANCE && SN_USERNAME && SN_PASSWORD),
  });
});

// Validate end-user credentials against ServiceNow without exposing server credentials.
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({
        error: 'Username and password are required.',
        code: 'validation_error',
      });
    }

    ensureProxyConfigured();

    const response = await axios.get(
      `${SN_BASE_URL}/api/now/table/sys_user`,
      {
        auth: { username, password },
        params: {
          sysparm_query: `user_name=${encodeURIComponent(username)}`,
          sysparm_fields: 'sys_id,user_name,first_name,last_name,email',
          sysparm_limit: 1,
        },
        headers: { Accept: 'application/json' },
      }
    );

    const user = response?.data?.result?.[0];
    if (!user) {
      return res.status(401).json({
        error: 'Invalid username or password.',
        code: 'unauthorized',
      });
    }

    return res.json({ user });
  } catch (err) {
    const status = err?.response?.status || 500;
    const message = sanitizeError(err);
    return res.status(status).json({
      error: status === 401 ? 'Invalid username or password.' : message,
      code: status === 401 ? 'unauthorized' : 'login_error',
    });
  }
});

app.get('/api/incidents', async (req, res) => {
  try {
    ensureProxyConfigured();
    const response = await axios.get(
      `${SN_BASE_URL}/api/now/table/incident`,
      {
        ...snAuth,
        params: req.query,
        headers: { Accept: 'application/json' },
      }
    );
    res.json(response.data);
  } catch (err) {
    res.status(err?.response?.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/incidents', async (req, res) => {
  try {
    ensureProxyConfigured();
    const response = await axios.post(
      `${SN_BASE_URL}/api/now/table/incident`,
      req.body,
      {
        ...snAuth,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      }
    );
    res.json(response.data);
  } catch (err) {
    res.status(err?.response?.status || 500).json({ error: sanitizeError(err) });
  }
});

app.get('/api/incidents/:id', async (req, res) => {
  try {
    ensureProxyConfigured();
    const response = await axios.get(
      `${SN_BASE_URL}/api/now/table/incident/${req.params.id}`,
      {
        ...snAuth,
        params: req.query,
        headers: { Accept: 'application/json' },
      }
    );
    res.json(response.data);
  } catch (err) {
    res.status(err?.response?.status || 500).json({ error: sanitizeError(err) });
  }
});

app.patch('/api/incidents/:id', async (req, res) => {
  try {
    ensureProxyConfigured();
    const response = await axios.patch(
      `${SN_BASE_URL}/api/now/table/incident/${req.params.id}`,
      req.body,
      {
        ...snAuth,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      }
    );
    res.json(response.data);
  } catch (err) {
    res.status(err?.response?.status || 500).json({ error: sanitizeError(err) });
  }
});

app.get('/api/incidents/:id/activity', async (req, res) => {
  try {
    ensureProxyConfigured();
    const response = await axios.get(
      `${SN_BASE_URL}/api/now/table/sys_journal_field`,
      {
        ...snAuth,
        params: {
          sysparm_query: `element_id=${req.params.id}^element=work_notes^ORelement=comments`,
          sysparm_fields: 'value,sys_created_by,sys_created_on,element',
          sysparm_orderby: 'sys_created_ondesc',
          sysparm_limit: 50,
        },
        headers: { Accept: 'application/json' },
      }
    );
    res.json(response.data);
  } catch (err) {
    res.status(err?.response?.status || 500).json({ error: sanitizeError(err) });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Proxy running on http://localhost:${PORT}`);
});
