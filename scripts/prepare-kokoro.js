#!/usr/bin/env node
const path = require('path');
const { prepareKokoro } = require('../lib/prepareKokoro');

async function main() {
  const [, , manifestArg, ...rest] = process.argv;
  const force = rest.includes('--force');
  const manifestPath = manifestArg ? path.resolve(process.cwd(), manifestArg) : undefined;

  try {
    await prepareKokoro({ manifestPath, force, logger: console });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

main();
