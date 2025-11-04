const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const path = require('path');
const fsp = require('fs/promises');
const os = require('os');

const { prepareKokoro } = require('../lib/prepareKokoro');

async function createServerWithPayload(payload) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
    res.end(payload);
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return { server, port };
}

test('prepareKokoro downloads, compresses, and records manifest data', async (t) => {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'kokoro-test-'));
  const workDir = path.join(tmp, 'workspace');
  await fsp.mkdir(path.join(workDir, 'extension', 'models'), { recursive: true });

  const payload = Buffer.from('kokoro test payload');
  const { server, port } = await createServerWithPayload(payload);
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const manifestPath = path.join(workDir, 'kokoro-assets.json');
  const sourceUrl = `http://127.0.0.1:${port}/kokoro.bin`;
  const manifest = {
    files: [
      {
        name: 'kokoro.bin',
        source: sourceUrl,
        compress: 'brotli',
      },
    ],
  };
  await fsp.writeFile(manifestPath, JSON.stringify(manifest));

  const originalCwd = process.cwd();
  process.chdir(workDir);
  t.after(() => process.chdir(originalCwd));

  const result = await prepareKokoro({ manifestPath });
  assert.equal(result.files.length, 1);
  const artifact = result.files[0];
  assert.equal(artifact.name, 'kokoro.bin');
  assert.equal(artifact.encoding, 'brotli');
  assert.equal(artifact.source, sourceUrl);
  assert.equal(artifact.reused, false);
  assert.ok(artifact.bytes > 0);
  assert.ok(artifact.compressedBytes > 0);
  assert.equal(typeof artifact.sha256, 'string');
  assert.equal(artifact.sha256.length, 64);

  const artifactPath = path.join(workDir, 'extension', 'models', 'kokoro.bin.br');
  const stats = await fsp.stat(artifactPath);
  assert.equal(stats.isFile(), true);

  const manifestOutputPath = path.join(workDir, 'extension', 'models', 'manifest.json');
  const storedManifest = JSON.parse(await fsp.readFile(manifestOutputPath, 'utf8'));
  assert.equal(storedManifest.files.length, 1);
  assert.equal(storedManifest.files[0].artifact, 'kokoro.bin.br');
  assert.equal(storedManifest.files[0].sha256, artifact.sha256);
});

test('prepareKokoro skips download when artifact exists', async (t) => {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'kokoro-test-'));
  const workDir = path.join(tmp, 'workspace');
  await fsp.mkdir(path.join(workDir, 'extension', 'models'), { recursive: true });

  const artifactPath = path.join(workDir, 'extension', 'models', 'existing.bin.br');
  await fsp.writeFile(artifactPath, Buffer.from('cached'));

  const manifestPath = path.join(workDir, 'kokoro-assets.json');
  await fsp.writeFile(
    manifestPath,
    JSON.stringify({
      files: [
        {
          name: 'existing.bin',
          source: 'http://localhost/not-used',
          compress: 'brotli',
        },
      ],
    })
  );

  const originalCwd = process.cwd();
  process.chdir(workDir);
  t.after(() => process.chdir(originalCwd));

  const result = await prepareKokoro({ manifestPath });
  assert.equal(result.files[0].reused, true);
  assert.equal(result.files[0].artifact, 'existing.bin.br');
});
