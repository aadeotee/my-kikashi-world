import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { Color, DoubleSide, ShaderMaterial, Vector3 } from 'three'
import { U } from '../materials'
import { P } from '../palette'
import { G } from '../state'
import type { World } from '../world/generate'

const MAX = 12

const vertex = /* glsl */ `
attribute float aDepth;
attribute float aFlow;
varying vec3 vW;
varying float vDepth;
varying float vFlow;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vDepth = aDepth;
  vFlow = aFlow;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

const fragment = /* glsl */ `
uniform float uTime;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uSky;
uniform vec3 uSun;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform vec3 uRipples[${MAX}];
varying vec3 vW;
varying float vDepth;
varying float vFlow;

float h21(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float wave(vec2 p, float t) {
  return sin(p.x * 1.1 + t * 0.9) + sin(p.y * 1.5 - t * 0.7) + 0.6 * sin((p.x + p.y) * 2.3 + t * 1.3) + 0.4 * sin((p.x - p.y) * 3.1 - t * 1.7);
}
void main() {
  vec2 p = vW.xz;
  p.y += vFlow * uTime * 2.2;
  // Slightly quantised so the water keeps a hand-made, blocky rhythm.
  vec2 q = floor(p * 5.0) / 5.0;
  float e = 0.2;
  float w0 = wave(q, uTime);
  vec3 n = normalize(vec3(wave(q + vec2(e, 0.0), uTime) - w0, 7.0, wave(q + vec2(0.0, e), uTime) - w0));

  float ring = 0.0;
  for (int i = 0; i < ${MAX}; i++) {
    vec3 r = uRipples[i];
    float age = uTime - r.z;
    if (r.z < 0.0 || age > 2.6) continue;
    float d = length(floor(vW.xz * 6.0) / 6.0 - r.xy);
    float front = age * 1.25;
    ring += smoothstep(0.17, 0.0, abs(d - front)) * (1.0 - age / 2.6);
    ring += smoothstep(0.12, 0.0, abs(d - front * 0.62)) * (1.0 - age / 2.6) * 0.5;
  }

  vec3 V = normalize(cameraPosition - vW);
  float fres = pow(1.0 - max(dot(V, n), 0.0), 3.0);
  vec3 col = mix(uShallow, uDeep, vDepth);
  col = mix(col, uSky * 1.1, mix(0.5, 0.2, vDepth) + fres * 0.5);

  vec3 Hh = normalize(uSun + V);
  float spec = pow(max(dot(n, Hh), 0.0), 180.0);
  col += vec3(1.0, 0.93, 0.76) * spec * 0.9;
  col += (w0 * 0.012);
  col += vec3(0.92, 0.95, 0.9) * ring * 0.42;

  // Pale foam line along the banks.
  float shore = smoothstep(0.1, 0.0, vDepth) * step(0.5, 1.0 - vFlow);
  float foam = step(0.72, h21(floor(vW.xz * 6.0) + floor(uTime * 1.5))) * shore * 0.2;
  col += foam;

  float alpha = mix(0.8, 0.93, vDepth) + fres * 0.08 + ring * 0.2;

  float dist = length(cameraPosition - vW);
  float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  col = mix(col, uFogColor, fog);
  gl_FragColor = vec4(col, min(alpha, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export function Water({ world }: { world: World }) {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        uniforms: {
          uTime: U.uTime,
          uSky: U.uSky,
          uSun: U.uSun,
          uFogColor: U.uFogColor,
          uFogDensity: U.uFogDensity,
          uShallow: { value: new Color(P.water) },
          uDeep: { value: new Color(P.waterDeep) },
          uRipples: { value: Array.from({ length: MAX }, () => new Vector3(0, 0, -1)) },
        },
      }),
    [],
  )

  useFrame(() => {
    const r = material.uniforms.uRipples.value as Vector3[]
    for (let i = 0; i < MAX; i++) {
      const v = G.ripples[i]
      if (v) r[i].set(v.x, v.z, v.t)
      else r[i].z = -1
    }
  })

  return <mesh geometry={world.water} material={material} renderOrder={2} />
}
