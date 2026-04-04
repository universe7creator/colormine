import { converter, formatHex, formatRgb, formatHsl, formatOklch, parse, wcagContrast, luminance, nearestAccessibleColor } from 'culori';

// Color converters
const toRgb = converter('rgb');
const toHsl = converter('hsl');
const toOklch = converter('oklch');
const toLab = converter('lab');
const toLch = converter('lch');

// Parse any color format
function parseColor(input) {
  const parsed = parse(input);
  if (!parsed) return null;
  return {
    hex: formatHex(parsed),
    rgb: formatRgb(parsed),
    hsl: formatHsl(parsed),
    oklch: formatOklch(parsed),
    rgbObject: toRgb(parsed),
    lab: toLab(parsed),
    lch: toLch(parsed)
  };
}

// Generate color harmony
function generateHarmony(baseColor, harmony, count = 5) {
  const base = parse(baseColor);
  if (!base) return null;

  const hues = {
    complementary: [0, 180],
    analogous: [-30, 0, 30],
    triadic: [0, 120, 240],
    tetradic: [0, 90, 180, 270],
    'split-complementary': [0, 150, 210],
    monochromatic: [0],
    shades: [0]
  };

  const baseHue = (base.lch?.h || 0);
  const baseChroma = base.lch?.c || 0;
  const baseLightness = base.lch?.l || 0.5;

  const angles = hues[harmony] || hues.complementary;
  const colors = [];

  for (let i = 0; i < Math.min(count, angles.length || count); i++) {
    const angle = angles[i % angles.length];
    const hue = (baseHue + angle + 360) % 360;

    let chroma = baseChroma;
    let lightness = baseLightness;

    if (harmony === 'monochromatic') {
      lightness = Math.max(0.1, Math.min(0.95, baseLightness - (i * 0.15)));
      chroma = baseChroma;
    } else if (harmony === 'shades') {
      lightness = Math.max(0.1, Math.min(0.95, baseLightness - (i * 0.12)));
      chroma = baseChroma * 0.8;
    }

    const color = { mode: 'lch', l: lightness, c: chroma, h: hue };
    colors.push(parseColor(color));
  }

  return colors;
}

// Calculate WCAG contrast
function checkContrast(foreground, background) {
  const fg = parse(foreground);
  const bg = parse(background);

  if (!fg || !bg) return null;

  const ratio = wcagContrast(fg, bg);
  const fgLuminance = luminance(fg);
  const bgLuminance = luminance(bg);

  return {
    foreground: formatHex(fg),
    background: formatHex(bg),
    ratio: Math.round(ratio * 100) / 100,
    wcag: {
      AA: {
        normal: ratio >= 4.5,
        large: ratio >= 3,
        ui: ratio >= 3
      },
      AAA: {
        normal: ratio >= 7,
        large: ratio >= 4.5,
        ui: ratio >= 4.5
      }
    },
    luminance: {
      foreground: Math.round(fgLuminance * 1000) / 1000,
      background: Math.round(bgLuminance * 1000) / 1000
    }
  };
}

// Export palette
function exportPalette(colors, format, names = []) {
  const colorList = Array.isArray(colors) ? colors : [colors];

  const exports = {
    css: () => {
      const vars = colorList.map((c, i) => {
        const name = names[i] || `color-${i + 1}`;
        return `  --${name}: ${c};`;
      }).join('\n');
      return `:root {\n${vars}\n}`;
    },
    scss: () => {
      return colorList.map((c, i) => {
        const name = names[i] || `$color-${i + 1}`;
        return `${name}: ${c};`;
      }).join('\n');
    },
    json: () => {
      const obj = {};
      colorList.forEach((c, i) => {
        const name = names[i] || `color${i + 1}`;
        obj[name] = c;
      });
      return JSON.stringify(obj, null, 2);
    },
    tailwind: () => {
      const config = {
        theme: {
          extend: {
            colors: {}
          }
        }
      };
      colorList.forEach((c, i) => {
        const name = names[i] || `color${i + 1}`;
        config.theme.extend.colors[name] = c;
      });
      return JSON.stringify(config, null, 2);
    },
    swift: () => {
      const lines = colorList.map((c, i) => {
        const name = names[i] ? names[i].replace(/-/g, '').replace(/\b\w/g, l => l.toUpperCase()) : `Color${i + 1}`;
        return `static let ${name.toLowerCase()} = Color(hex: "${c.replace('#', '')}")`;
      });
      return `import SwiftUI\n\nextension Color {\n${lines.map(l => '  ' + l).join('\n')}\n}`;
    },
    kotlin: () => {
      const lines = colorList.map((c, i) => {
        const name = names[i] ? names[i].replace(/-/g, '').replace(/\b\w/g, l => l.toUpperCase()) : `Color${i + 1}`;
        const hex = c.replace('#', '').toUpperCase();
        return `val ${name.toLowerCase()} = Color(0xFF${hex})`;
      });
      return `import androidx.compose.ui.graphics.Color\n\nobject AppColors {\n${lines.map(l => '  ' + l).join('\n')}\n}`;
    }
  };

  return exports[format] ? exports[format]() : exports.css();
}

// Analyze color
function analyzeColor(input) {
  const color = parse(input);
  if (!color) return null;

  const lum = luminance(color);
  const isLight = lum > 0.5;
  const isDark = lum <= 0.5;

  // Determine temperature
  const hue = color.lch?.h || 0;
  const temperature = (hue >= 0 && hue < 90) || (hue >= 270 && hue <= 360) ? 'warm' :
                      (hue >= 90 && hue < 180) ? 'cool' : 'neutral';

  // Best contrast color
  const bestContrast = isLight ? '#000000' : '#ffffff';

  return {
    color: formatHex(color),
    isLight,
    isDark,
    luminance: Math.round(lum * 1000) / 1000,
    temperature,
    bestContrast,
    formats: parseColor(color)
  };
}

// Random palette
function randomPalette(harmony = 'any', count = 5, seed = null) {
  let rng;

  if (seed) {
    // Simple seeded random
    let s = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    rng = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  } else {
    rng = Math.random;
  }

  const baseHue = rng() * 360;
  const baseChroma = 0.2 + rng() * 0.5;
  const baseLightness = 0.3 + rng() * 0.5;

  const harmonies = ['complementary', 'analogous', 'triadic', 'tetradic', 'split-complementary'];
  const selectedHarmony = harmony === 'any' ? harmonies[Math.floor(rng() * harmonies.length)] : harmony;

  const colors = [];
  for (let i = 0; i < count; i++) {
    let h = baseHue;
    let c = baseChroma;
    let l = baseLightness;

    if (selectedHarmony === 'analogous') {
      h = (baseHue + (i * 30) - (count * 15)) % 360;
    } else if (selectedHarmony === 'triadic') {
      h = (baseHue + (i * 120)) % 360;
    } else if (selectedHarmony === 'tetradic') {
      h = (baseHue + (i * 90)) % 360;
    } else if (selectedHarmony === 'complementary') {
      h = (baseHue + (i * 180)) % 360;
      l = i === 0 ? baseLightness : 1 - baseLightness;
    }

    l = Math.max(0.1, Math.min(0.95, l + (rng() - 0.5) * 0.2));

    const c_obj = { mode: 'lch', l, c, h };
    colors.push(parseColor(c_obj));
  }

  return {
    palette: colors,
    harmony: selectedHarmony,
    seed: seed || 'random'
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-License-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `https://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method;

  // Route to appropriate handler
  if (path === '/api/generate' && method === 'POST') {
    const { baseColor, harmony = 'complementary', count = 5 } = req.body || {};
    if (!baseColor) {
      return res.status(400).json({ error: 'baseColor is required' });
    }
    const palette = generateHarmony(baseColor, harmony, count);
    if (!palette) {
      return res.status(400).json({ error: 'Invalid color format' });
    }
    return res.status(200).json({
      palette,
      harmony,
      baseColor,
      count
    });
  }

  if (path === '/api/contrast' && method === 'POST') {
    const { foreground, background } = req.body || {};
    if (!foreground || !background) {
      return res.status(400).json({ error: 'foreground and background are required' });
    }
    const result = checkContrast(foreground, background);
    if (!result) {
      return res.status(400).json({ error: 'Invalid color format' });
    }
    return res.status(200).json(result);
  }

  if (path === '/api/convert' && method === 'POST') {
    const { color, to = ['hex', 'rgb', 'hsl', 'oklch'] } = req.body || {};
    if (!color) {
      return res.status(400).json({ error: 'color is required' });
    }
    const parsed = parseColor(color);
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid color format' });
    }
    const conversions = {};
    if (to.includes('hex')) conversions.hex = parsed.hex;
    if (to.includes('rgb')) conversions.rgb = parsed.rgbObject;
    if (to.includes('hsl')) conversions.hsl = parsed.hsl;
    if (to.includes('oklch')) conversions.oklch = parsed.oklch;
    if (to.includes('lab')) conversions.lab = parsed.lab;
    if (to.includes('lch')) conversions.lch = parsed.lch;

    return res.status(200).json({
      input: color,
      conversions
    });
  }

  if (path === '/api/random' && method === 'GET') {
    const harmony = url.searchParams.get('harmony') || 'any';
    const count = parseInt(url.searchParams.get('count') || '5');
    const seed = url.searchParams.get('seed');

    const result = randomPalette(harmony, Math.min(count, 10), seed);
    return res.status(200).json(result);
  }

  if (path === '/api/export' && method === 'POST') {
    const { palette, format = 'css', names = [] } = req.body || {};
    if (!palette || !Array.isArray(palette)) {
      return res.status(400).json({ error: 'palette array is required' });
    }
    try {
      const content = exportPalette(palette, format, names);
      return res.status(200).json({
        format,
        content,
        filename: `palette.${format === 'swift' ? 'swift' : format}`
      });
    } catch (e) {
      return res.status(400).json({ error: 'Invalid format' });
    }
  }

  if (path === '/api/analyze' && method === 'POST') {
    const { color } = req.body || {};
    if (!color) {
      return res.status(400).json({ error: 'color is required' });
    }
    const result = analyzeColor(color);
    if (!result) {
      return res.status(400).json({ error: 'Invalid color format' });
    }
    return res.status(200).json(result);
  }

  // Default: return API info
  return res.status(200).json({
    name: 'ColorMine API',
    version: '1.0.0',
    endpoints: [
      { path: '/api/generate', method: 'POST', description: 'Generate color palette from base color' },
      { path: '/api/contrast', method: 'POST', description: 'Check WCAG contrast between two colors' },
      { path: '/api/convert', method: 'POST', description: 'Convert color between formats' },
      { path: '/api/random', method: 'GET', description: 'Generate random color palette' },
      { path: '/api/export', method: 'POST', description: 'Export palette to various formats' },
      { path: '/api/analyze', method: 'POST', description: 'Analyze color properties' }
    ]
  });
}