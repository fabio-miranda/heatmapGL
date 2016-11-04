precision mediump float;

attribute vec3 aVertexPosition;

uniform sampler2D uSamplerF;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uOriginalPMatrix;
uniform float uBandwidth;
uniform float uKernelSize;
uniform float uNumBins;
uniform vec2 uAspectRatio;

varying vec2 originalPos;
varying float value;

void main(void) {
  originalPos = vec2(uOriginalPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0));
  //gl_Position = uOriginalPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
  //gl_Position = uPMatrix * uMVMatrix * vec4(0.5, 0.5, 0, 1);
  value = aVertexPosition.z;
  gl_Position = uPMatrix * vec4(0, 0, 0, 1);
  gl_PointSize = 2.0;
}