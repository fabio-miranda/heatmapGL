precision mediump float;

attribute vec3 aVertexPosition;
uniform sampler2D uSamplerF;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform float uBandwidth;
uniform float uKernelSize;
uniform float uNumBins;

varying float value;

void main(void) {
  gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
  value = aVertexPosition.z;
  gl_PointSize = uKernelSize; //kernel size
}
