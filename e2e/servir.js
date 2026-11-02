const http = require('http'),
  fs = require('fs'),
  path = require('path');
const raiz = process.argv[2];
const tipos = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
http
  .createServer((req, res) => {
    let arq = path.join(raiz, decodeURIComponent(req.url.split('?')[0]));
    if (!fs.existsSync(arq) || fs.statSync(arq).isDirectory()) arq = path.join(raiz, 'index.html');
    res.writeHead(200, { 'Content-Type': tipos[path.extname(arq)] || 'application/octet-stream' });
    fs.createReadStream(arq).pipe(res);
  })
  .listen(8090, () => console.log('servindo 8090'));
