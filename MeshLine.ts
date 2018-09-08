/*
Adapted by Jeremy Apthorp from Jaume Sanchez's THREE.MeshLine.

MIT License

Copyright (c) 2016 Jaume Sanchez, Jeremy Apthorp

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
 */
import * as THREE from 'three';

export class MeshLine extends THREE.BufferGeometry {
  positions: Array<any>;
  previous: Array<any>;
  next: Array<any>;
  side: Array<any>;
  width: Array<any>;
  indices_array: Array<any>;
  counters: Array<any>;
  widthCallback: any;

  attributes: any;

  constructor() {
    super();
    this.type = 'MeshLine';
    this.nPoints = 0;
    this.resize(16);
    this.widthCallback = null;
  }

  copyV3(a: number) {
    const aa = a * 6;
    return new THREE.Vector3(this.positions[aa], this.positions[aa + 1], this.positions[aa + 2]);
  }

  get capacity() {
    return this.positions ? this.positions.length / 6 : 0;
  }

  resize(minCapacity: number) {
    function copy(fromBuf: Float32Array, toBuf: Float32Array) {
      fromBuf.forEach((p, i) => toBuf[i] = p);
    }
    function realloc(buf: ?Float32Array, size: number, arrayType: any): TypedArray {
      const newBuf = new arrayType(size);
      if (buf) copy(buf, newBuf);
      return newBuf;
    }
    let newCapacity = (Math.pow(2, Math.ceil(Math.log2(minCapacity))) * 2) | 0;
    if (this.capacity != newCapacity) {
      this.positions = realloc(this.positions, newCapacity * 6, Float32Array);

      this.previous = realloc(this.previous, newCapacity * 6, Float32Array);
      this.next = realloc(this.next, newCapacity * 6, Float32Array);
      this.side = realloc(this.side, newCapacity * 2, Float32Array);
      this.width = realloc(this.width, newCapacity * 2, Float32Array);
      this.indices_array = realloc(this.indices_array, newCapacity * 6, Uint16Array);
      this.counters = realloc(this.counters, newCapacity * 2, Float32Array);

      this.attributes = {
        position: new THREE.BufferAttribute(this.positions, 3),
        previous: new THREE.BufferAttribute(this.previous, 3),
        next: new THREE.BufferAttribute(this.next, 3),
        side: new THREE.BufferAttribute(this.side, 1),
        width: new THREE.BufferAttribute(this.width, 1),
        index: new THREE.BufferAttribute(this.indices_array, 1),
        counters: new THREE.BufferAttribute(this.counters, 1),
      };

      this.addAttribute('position', this.attributes.position);
      this.addAttribute('previous', this.attributes.previous);
      this.addAttribute('next', this.attributes.next);
      this.addAttribute('side', this.attributes.side);
      this.addAttribute('width', this.attributes.width);
      this.addAttribute('counters', this.attributes.counters);

      this.setIndex(this.attributes.index);
    }
  }

  push(...verts: Array<THREE.Vector3>) {
    this.resize(this.nPoints + verts.length);
    for (const vert of verts) {
      const l = this.nPoints;

      this.positions[l * 6 + 0] = vert.x;
      this.positions[l * 6 + 1] = vert.y;
      this.positions[l * 6 + 2] = vert.z;
      this.positions[l * 6 + 3] = vert.x;
      this.positions[l * 6 + 4] = vert.y;
      this.positions[l * 6 + 5] = vert.z;

      this.side[l * 2 + 0] = 1;
      this.side[l * 2 + 1] = -1;
      this.width[l * 2 + 0] = 1;
      this.width[l * 2 + 1] = 1;

      const previous = l > 0 ? this.copyV3(l - 1) : vert;
      this.previous[l * 6 + 0] = previous.x;
      this.previous[l * 6 + 1] = previous.y;
      this.previous[l * 6 + 2] = previous.z;
      this.previous[l * 6 + 3] = previous.x;
      this.previous[l * 6 + 4] = previous.y;
      this.previous[l * 6 + 5] = previous.z;

      if (l > 0) {
        // update next of previous
        this.next[(l - 1) * 6 + 0] = vert.x;
        this.next[(l - 1) * 6 + 1] = vert.y;
        this.next[(l - 1) * 6 + 2] = vert.z;
        this.next[(l - 1) * 6 + 3] = vert.x;
        this.next[(l - 1) * 6 + 4] = vert.y;
        this.next[(l - 1) * 6 + 5] = vert.z;
      }

      const n = l * 2;
      this.indices_array[(l - 1) * 6 + 0] = n + 0;
      this.indices_array[(l - 1) * 6 + 1] = n + 1;
      this.indices_array[(l - 1) * 6 + 2] = n + 2;
      this.indices_array[(l - 1) * 6 + 3] = n + 2;
      this.indices_array[(l - 1) * 6 + 4] = n + 1;
      this.indices_array[(l - 1) * 6 + 5] = n + 3;

      this.nPoints += 1;
    }

    const l = this.nPoints;

    // next of last = last
    this.next[(l - 1) * 6 + 0] = this.positions[(l - 1) * 6 + 0];
    this.next[(l - 1) * 6 + 1] = this.positions[(l - 1) * 6 + 1];
    this.next[(l - 1) * 6 + 2] = this.positions[(l - 1) * 6 + 2];
    this.next[(l - 1) * 6 + 3] = this.positions[(l - 1) * 6 + 3];
    this.next[(l - 1) * 6 + 4] = this.positions[(l - 1) * 6 + 4];
    this.next[(l - 1) * 6 + 5] = this.positions[(l - 1) * 6 + 5];

    this.attributes.position.needsUpdate = true;
    this.attributes.previous.needsUpdate = true;
    this.attributes.next.needsUpdate = true;
    this.attributes.side.needsUpdate = true;
    this.attributes.width.needsUpdate = true;
    this.attributes.index.needsUpdate = true;
    this.attributes.counters.needsUpdate = true;

    this.setDrawRange(0, (l - 2) * 6);
  }
}

type Parameters = {
  lineWidth: number;
  map: THREE.Texture | null;
  useMap: boolean;
  alphaMap: THREE.Texture | null;
  useAlphaMap: boolean;
  color: THREE.Color;
  opacity: number;
  resolution: THREE.Vector2;
  sizeAttenuation: boolean;
  dashArray: number;
  dashOffset: number;
  dashRatio: number;
  visibility: number;
  alphaTest: number;
  repeat: THREE.Vector2;
};
export class MeshLineMaterial extends THREE.RawShaderMaterial {
  static vertexShaderSource = `
    precision highp float;

    attribute vec3 position;
    attribute vec3 previous;
    attribute vec3 next;
    attribute float side;
    attribute float width;
    attribute float counters;

    // provided by three.js
    uniform mat4 projectionMatrix;
    uniform mat4 modelViewMatrix;

    // MeshLine-specific
    uniform vec2 resolution;
    uniform float lineWidth;
    uniform vec3 color;
    uniform float opacity;
    uniform bool sizeAttenuation;

    varying vec4 vColor;
    varying float vCounters;

    vec2 fix(vec4 i, float aspect) {
      vec2 res = i.xy / i.w;
      res.x *= aspect;
      return res;
    }

    void main() {
      float aspect = resolution.x / resolution.y;
      float pixelWidthRatio = 1. / (resolution.x * projectionMatrix[0][0]);

      vColor = vec4( color, opacity );
      vCounters = counters;

      mat4 m = projectionMatrix * modelViewMatrix;
      vec4 finalPosition = m * vec4( position, 1.0 );
      vec4 prevPos = m * vec4( previous, 1.0 );
      vec4 nextPos = m * vec4( next, 1.0 );

      vec2 currentP = fix( finalPosition, aspect );
      vec2 prevP = fix( prevPos, aspect );
      vec2 nextP = fix( nextPos, aspect );

      float pixelWidth = finalPosition.w * pixelWidthRatio;
      float w = 1.8 * pixelWidth * lineWidth * width;

      if (sizeAttenuation) {
        w = 1.8 * lineWidth * width;
      }

      vec2 dir;
      if (nextP == currentP) {
        dir = normalize( currentP - prevP );
      } else if (prevP == currentP) {
        dir = normalize( nextP - currentP );
      } else {
        vec2 dir1 = normalize( currentP - prevP );
        vec2 dir2 = normalize( nextP - currentP );
        dir = normalize( dir1 + dir2 );

        //vec2 perp = vec2( -dir1.y, dir1.x );
        //vec2 miter = vec2( -dir.y, dir.x );
        //w = clamp( w / dot( miter, perp ), 0., 4. * lineWidth * width );
      }

      vec2 normal = vec2(-dir.y, dir.x);
      normal.x /= aspect;
      normal *= .5 * w;

      vec4 offset = vec4( normal * side, 0.0, 1.0 );
      finalPosition.xy += offset.xy;

      gl_Position = finalPosition;
    }
  `;

  static fragmentShaderSource = `
    #extension GL_OES_standard_derivatives : enable
    precision highp float;

    uniform sampler2D map;
    uniform sampler2D alphaMap;
    uniform bool useDash;
    uniform float dashArray;
    uniform float dashOffset;
    uniform float dashRatio;
    uniform float visibility;
    uniform float alphaTest;
    uniform vec2 repeat;

    varying vec4 vColor;
    varying float vCounters;

    void main() {
        vec4 c = vColor;
        if( c.a < alphaTest ) discard;
        if( useDash ){
            c.a *= ceil(mod(vCounters + dashOffset, dashArray) - (dashArray * dashRatio));
        }
        gl_FragColor = c;
        gl_FragColor.a *= step(vCounters, visibility);
    }
  `;

  lineWidth: number;
  map: THREE.Texture | null;
  useMap: boolean;
  alphaMap: THREE.Texture | null;
  useAlphaMap: boolean;
  color: THREE.Color;
  opacity: number;
  resolution: THREE.Vector2;
  sizeAttenuation: boolean;
  dashArray: number;
  dashOffset: number;
  dashRatio: number;
  visibility: number;
  alphaTest: number;
  repeat: THREE.Vector2;

  constructor(parameters = ({} as any)) {
    Object.assign(this, {
      lineWidth: 1,
      map: null,
      useMap: false,
      alphaMap: null,
      useAlphaMap: false,
      color: new THREE.Color(0xffffff),
      opacity: 1,
      resolution: new THREE.Vector2(1, 1),
      sizeAttenuation: true,
      dashArray: 0,
      dashOffset: 0,
      dashRatio: 0.5,
      visibility: 1,
      alphaTest: 0,
      repeat: new THREE.Vector2(1, 1),
    } as Parameters, parameters);
    super({
      uniforms: {
        lineWidth: { type: 'f', value: this.lineWidth },
        color: { type: 'c', value: this.color },
        opacity: { type: 'f', value: this.opacity },
        resolution: { type: 'v2', value: this.resolution },
        sizeAttenuation: { type: 'b', value: this.sizeAttenuation },
        dashArray: { type: 'f', value: this.dashArray },
        dashOffset: { type: 'f', value: this.dashOffset },
        dashRatio: { type: 'f', value: this.dashRatio },
        useDash: { type: 'b', value: !!this.dashArray },
        visibility: { type: 'f', value: this.visibility },
        alphaTest: { type: 'f', value: this.alphaTest },
        repeat: { type: 'v2', value: this.repeat }
      },
      vertexShader: MeshLineMaterial.vertexShaderSource,
      fragmentShader: MeshLineMaterial.fragmentShaderSource
    });
    this.type = 'MeshLineMaterial';
  }
}
