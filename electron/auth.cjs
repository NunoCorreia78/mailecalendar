const { shell } = require('electron');
const http = require('node:http');
const url = require('node:url');
const { randomBytes } = require('node:crypto');

// ID Público de demonstração para a App Desktop. O ideal é usar PKCE para clientes nativos.
const GOOGLE_CLIENT_ID = '930282193557-41804n1c714e8eqqll6j39162g3sh566.apps.googleusercontent.com'; // Exemplo fictício ou real dependendo do setup
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

async function authenticateGoogle() {
  return new Promise((resolve, reject) => {
    const state = randomBytes(16).toString('hex');
    
    // Servidor web local temporário para receber o "callback" do browser
    const server = http.createServer(async (req, res) => {
      try {
        const parsedUrl = url.parse(req.url, true);
        
        if (parsedUrl.pathname === '/callback') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h1 style="font-family: sans-serif; text-align: center; margin-top: 50px;">Autenticação recebida! Pode fechar esta janela e voltar à aplicação.</h1>');
          
          server.close();
          
          if (parsedUrl.query.error) {
            reject(new Error(parsedUrl.query.error));
            return;
          }
          
          if (parsedUrl.query.state !== state) {
            reject(new Error('State mismatch / Possível ataque CSRF'));
            return;
          }
          
          // O authorization code retornado pelo Google. Com PKCE trocaríamos por um Token
          resolve({ code: parsedUrl.query.code });
        }
      } catch (err) {
        reject(err);
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const redirectUri = `http://127.0.0.1:${port}/callback`;
      
      const scopes = [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/calendar'
      ].join(' ');

      const authUrl = `${GOOGLE_AUTH_URL}?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${state}&access_type=offline&prompt=consent`;
      
      // Abre o browser padrão do SO (Chrome, Edge, etc.)
      shell.openExternal(authUrl);
    });
  });
}

module.exports = { authenticateGoogle };
