"""Outline the "Pro Coders" wordmark from Inter (Display optical size) into SVG paths.

Usage: python3 scripts/brand/build-wordmark.py  (needs `pip install fonttools brotli`)
Writes docs/brand/*.svg and apps/dashboard/public/favicon.svg. The mark geometry lives in MARK
below and in apps/dashboard/src/components/brand-mark.tsx (keep both in sync).
Font: Inter by Rasmus Andersson, SIL Open Font License 1.1 — outlines may be embedded.
"""
import glob, os, sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
NAME = 'Pro Coders'
src = glob.glob(os.path.join(ROOT, 'node_modules/.pnpm/@fontsource-variable+inter@*/node_modules/@fontsource-variable/inter/files/inter-latin-opsz-normal.woff2'))[0]
font = instantiateVariableFont(TTFont(src), {'opsz': 32, 'wght': 620})
gs, cmap, hmtx = font.getGlyphSet(), font.getBestCmap(), font['hmtx']
upm = font['head'].unitsPerEm
TRACK = -0.022 * upm  # Inter dynamic metrics at display size

def outline(size=28.0, x0=0.0, baseline=0.0):
    scale = size / upm
    pen = SVGPathPen(gs, ntos=lambda v: ('%.2f' % v).rstrip('0').rstrip('.'))
    x = 0.0
    for i, ch in enumerate(NAME):
        g = cmap[ord(ch)]
        tp = TransformPen(pen, (scale, 0, 0, -scale, x0 + x * scale, baseline))
        gs[g].draw(tp)
        x += hmtx[g][0] + (TRACK if i < len(NAME) - 1 else 0)
    return pen.getCommands(), x * scale

MARK_DEFS = '''<linearGradient id="pc-g" x1="4" y1="2" x2="36" y2="40" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#5A7BFF"/><stop offset=".55" stop-color="#3D63F0"/><stop offset="1" stop-color="#1E3AA8"/>
    </linearGradient>
    <radialGradient id="pc-r" cx="35" cy="37" r="24" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#2EBBFF" stop-opacity=".95"/><stop offset="1" stop-color="#2EBBFF" stop-opacity="0"/>
    </radialGradient>'''
TILE = 'M12.4 0H27.6C35.2 0 40 4.8 40 12.4V27.6C40 35.2 35.2 40 27.6 40H12.4C4.8 40 0 35.2 0 27.6V12.4C0 4.8 4.8 0 12.4 0Z'
BUBBLE = 'M14.6 9.8H25.4C28.5 9.8 31 12.3 31 15.4V20.9C31 24 28.5 26.5 25.4 26.5H18L13.1 30.4C12.4 30.95 11.4 30.4 11.55 29.5L12.05 26.1C10.3 25.2 9 23.2 9 20.9V15.4C9 12.3 11.5 9.8 14.6 9.8Z'
CHEVRON = 'M15.3 15.4L18.8 18.15L15.3 20.9'
CURSOR = 'M20.9 20.9H25.6'

def mark(x=0, y=0, s=1.0, mono=False):
    t = f'transform="translate({x} {y}) scale({s})"'
    if mono:
        return f'''<g {t}><mask id="pc-m"><rect width="40" height="40" fill="#fff"/><path d="{CHEVRON}" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="{CURSOR}" stroke="#000" stroke-width="2.2" stroke-linecap="round"/></mask><path d="{BUBBLE}" fill="currentColor" mask="url(#pc-m)" transform="translate(-9 -6) scale(1.6)"/></g>'''
    return f'''<g {t}><path d="{TILE}" fill="url(#pc-g)"/><path d="{TILE}" fill="url(#pc-r)" opacity=".75"/>
    <path d="{TILE}" fill="none" stroke="#fff" stroke-opacity=".16" transform="translate(.5 .5) scale(.975)"/>
    <path d="{BUBBLE}" fill="#fff"/>
    <path d="{CHEVRON}" stroke="#2747D1" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="{CURSOR}" stroke="#3D63F0" stroke-width="2.2" stroke-linecap="round"/></g>'''

def svg(w, h, body, defs=True, title='Pro Coders'):
    d = f'<defs>{MARK_DEFS}</defs>' if defs else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="{title}"><title>{title}</title>{d}{body}</svg>\n'

out = os.path.join(ROOT, 'docs/brand')
os.makedirs(out, exist_ok=True)
open(os.path.join(out, 'pro-coders-mark.svg'), 'w').write(svg(40, 40, mark()))
open(os.path.join(out, 'pro-coders-mark-mono.svg'), 'w').write(svg(40, 40, mark(mono=True), defs=False))
open(os.path.join(ROOT, 'apps/dashboard/public/favicon.svg'), 'w').write(svg(40, 40, mark()))
for variant, color in (('dark', '#F2F5FC'), ('light', '#0B1020')):
    d, w = outline(size=26, x0=52, baseline=29)
    W = int(52 + w + 4)
    body = mark() + f'<path d="{d}" fill="{color}"/>'
    open(os.path.join(out, f'pro-coders-lockup-on-{variant}.svg'), 'w').write(svg(W, 40, body))
d, w = outline(size=26, x0=0, baseline=29)
open(os.path.join(out, 'pro-coders-wordmark.svg'), 'w').write(svg(int(w + 2), 40, f'<path d="{d}" fill="currentColor"/>', defs=False))
print('wordmark width at 26px:', round(w, 1))
