import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SIZE = 1024;

const COLORS = {
  backgroundTop: [15, 23, 42, 255],
  backgroundBottom: [17, 50, 43, 255],
  white: [247, 249, 252, 255],
  green: [76, 175, 80, 255],
  leafLight: [129, 199, 132, 255],
  shadow: [0, 0, 0, 64],
  transparent: [0, 0, 0, 0],
};

const createPixels = (background) => {
  const pixels = new Uint8Array(SIZE * SIZE * 4);

  for (let y = 0; y < SIZE; y += 1) {
    const t = y / (SIZE - 1);
    const color = background
      ? [
          Math.round(
            COLORS.backgroundTop[0] * (1 - t) +
              COLORS.backgroundBottom[0] * t,
          ),
          Math.round(
            COLORS.backgroundTop[1] * (1 - t) +
              COLORS.backgroundBottom[1] * t,
          ),
          Math.round(
            COLORS.backgroundTop[2] * (1 - t) +
              COLORS.backgroundBottom[2] * t,
          ),
          255,
        ]
      : COLORS.transparent;

    for (let x = 0; x < SIZE; x += 1) {
      const offset = (y * SIZE + x) * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = color[3];
    }
  }

  return pixels;
};

const blendPixel = (pixels, x, y, color) => {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;

  const offset = (y * SIZE + x) * 4;
  const alpha = color[3] / 255;
  const inverse = 1 - alpha;

  pixels[offset] = Math.round(color[0] * alpha + pixels[offset] * inverse);
  pixels[offset + 1] = Math.round(
    color[1] * alpha + pixels[offset + 1] * inverse,
  );
  pixels[offset + 2] = Math.round(
    color[2] * alpha + pixels[offset + 2] * inverse,
  );
  pixels[offset + 3] = Math.round(
    color[3] + pixels[offset + 3] * inverse,
  );
};

const distanceToSegment = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared),
  );
  const x = ax + t * dx;
  const y = ay + t * dy;

  return Math.hypot(px - x, py - y);
};

const drawThickLine = (pixels, ax, ay, bx, by, width, color) => {
  const radius = width / 2;
  const minX = Math.max(0, Math.floor(Math.min(ax, bx) - radius - 2));
  const maxX = Math.min(SIZE - 1, Math.ceil(Math.max(ax, bx) + radius + 2));
  const minY = Math.max(0, Math.floor(Math.min(ay, by) - radius - 2));
  const maxY = Math.min(SIZE - 1, Math.ceil(Math.max(ay, by) + radius + 2));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (distanceToSegment(x + 0.5, y + 0.5, ax, ay, bx, by) <= radius) {
        blendPixel(pixels, x, y, color);
      }
    }
  }
};

const drawRect = (pixels, left, top, right, bottom, color) => {
  for (let y = Math.max(0, top); y < Math.min(SIZE, bottom); y += 1) {
    for (let x = Math.max(0, left); x < Math.min(SIZE, right); x += 1) {
      blendPixel(pixels, x, y, color);
    }
  }
};

const drawRoundedRect = (
  pixels,
  left,
  top,
  right,
  bottom,
  radius,
  color,
) => {
  const r = radius;

  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const nearestX = Math.max(left + r, Math.min(x, right - r - 1));
      const nearestY = Math.max(top + r, Math.min(y, bottom - r - 1));
      const dx = x - nearestX;
      const dy = y - nearestY;

      if (dx * dx + dy * dy <= r * r) {
        blendPixel(pixels, x, y, color);
      }
    }
  }
};

const drawU = (pixels, offsetX, offsetY, color) => {
  const left = 520 + offsetX;
  const right = 820 + offsetX;
  const top = 235 + offsetY;
  const joinY = 575 + offsetY;
  const centerX = 670 + offsetX;
  const centerY = 575 + offsetY;
  const outerRadius = 155;
  const innerRadius = 73;

  drawRect(pixels, left, top, left + 105, joinY + 8, color);
  drawRect(pixels, right - 105, top, right, joinY + 8, color);

  for (
    let y = Math.max(0, centerY);
    y <= Math.min(SIZE - 1, centerY + outerRadius);
    y += 1
  ) {
    for (
      let x = Math.max(0, centerX - outerRadius);
      x <= Math.min(SIZE - 1, centerX + outerRadius);
      x += 1
    ) {
      const distance = Math.hypot(x + 0.5 - centerX, y + 0.5 - centerY);

      if (distance <= outerRadius && distance >= innerRadius) {
        blendPixel(pixels, x, y, color);
      }
    }
  }
};

const drawRotatedEllipse = (
  pixels,
  centerX,
  centerY,
  radiusX,
  radiusY,
  angleDegrees,
  color,
  veinColor,
) => {
  const angle = (angleDegrees * Math.PI) / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const extent = Math.ceil(Math.max(radiusX, radiusY) * 1.5);

  for (
    let y = Math.max(0, Math.floor(centerY - extent));
    y <= Math.min(SIZE - 1, Math.ceil(centerY + extent));
    y += 1
  ) {
    for (
      let x = Math.max(0, Math.floor(centerX - extent));
      x <= Math.min(SIZE - 1, Math.ceil(centerX + extent));
      x += 1
    ) {
      const dx = x + 0.5 - centerX;
      const dy = y + 0.5 - centerY;
      const localX = dx * cosine + dy * sine;
      const localY = -dx * sine + dy * cosine;
      const normalized =
        (localX * localX) / (radiusX * radiusX) +
        (localY * localY) / (radiusY * radiusY);

      if (normalized <= 1) {
        blendPixel(pixels, x, y, color);
      }
    }
  }

  drawThickLine(
    pixels,
    centerX - radiusX * 0.68 * cosine,
    centerY - radiusX * 0.68 * sine,
    centerX + radiusX * 0.68 * cosine,
    centerY + radiusX * 0.68 * sine,
    8,
    veinColor,
  );
};

const drawMark = (pixels, scale = 1, translateX = 0, translateY = 0) => {
  const point = (x, y) => [
    translateX + x * scale,
    translateY + y * scale,
  ];

  const drawV = (offsetX, offsetY, color) => {
    const [a1x, a1y] = point(245 + offsetX, 265 + offsetY);
    const [b1x, b1y] = point(405 + offsetX, 715 + offsetY);
    const [a2x, a2y] = point(405 + offsetX, 715 + offsetY);
    const [b2x, b2y] = point(505 + offsetX, 265 + offsetY);
    drawThickLine(pixels, a1x, a1y, b1x, b1y, 112 * scale, color);
    drawThickLine(pixels, a2x, a2y, b2x, b2y, 112 * scale, color);
  };

  drawV(10, 14, COLORS.shadow);

  const shadowU = createPixels(false);
  drawU(shadowU, 10, 14, COLORS.shadow);
  composite(pixels, shadowU);

  drawV(0, 0, COLORS.white);

  const greenLayer = createPixels(false);
  drawU(greenLayer, 0, 0, COLORS.green);
  composite(pixels, greenLayer);

  const [stemAx, stemAy] = point(748, 295);
  const [stemBx, stemBy] = point(783, 357);
  drawThickLine(
    pixels,
    stemAx,
    stemAy,
    stemBx,
    stemBy,
    13 * scale,
    COLORS.leafLight,
  );

  const leafVein = [24, 55, 47, 170];
  const [leaf1X, leaf1Y] = point(772, 238);
  drawRotatedEllipse(
    pixels,
    leaf1X,
    leaf1Y,
    86 * scale,
    39 * scale,
    25,
    COLORS.leafLight,
    leafVein,
  );

  const [leaf2X, leaf2Y] = point(704, 281);
  drawRotatedEllipse(
    pixels,
    leaf2X,
    leaf2Y,
    72 * scale,
    33 * scale,
    -28,
    COLORS.green,
    leafVein,
  );

  const [underlineLeft, underlineTop] = point(315, 770);
  const [underlineRight, underlineBottom] = point(710, 800);
  drawRoundedRect(
    pixels,
    Math.round(underlineLeft),
    Math.round(underlineTop),
    Math.round(underlineRight),
    Math.round(underlineBottom),
    15 * scale,
    [247, 249, 252, 230],
  );
};

function composite(base, overlay) {
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const offset = (y * SIZE + x) * 4;
      const alpha = overlay[offset + 3];

      if (alpha === 0) continue;

      blendPixel(base, x, y, [
        overlay[offset],
        overlay[offset + 1],
        overlay[offset + 2],
        alpha,
      ]);
    }
  }
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let c = index;

  for (let bit = 0; bit < 8; bit += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }

  return c >>> 0;
});

const crc32 = (buffer) => {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
};

const pngChunk = (type, data) => {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(
    crc32(Buffer.concat([typeBuffer, data])),
    0,
  );

  return Buffer.concat([length, typeBuffer, data, checksum]);
};

const encodePng = (pixels) => {
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);

  for (let y = 0; y < SIZE; y += 1) {
    const rowOffset = y * (SIZE * 4 + 1);
    raw[rowOffset] = 0;

    Buffer.from(
      pixels.buffer,
      pixels.byteOffset + y * SIZE * 4,
      SIZE * 4,
    ).copy(raw, rowOffset + 1);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(SIZE, 0);
  header.writeUInt32BE(SIZE, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
};

const outputDirectory = resolve('assets');
mkdirSync(outputDirectory, { recursive: true });

const iconPixels = createPixels(true);
drawMark(iconPixels);
writeFileSync(
  resolve(outputDirectory, 'icon.png'),
  encodePng(iconPixels),
);

const adaptivePixels = createPixels(false);
// Keep foreground comfortably inside Android's adaptive-icon safe zone.
drawMark(adaptivePixels, 0.78, 112, 112);
writeFileSync(
  resolve(outputDirectory, 'adaptive-icon.png'),
  encodePng(adaptivePixels),
);

console.log('Generated Vorster Unlimited app icons.');
