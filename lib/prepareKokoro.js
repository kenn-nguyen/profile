const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { pipeline } = require('stream/promises');
const { Transform } = require('stream');
const { createHash } = require('crypto');
const { tmpdir } = require('os');
const zlib = require('zlib');

function getDefaultOutputDir() {
  return path.join(process.cwd(), 'extension', 'models');
}

function getDefaultManifestPath() {
  return path.join(process.cwd(), 'kokoro-assets.json');
}

function getArtifactManifestPath() {
  return path.join(process.cwd(), 'extension', 'models', 'manifest.json');
}

async function prepareKokoro(options = {}) {
  const {
    manifestPath = getDefaultManifestPath(),
    outputDir = getDefaultOutputDir(),
    force = false,
    logger = console,
  } = options;

  const manifest = await readManifest(manifestPath);
  await fsp.mkdir(outputDir, { recursive: true });

  const artifacts = [];
  for (const file of manifest.files) {
    const result = await processFile({ file, outputDir, force, logger });
    artifacts.push(result);
  }

  const manifestOut = {
    generatedAt: new Date().toISOString(),
    files: artifacts,
  };

  const artifactManifestPath = getArtifactManifestPath();
  await fsp.writeFile(artifactManifestPath, JSON.stringify(manifestOut, null, 2));
  logger.info(
    `Wrote manifest for ${artifacts.length} Kokoro asset(s) -> ${path.relative(process.cwd(), artifactManifestPath)}`
  );

  return manifestOut;
}

async function readManifest(manifestPath) {
  try {
    const data = await fsp.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(data);
    if (!manifest || !Array.isArray(manifest.files) || manifest.files.length === 0) {
      throw new Error('kokoro-assets manifest must include a non-empty "files" array.');
    }
    return manifest;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(
        `No kokoro-assets manifest found at ${manifestPath}. Create one (e.g. copy kokoro-assets.template.json).`
      );
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse kokoro-assets manifest at ${manifestPath}: ${error.message}`);
    }
    throw error;
  }
}

async function processFile({ file, outputDir, force, logger }) {
  if (!file || typeof file !== 'object') {
    throw new Error('Invalid file entry in kokoro-assets manifest.');
  }
  const { source, name, sha256, compress = 'brotli' } = file;
  if (!source || typeof source !== 'string') {
    throw new Error('Each kokoro asset must include a "source" URL.');
  }
  if (!name || typeof name !== 'string') {
    throw new Error('Each kokoro asset must include a "name".');
  }

  const targetName = compress === false ? name : `${name}.br`;
  const targetPath = path.join(outputDir, targetName);
  const tmpPath = path.join(tmpdir(), `${name}.${process.pid}.${Date.now()}`);

  if (!force && (await fileExists(targetPath))) {
    logger.info(`Skipping download for ${name}; existing artifact detected. Use --force to re-download.`);
    const stats = await fsp.stat(targetPath);
    return {
      name,
      artifact: targetName,
      bytes: stats.size,
      compressedBytes: stats.size,
      encoding: compress === false ? 'raw' : 'brotli',
      source,
      sha256: sha256 || null,
      reused: true,
    };
  }

  logger.info(`Downloading ${name} from ${source}`);
  const response = await fetch(source);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${name}: ${response.status} ${response.statusText}`);
  }

  const hash = createHash('sha256');
  let originalBytes = 0;
  const hasher = new Transform({
    transform(chunk, encoding, callback) {
      hash.update(chunk);
      originalBytes += chunk.length;
      callback(null, chunk);
    },
  });

  const streams = [response.body, hasher];
  if (compress === 'brotli') {
    const brotli = zlib.createBrotliCompress({ params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } });
    streams.push(brotli);
  } else if (compress && compress !== 'raw' && compress !== false) {
    throw new Error(`Unsupported compression setting "${compress}" for ${name}.`);
  }

  const writer = fs.createWriteStream(tmpPath);
  streams.push(writer);
  await pipeline(...streams);
  writer.close();

  const digest = hash.digest('hex');
  if (sha256 && sha256 !== digest) {
    await safeUnlink(tmpPath);
    throw new Error(`SHA-256 mismatch for ${name}. Expected ${sha256}, received ${digest}.`);
  }

  await fsp.rename(tmpPath, targetPath);
  const compressedStats = await fsp.stat(targetPath);

  logger.info(`Stored ${name} -> ${path.relative(process.cwd(), targetPath)} (${compressedStats.size} bytes)`);

  return {
    name,
    artifact: targetName,
    bytes: originalBytes,
    compressedBytes: compressedStats.size,
    encoding: compress === false ? 'raw' : 'brotli',
    source,
    sha256: digest,
    reused: false,
  };
}

async function fileExists(filePath) {
  try {
    await fsp.access(filePath, fs.constants.F_OK);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function safeUnlink(filePath) {
  try {
    await fsp.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

module.exports = {
  prepareKokoro,
  readManifest,
  processFile,
};
