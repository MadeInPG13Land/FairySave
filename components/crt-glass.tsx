'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';

/**
 * The game's own CRT look, rebuilt for the browser.
 *
 * Forsaken Frontiers runs a Retro Look Pro post-processing stack (profile
 * "FF_PPFX"). Its shaders didn't survive extraction, but the tuned settings
 * did, so each effect is re-implemented here with those values:
 *
 *   CRT Aperture        2-colour aperture mask 0.318, brightness 0.85,
 *                       gamma in 0.8 / out 0.89, halation 4.27, diffusion 0.83
 *   Ultimate Vignette   square shape, amount 100, fine-tune -30
 *   Pulsating Vignette  speed 1, amount 1
 *   Glitch3             speed 1, density 1, max displace 1
 *   Phosphor            fade 0.025 (afterglow; done in CSS)
 *   Colour grading      contrast +10
 *
 * Split by what a browser can do to live DOM:
 *   - mask, vignettes and brightness multiply the page: a WebGL canvas with
 *     mix-blend-mode: multiply (below);
 *   - gamma, contrast, halation and the glitch displacement are SVG filters on
 *     the app (<CrtFilters/>, styled in globals.css).
 */

export const GAME_CRT = {
  maskColors: 2,
  maskStrength: 0.318,
  brightness: 0.85,
  gammaInput: 0.8,
  gammaOutput: 0.89,
  glowHalation: 4.27,
  glowDiffusion: 0.83,
  vignetteAmount: 100,
  vignetteFineTune: -30,
  pulseSpeed: 1,
  pulseAmount: 1,
  glitchSpeed: 1,
  glitchDensity: 1,
  glitchDisplace: 1,
  phosphorFade: 0.025,
  contrast: 10,
} as const;

const VERTEX = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

// Output is multiplied onto the page, so 1.0 = untouched.
const FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2 uResolution;
uniform float uTime;
uniform float uMaskStrength;
uniform float uBrightness;
uniform float uGammaOutput;
uniform float uVignetteAmount;
uniform float uVignetteFineTune;
uniform float uPulseSpeed;
uniform float uPulseAmount;

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  // Aperture grille, 2 colours: alternating magenta / green device-pixel columns.
  float column = mod(floor(gl_FragCoord.x), 2.0);
  vec3 maskColour = column < 1.0 ? vec3(1.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
  vec3 mask = mix(vec3(1.0), maskColour, uMaskStrength);

  // "Square" vignette: the uv-product falloff is flat in the middle and
  // squarish toward the edges. Fine-tune sharpens the shoulder.
  float edge = uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y);
  float vignette = clamp(pow(edge * uVignetteAmount, -1.0 / uVignetteFineTune * 3.0), 0.0, 1.0);

  // Pulsating vignette: the darkened border breathes in and out.
  float pulse = 0.5 + 0.5 * sin(uTime * uPulseSpeed * 2.0);
  float border = 1.0 - smoothstep(0.0, 0.9, edge * 16.0);
  vignette *= 1.0 - border * pulse * 0.12 * uPulseAmount;

  vec3 colour = mask * vignette * uBrightness;
  // Output gamma, as the aperture shader applies it last.
  outColor = vec4(pow(colour, vec3(1.0 / uGammaOutput)), 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader');
  return shader;
}

/** SVG filters used by the CRT theme (see .crt rules in globals.css). */
export function CrtFilters() {
  const { gammaInput, gammaOutput, glowHalation, glowDiffusion, glitchDisplace } = GAME_CRT;
  return (
    <svg aria-hidden width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        {/* Input gamma + halation: a blurred copy of the picture, squared and added back. */}
        <filter id="crt-aperture" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feComponentTransfer in="SourceGraphic" result="gamma">
            <feFuncR type="gamma" exponent={gammaInput / gammaOutput} />
            <feFuncG type="gamma" exponent={gammaInput / gammaOutput} />
            <feFuncB type="gamma" exponent={gammaInput / gammaOutput} />
          </feComponentTransfer>
          <feGaussianBlur in="gamma" stdDeviation={glowDiffusion * 3} result="glow" />
          <feComponentTransfer in="glow" result="halation">
            <feFuncR type="gamma" exponent="2" amplitude={glowHalation * 0.12} />
            <feFuncG type="gamma" exponent="2" amplitude={glowHalation * 0.12} />
            <feFuncB type="gamma" exponent="2" amplitude={glowHalation * 0.12} />
          </feComponentTransfer>
          <feComposite in="gamma" in2="halation" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
        </filter>
        {/* Glitch3: blocky horizontal displacement with a colour shift. */}
        <filter id="crt-glitch" x="-5%" y="0" width="110%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence id="crt-glitch-noise" type="fractalNoise" baseFrequency="0.00001 0.06" numOctaves="1" seed="1" result="noise" />
          <feComponentTransfer in="noise" result="blocks">
            <feFuncR type="discrete" tableValues="0.5 0.5 0.5 0.3 0.5 0.5 0.7 0.5 0.5 0.5" />
            <feFuncG type="discrete" tableValues="0.5" />
          </feComponentTransfer>
          <feDisplacementMap in="SourceGraphic" in2="blocks" scale={22 * glitchDisplace} xChannelSelector="R" yChannelSelector="G" result="shifted" />
          <feColorMatrix in="shifted" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />
          <feOffset in="red" dx={2 * glitchDisplace} result="redShift" />
          <feColorMatrix in="shifted" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="cyan" />
          <feBlend in="redShift" in2="cyan" mode="screen" />
        </filter>
      </defs>
    </svg>
  );
}

export function CrtGlass() {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The saved theme is only known in the browser; render nothing until mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const active = mounted && theme === 'crt';

  // Glitch3 bursts: a few frames of block displacement every so often.
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer = 0;
    const schedule = () => {
      const wait = (6000 + Math.random() * 10000) / Math.max(GAME_CRT.glitchSpeed, 0.1);
      timer = window.setTimeout(() => {
        const noise = document.getElementById('crt-glitch-noise');
        if (!document.hidden && !reduced.matches && noise) {
          noise.setAttribute('seed', String(Math.floor(Math.random() * 1000)));
          noise.setAttribute('baseFrequency', `0.00001 ${(0.03 + Math.random() * 0.05) * GAME_CRT.glitchDensity}`);
          root.setAttribute('data-crt-glitch', '');
          window.setTimeout(() => root.removeAttribute('data-crt-glitch'), 90 + Math.random() * 140);
        }
        schedule();
      }, wait);
    };
    schedule();
    return () => {
      window.clearTimeout(timer);
      root.removeAttribute('data-crt-glitch');
    };
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = document.documentElement;
    if (!active || !canvas) return;

    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false });
    if (!gl) return; // CSS fallback stays on.

    let program: WebGLProgram;
    try {
      program = gl.createProgram()!;
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link');
    } catch (error) {
      console.warn('CRT glass unavailable', error);
      return;
    }

    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uniform = (name: string) => gl.getUniformLocation(program, name);
    gl.uniform1f(uniform('uMaskStrength'), GAME_CRT.maskStrength);
    gl.uniform1f(uniform('uBrightness'), GAME_CRT.brightness);
    gl.uniform1f(uniform('uGammaOutput'), GAME_CRT.gammaOutput);
    gl.uniform1f(uniform('uVignetteAmount'), GAME_CRT.vignetteAmount);
    gl.uniform1f(uniform('uVignetteFineTune'), GAME_CRT.vignetteFineTune);
    gl.uniform1f(uniform('uPulseSpeed'), GAME_CRT.pulseSpeed);
    gl.uniform1f(uniform('uPulseAmount'), GAME_CRT.pulseAmount);
    const uResolution = uniform('uResolution');
    const uTime = uniform('uTime');

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    root.setAttribute('data-crt-gl', '');

    function resize() {
      // Device pixels, so the aperture mask lines up with real screen pixels.
      const scale = window.devicePixelRatio || 1;
      canvas!.width = Math.round(window.innerWidth * scale);
      canvas!.height = Math.round(window.innerHeight * scale);
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
      gl!.uniform2f(uResolution, canvas!.width, canvas!.height);
    }
    resize();
    window.addEventListener('resize', resize);

    let frame = 0;
    let last = 0;
    const start = performance.now();
    function draw(now: number) {
      frame = requestAnimationFrame(draw);
      // Only the vignette pulse moves; 20fps is plenty.
      if (document.hidden || now - last < 50) return;
      last = now;
      gl!.uniform1f(uTime, reduced.matches ? 0 : (now - start) / 1000);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    }
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      root.removeAttribute('data-crt-gl');
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
    };
  }, [active]);

  if (!active) return null;
  return (
    <>
      <CrtFilters />
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[100] size-full"
        style={{ mixBlendMode: 'multiply' }}
      />
    </>
  );
}
