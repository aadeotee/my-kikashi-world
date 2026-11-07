import { Color, MeshLambertMaterial, Vector3 } from 'three'

/** Uniforms shared by every world material, advanced once per frame. */
export const U = {
  uTime: { value: 0 },
  uPlayer: { value: new Vector3(0, -100, 0) },
  uCutRadius: { value: 0 },
  uGlow: { value: 1 },
  uCloud: { value: 1 },
  uSky: { value: new Color('#bcd7e2') },
  uSun: { value: new Vector3(-0.55, 0.72, -0.42).normalize() },
}

const VERT_PARS = /* glsl */ `
attribute vec3 aFx;
varying vec3 vFx;
varying vec3 vWPos;
varying vec3 vWN;
uniform float uTime;
`

const VERT_BEGIN = /* glsl */ `
#include <begin_vertex>
vec4 wBase = vec4(position, 1.0);
#ifdef USE_INSTANCING
  wBase = instanceMatrix * wBase;
#endif
wBase = modelMatrix * wBase;
float gust = 0.65 + 0.35 * sin(uTime * 0.35 + wBase.x * 0.03 - wBase.z * 0.02);
float sway = sin(uTime * 1.5 + wBase.x * 0.37 + wBase.z * 0.29) + 0.5 * sin(uTime * 2.6 + wBase.x * 0.93 - wBase.z * 0.61);
transformed.x += sway * aFx.x * 0.14 * gust;
transformed.z += cos(uTime * 1.3 + wBase.z * 0.41) * aFx.x * 0.08 * gust;
vFx = aFx;
vWPos = wBase.xyz;
vWN = normalize(mat3(modelMatrix) * normal);
`

const FRAG_PARS = /* glsl */ `
varying vec3 vFx;
varying vec3 vWPos;
varying vec3 vWN;
uniform float uTime;
uniform vec3 uPlayer;
uniform float uCutRadius;
uniform float uGlow;
uniform float uCloud;
float h31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float h21(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
`

const FRAG_CUT = /* glsl */ `
#include <clipping_planes_fragment>
#ifdef WORLD_CUT
{
  // Anything standing between the camera and the girl dissolves in a soft screen-door pattern.
  vec3 ray = uPlayer - cameraPosition;
  float len = length(ray);
  ray /= len;
  vec3 rel = vWPos - cameraPosition;
  float along = dot(rel, ray);
  float off = length(rel - ray * along);
  // A cone rather than a cylinder keeps the hole the same size on screen at any depth.
  float rad = uCutRadius * clamp(along / len, 0.0, 1.0);
  if (uCutRadius > 0.0 && along < len - 0.45 && vWPos.y > uPlayer.y + 0.12 && off < rad) {
    vec2 px = floor(mod(gl_FragCoord.xy, 4.0));
    float bayer = h21(px + 3.0);
    if (smoothstep(rad * 0.5, rad, off) < bayer) discard;
  }
}
#endif
`

const FRAG_COLOR = /* glsl */ `
#include <color_fragment>
{
  float camDist = length(vWPos - cameraPosition);
  float amp = vFx.y * (1.0 - smoothstep(120.0, 200.0, camDist));
  if (amp > 0.0) {
    vec3 q = floor((vWPos - vWN * 0.01) * 8.0);
    float fine = h31(q) - 0.5;
    float broad = h31(floor(q * 0.5) + 7.0) - 0.5;
    diffuseColor.rgb *= 1.0 + (fine * 0.55 + broad) * amp;
  }
}
`

const FRAG_LIGHT = /* glsl */ `
{
  // Slow cloud shadows crossing the land.
  vec2 cp = vWPos.xz * 0.018 + vec2(uTime * 0.012, uTime * 0.005);
  float cover = vnoise(cp) * 0.65 + vnoise(cp * 2.3 + 4.0) * 0.35;
  reflectedLight.directDiffuse *= mix(1.0, 0.62, smoothstep(0.52, 0.7, cover) * uCloud);
}
#include <aomap_fragment>
`

const FRAG_EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * vFx.z * uGlow;
`

export function makeWorldMaterial(opts: { cut?: boolean } = {}) {
  const m = new MeshLambertMaterial({ vertexColors: true })
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, {
      uTime: U.uTime,
      uPlayer: U.uPlayer,
      uCutRadius: U.uCutRadius,
      uGlow: U.uGlow,
      uCloud: U.uCloud,
    })
    s.vertexShader = VERT_PARS + s.vertexShader.replace('#include <begin_vertex>', VERT_BEGIN)
    s.fragmentShader = (opts.cut ? '#define WORLD_CUT\n' : '') + FRAG_PARS + s.fragmentShader
      .replace('#include <clipping_planes_fragment>', FRAG_CUT)
      .replace('#include <color_fragment>', FRAG_COLOR)
      .replace('#include <emissivemap_fragment>', FRAG_EMISSIVE)
      .replace('#include <aomap_fragment>', FRAG_LIGHT)
  }
  m.customProgramCacheKey = () => `world-${opts.cut ? 1 : 0}`
  return m
}

export const worldMaterial = makeWorldMaterial({ cut: true })
export const propMaterial = makeWorldMaterial()
