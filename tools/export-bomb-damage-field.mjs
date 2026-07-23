import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { deflateSync } from "node:zlib";
import { pathToFileURL } from "node:url";

const FORMAT_VERSION = 1;
const RESOURCE_TYPE = "CS2_BOMB_DAMAGE_DATA";

export function parseBombDamageResource(text) {
  if (!text.includes(`generic_data_type = "${RESOURCE_TYPE}"`)) {
    throw new Error(`Expected ${RESOURCE_TYPE} generic data.`);
  }

  const bombsites = readHexBlob(text, "bombsites");
  const positions = readHexBlob(text, "positions");
  const damageValues = readHexBlob(text, "damage_values");
  if (bombsites.length === 0 || bombsites.length % 28 !== 0) {
    throw new Error(`Expected 28 bytes per bomb site, received ${bombsites.length}.`);
  }
  if (positions.length === 0 || positions.length % 6 !== 0) {
    throw new Error(`Expected 6 bytes per position, received ${positions.length}.`);
  }

  const siteCount = bombsites.length / 28;
  const positionCount = positions.length / 6;
  const expectedDamageBytes = siteCount * positionCount * 4;
  if (damageValues.length !== expectedDamageBytes) {
    throw new Error(
      `Expected ${expectedDamageBytes} site-major damage bytes, received ${damageValues.length}.`,
    );
  }

  const sites = Array.from({ length: siteCount }, (_, siteIndex) => {
    const offset = siteIndex * 28;
    return {
      bounds: {
        minX: bombsites.readFloatLE(offset),
        minY: bombsites.readFloatLE(offset + 4),
        minZ: bombsites.readFloatLE(offset + 8),
        maxX: bombsites.readFloatLE(offset + 12),
        maxY: bombsites.readFloatLE(offset + 16),
        maxZ: bombsites.readFloatLE(offset + 20),
      },
      label: String.fromCharCode(65 + siteIndex),
      propagationRange: bombsites.readFloatLE(offset + 24),
    };
  });

  const samples = Array.from({ length: positionCount }, (_, positionIndex) => {
    const offset = positionIndex * 6;
    return {
      x: positions.readInt16LE(offset),
      y: positions.readInt16LE(offset + 2),
      z: positions.readInt16LE(offset + 4),
    };
  });

  const propagationCosts = sites.map((_, siteIndex) => {
    const siteOffset = siteIndex * positionCount * 4;
    return Uint16Array.from(
      { length: positionCount },
      (_, positionIndex) => damageValues.readUInt16LE(siteOffset + positionIndex * 4),
    );
  });

  return { propagationCosts, samples, sites };
}

export function renderSiteMask(resource, siteIndex, calibration, width, height) {
  const site = resource.sites[siteIndex];
  const costs = resource.propagationCosts[siteIndex];
  if (!site || !costs) {
    throw new Error(`Bomb site ${siteIndex} is missing.`);
  }

  const rgba = Buffer.alloc(width * height * 4);
  const worldWidth = calibration.worldXMax - calibration.worldXMin;
  const worldHeight = calibration.worldYMax - calibration.worldYMin;
  const halfWidth = Math.max(1, Math.ceil((10 / worldWidth) * width * 0.62));
  const halfHeight = Math.max(1, Math.ceil((10 / worldHeight) * height * 0.62));

  for (let sampleIndex = 0; sampleIndex < resource.samples.length; sampleIndex += 1) {
    const cost = costs[sampleIndex];
    if (cost > site.propagationRange) {
      continue;
    }

    const sample = resource.samples[sampleIndex];
    const imageX = Math.round(((sample.x - calibration.worldXMin) / worldWidth) * (width - 1));
    const imageY = Math.round(
      (1 - (sample.y - calibration.worldYMin) / worldHeight) * (height - 1),
    );
    const strength = 1 - cost / Math.max(1, site.propagationRange);
    const alpha = Math.round(76 + strength * 112);

    for (let y = imageY - halfHeight; y <= imageY + halfHeight; y += 1) {
      if (y < 0 || y >= height) {
        continue;
      }
      for (let x = imageX - halfWidth; x <= imageX + halfWidth; x += 1) {
        if (x < 0 || x >= width) {
          continue;
        }
        const offset = (y * width + x) * 4;
        if (alpha <= rgba[offset + 3]) {
          continue;
        }
        rgba[offset] = 255;
        rgba[offset + 1] = 255;
        rgba[offset + 2] = 255;
        rgba[offset + 3] = alpha;
      }
    }
  }

  return rgba;
}

export function encodeRgbaPng(width, height, rgba) {
  if (rgba.length !== width * height * 4) {
    throw new Error("RGBA byte length does not match the requested PNG dimensions.");
  }

  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const targetOffset = y * (width * 4 + 1);
    scanlines[targetOffset] = 0;
    rgba.copy(scanlines, targetOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(scanlines, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

async function main() {
  const args = readArgs(process.argv.slice(2));
  const required = ["input", "compiled", "calibration", "radar", "output", "map"];
  for (const name of required) {
    if (!args[name]) {
      throw new Error(`Missing --${name}.`);
    }
  }

  const [resourceText, compiledResource, calibrationText, radarPng] = await Promise.all([
    readFile(args.input, "utf8"),
    readFile(args.compiled),
    readFile(args.calibration, "utf8"),
    readFile(args.radar),
  ]);
  const calibrationDocument = JSON.parse(calibrationText);
  const calibration = calibrationDocument.coordinateSystem;
  const { width, height } = readPngDimensions(radarPng);
  const resource = parseBombDamageResource(resourceText);
  const resourceSha256 = createHash("sha256").update(compiledResource).digest("hex").toUpperCase();
  const compatibleSourceDemoSha256 = args["demo-sha256"]
    ? [normalizeSha256(args["demo-sha256"], "demo")]
    : [];

  await mkdir(args.output, { recursive: true });
  const manifestSites = [];
  for (let siteIndex = 0; siteIndex < resource.sites.length; siteIndex += 1) {
    const site = resource.sites[siteIndex];
    const file = `site-${site.label.toLowerCase()}.png`;
    const mask = renderSiteMask(resource, siteIndex, calibration, width, height);
    await writeFile(join(args.output, file), encodeRgbaPng(width, height, mask));
    manifestSites.push({ ...site, mask: file });
  }

  const manifest = {
    formatVersion: FORMAT_VERSION,
    compatibleSourceDemoSha256,
    mapId: args.map,
    radar: {
      height,
      width,
    },
    resource: {
      file: basename(args.compiled),
      sha256: resourceSha256,
      type: RESOURCE_TYPE,
      version: 1,
    },
    sites: manifestSites,
  };
  await writeFile(join(args.output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

function readHexBlob(text, name) {
  const match = text.match(new RegExp(`${name}\\s*=\\s*#\\[([\\s\\S]*?)\\]`));
  if (!match) {
    throw new Error(`Missing ${name} blob.`);
  }
  const bytes = match[1].match(/[0-9A-Fa-f]{2}/g) ?? [];
  return Buffer.from(bytes.map((value) => Number.parseInt(value, 16)));
}

function readArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index]?.replace(/^--/, "");
    const value = values[index + 1];
    if (!key || value == null) {
      throw new Error(`Invalid argument near ${values[index] ?? "<end>"}.`);
    }
    result[key] = value;
  }
  return result;
}

function readPngDimensions(png) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (png.length < 24 || !png.subarray(0, 8).equals(signature)) {
    throw new Error("Radar asset is not a PNG.");
  }
  return { height: png.readUInt32BE(20), width: png.readUInt32BE(16) };
}

function normalizeSha256(value, label) {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new Error(`Invalid ${label} SHA-256: ${value}`);
  }
  return normalized;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type);
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return chunk;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
