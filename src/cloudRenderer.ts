/** A small, texture-free volume renderer. Journey owns its frame scheduling. */
export type CloudRenderer = {
  draw: (progress: number, width: number, height: number) => void;
  dispose: () => void;
};

export function cloudResolution(width: number, height: number) {
  const w = Math.max(1, width), h = Math.max(1, height);
  // The shader receives the viewport aspect separately, so a square buffer
  // remains undistorted while capping the GPU work on either orientation.
  const side = Math.max(1, Math.floor(Math.min(Math.max(w, h), Math.sqrt(Math.min(w, h) < 768 ? 220_000 : 400_000))));
  return { width: side, height: side };
}

// WebKit can retain stale compositing after changing an existing WebGL canvas's
// backing dimensions. Allocate once per canvas, including context restoration;
// a WeakMap lets removed canvases and their cached dimensions be collected.
const canvasResolutions = new WeakMap<HTMLCanvasElement, ReturnType<typeof cloudResolution>>();

const vertexSource = `
attribute vec2 position;
varying vec2 uv;
void main() { uv = position * .5 + .5; gl_Position = vec4(position, 0., 1.); }
`;

// Original procedural scene: a camera above clustered, three-dimensional
// cumulus layer. Density, sunlight and aerial perspective share world space.
const fragmentSource = `precision highp float;
varying vec2 uv;
uniform float aspect;
uniform float progress;
float hash(vec3 p) {
  p = fract(p * .3183099 + vec3(.11,.27,.43));
  p *= 17.;
  return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
}
float noise(vec3 p) {
  vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float smoothMin(float a,float b,float k) { float h=max(k-abs(a-b),0.)/k; return min(a,b)-h*h*k*.25; }
float cloudField(vec3 p) {
  vec2 grid=floor(p.xz/6.);
  float d=30.;
  for(int x=-1;x<=1;x++) for(int z=-1;z<=1;z++) {
    vec2 cell=grid+vec2(float(x),float(z));
    float h=hash(vec3(cell,1.1));
    float j=hash(vec3(cell,4.3));
    vec3 center=vec3((cell.x+.5)*6.+(j-.5)*1.5, .8+h*2., (cell.y+.5)*6.+(h-.5)*1.5);
    vec3 q=p-center;
    float size=2.2+j*1.1;
    float primary=(length(q/vec3(size,1.5+h*1.5,size))-1.)*size;
    vec3 top=q-vec3((h-.5)*2.,1.3,(j-.5)*2.);
    float secondary=length(top)-(1.3+h*1.25);
    float puff=smoothMin(primary,secondary,.9);
    d=smoothMin(d,puff,1.1);
  }
  return d;
}
float density(vec3 p) {
  float d=cloudField(p);
  float base=(1.-smoothstep(-.8,1.2,p.y))*.42;
  if(d>1.5) return base;
  float n=noise(p*.95)*.62+noise(p*2.35+vec3(4.2,3.1,8.3))*.26+noise(p*4.8)*.12;
  return max(base,clamp((-d+(n-.5)*1.9)*.78,0.,1.));
}
void main() {
  float travel=smoothstep(.54,1.,progress);
  vec2 screen=(uv*2.-1.)*vec2(aspect,1.);
  vec3 rd=normalize(vec3(screen.x*.66,screen.y*.66-.22,1.55));
  vec3 ro=vec3(.4+travel*.8,9.3,travel*6.);
  vec3 sun=normalize(vec3(.13,.06,1.));
  float elevation=clamp(rd.y*2.2+.25,0.,1.);
  vec3 sky=mix(vec3(1.,.75,.46),vec3(.24,.51,.78),pow(elevation,.72));
  float sunDot=max(dot(rd,sun),0.);
  float glow=pow(sunDot,32.);
  sky+=vec3(.25,.17,.065)*glow + vec3(1.,.80,.50)*pow(sunDot,2800.)*1.1;
  vec4 cloud=vec4(0.);
  float t=.7;
  for(int i=0;i<64;i++) {
    vec3 p=ro+rd*t;
    if(p.y< -3. || (p.y>10. && rd.y>0.) || t>100. || cloud.a>.99) break;
    float stepSize=.13+t*.061;
    float d=density(p);
    if(d>.005) {
      float shadow=density(p+sun*.7)*.95+density(p+sun*2.2)*1.1;
      float direct=exp(-shadow*2.);
      float rim=pow(max(dot(rd,sun),0.),6.)*.16;
      vec3 ambient=mix(vec3(.38,.45,.57),vec3(.60,.68,.79),smoothstep(-1.,6.5,p.y));
      vec3 lit=ambient+vec3(.68,.56,.39)*(direct+rim);
      lit=mix(lit,sky,1.-exp(-t*.012));
      float a=1.-exp(-d*stepSize*1.35);
      cloud.rgb+=(1.-cloud.a)*a*lit;
      cloud.a+=(1.-cloud.a)*a;
    }
    t+=stepSize;
  }
  vec3 color=cloud.rgb+(1.-cloud.a)*sky;
  color=color/(color*.18+.91);
  gl_FragColor=vec4(color,1.);
}
`;

export function createCloudRenderer(canvas: HTMLCanvasElement): CloudRenderer | null {
  if (typeof WebGLRenderingContext === 'undefined') return null;
  let gl: WebGLRenderingContext | null;
  // Keep the last frame between scroll events. WebKit otherwise clears the
  // canvas when the sticky scene is recomposited or changes orientation.
  // The capped backing size also bounds the memory of this retained buffer.
  try { gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'low-power' }); }
  catch { return null; }
  if (!gl) return null;
  const context = gl;
  const shaders: WebGLShader[] = [];
  const program = context.createProgram();
  const buffer = context.createBuffer();
  const dispose = () => {
    context.deleteBuffer(buffer);
    context.deleteProgram(program);
    shaders.forEach(shader => context.deleteShader(shader));
    delete canvas.dataset.rendered;
  };
  if (!program || !buffer) { dispose(); return null; }
  for (const [type, source] of [[context.VERTEX_SHADER, vertexSource], [context.FRAGMENT_SHADER, fragmentSource]] as const) {
    const shader = context.createShader(type);
    if (!shader) { dispose(); return null; }
    shaders.push(shader);
    context.shaderSource(shader, source);
    context.compileShader(shader);
    context.attachShader(program, shader);
  }
  context.bindAttribLocation(program, 0, 'position');
  context.linkProgram(program);
  if (!context.getProgramParameter(program, context.LINK_STATUS)) { dispose(); return null; }
  context.useProgram(program);
  context.bindBuffer(context.ARRAY_BUFFER, buffer);
  context.bufferData(context.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), context.STATIC_DRAW);
  context.enableVertexAttribArray(0);
  context.vertexAttribPointer(0, 2, context.FLOAT, false, 0, 0);
  const aspectUniform = context.getUniformLocation(program, 'aspect');
  const progressUniform = context.getUniformLocation(program, 'progress');
  let previous = '';
  return {
    draw(progress, width, height) {
      const key = `${Math.round(progress * 2000)}:${width}:${height}`;
      if (previous === key || context.isContextLost()) return;
      previous = key;
      let size = canvasResolutions.get(canvas);
      if (!size) {
        size = cloudResolution(width, height);
        canvasResolutions.set(canvas, size);
      }
      if (canvas.width !== size.width || canvas.height !== size.height) { canvas.width = size.width; canvas.height = size.height; }
      context.viewport(0, 0, canvas.width, canvas.height);
      context.uniform1f(aspectUniform, width / Math.max(1, height));
      context.uniform1f(progressUniform, progress);
      context.drawArrays(context.TRIANGLES, 0, 3);
      canvas.dataset.rendered = 'true';
      canvas.dataset.progress = progress.toFixed(4);
    },
    dispose,
  };
}
