attribute vec3 aVertexPosition;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

varying float vValue;

void main(void) {
  vValue = aVertexPosition.z;
  gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition.xy, 0.0, 1.0);
  gl_PointSize = 1.0;
}
