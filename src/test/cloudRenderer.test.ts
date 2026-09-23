import { afterEach, describe, expect, it, vi } from 'vitest';
import { cloudResolution, createCloudRenderer } from '../cloudRenderer';

afterEach(() => vi.unstubAllGlobals());

function mockContext(canvas: HTMLCanvasElement) {
  vi.stubGlobal('WebGLRenderingContext', class {});
  const gl = {
    VERTEX_SHADER: 35633, FRAGMENT_SHADER: 35632, LINK_STATUS: 35714,
    ARRAY_BUFFER: 34962, STATIC_DRAW: 35044, FLOAT: 5126, TRIANGLES: 4,
    createProgram: vi.fn(() => ({ kind: 'program' })),
    createBuffer: vi.fn(() => ({ kind: 'buffer' })),
    createShader: vi.fn((type: number) => ({ kind: 'shader', type })),
    shaderSource: vi.fn(), compileShader: vi.fn(), attachShader: vi.fn(),
    bindAttribLocation: vi.fn(), linkProgram: vi.fn(), getProgramParameter: vi.fn(() => true),
    useProgram: vi.fn(), bindBuffer: vi.fn(), bufferData: vi.fn(),
    enableVertexAttribArray: vi.fn(), vertexAttribPointer: vi.fn(),
    getUniformLocation: vi.fn((_program: unknown, name: string) => ({ name })),
    isContextLost: vi.fn(() => false), viewport: vi.fn(), uniform1f: vi.fn(), drawArrays: vi.fn(),
    deleteBuffer: vi.fn(), deleteProgram: vi.fn(), deleteShader: vi.fn(),
  };
  vi.spyOn(canvas, 'getContext').mockReturnValue(gl as unknown as WebGLRenderingContext);
  return gl;
}

describe('cloud render resolution', () => {
  it.each([[360, 740], [390, 844], [430, 932], [768, 1024], [844, 390], [1440, 900], [3840, 2160]])(
    'bounds a stable square buffer for the initial %sx%s viewport', (width, height) => {
      const size = cloudResolution(width, height);
      const budget = Math.min(width, height) < 768 ? 220_000 : 400_000;
      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBe(size.width);
      expect(size.width).toBeLessThanOrEqual(Math.max(width, height));
      expect(size.width * size.height).toBeLessThanOrEqual(budget);
    },
  );

  it('caps small buffers at the larger viewport dimension and avoids empty buffers', () => {
    expect(cloudResolution(200, 300)).toEqual({ width: 300, height: 300 });
    expect(cloudResolution(0, 0)).toEqual({ width: 1, height: 1 });
  });
});

describe('procedural cloud renderer', () => {
  it('returns a fallback without touching the canvas when WebGL is unsupported', () => {
    vi.stubGlobal('WebGLRenderingContext', undefined);
    const canvas = document.createElement('canvas');
    const getContext = vi.spyOn(canvas, 'getContext');
    expect(createCloudRenderer(canvas)).toBeNull();
    expect(getContext).not.toHaveBeenCalled();
  });

  it.each(['unavailable', 'throws'])('returns a fallback when context creation %s', (condition) => {
    vi.stubGlobal('WebGLRenderingContext', class {});
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getContext').mockImplementation(() => {
      if (condition === 'throws') throw new Error('Context creation blocked');
      return null;
    });
    expect(createCloudRenderer(canvas)).toBeNull();
    expect(canvas.dataset.rendered).toBeUndefined();
  });

  it('releases every allocated resource when a shader program cannot link', () => {
    const canvas = document.createElement('canvas');
    const gl = mockContext(canvas);
    gl.getProgramParameter.mockReturnValue(false);
    expect(createCloudRenderer(canvas)).toBeNull();
    expect(gl.deleteBuffer).toHaveBeenCalledTimes(1);
    expect(gl.deleteProgram).toHaveBeenCalledTimes(1);
    expect(gl.deleteShader).toHaveBeenCalledTimes(2);
    expect(gl.drawArrays).not.toHaveBeenCalled();
  });

  it('renders current progress, skips identical frames, reverses, and updates aspect on resize', () => {
    const canvas = document.createElement('canvas');
    const gl = mockContext(canvas);
    const renderer = createCloudRenderer(canvas)!;
    renderer.draw(.7, 390, 844);
    expect(gl.drawArrays).toHaveBeenCalledTimes(1);
    expect(canvas.dataset.rendered).toBe('true');
    expect(canvas.dataset.progress).toBe('0.7000');
    expect({ width: canvas.width, height: canvas.height }).toEqual(cloudResolution(390, 844));
    const initialSize = { width: canvas.width, height: canvas.height };
    const widthSetter = vi.spyOn(canvas, 'width', 'set');
    const heightSetter = vi.spyOn(canvas, 'height', 'set');
    renderer.draw(.7, 390, 844);
    expect(gl.drawArrays).toHaveBeenCalledTimes(1);
    renderer.draw(.9, 390, 844);
    renderer.draw(.7, 390, 844);
    expect(gl.drawArrays).toHaveBeenCalledTimes(3);
    expect(gl.uniform1f).toHaveBeenLastCalledWith({ name: 'progress' }, .7);
    renderer.draw(.7, 844, 390);
    expect(gl.drawArrays).toHaveBeenCalledTimes(4);
    expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'aspect' }, 844 / 390);
    renderer.draw(.7, 1440, 900);
    expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'aspect' }, 1440 / 900);
    expect({ width: canvas.width, height: canvas.height }).toEqual(initialSize);
    expect(widthSetter).not.toHaveBeenCalled();
    expect(heightSetter).not.toHaveBeenCalled();
    expect(gl.viewport).toHaveBeenLastCalledWith(0, 0, canvas.width, canvas.height);
    renderer.dispose();
    expect(gl.deleteBuffer).toHaveBeenCalledTimes(1);
    expect(gl.deleteProgram).toHaveBeenCalledTimes(1);
    expect(gl.deleteShader).toHaveBeenCalledTimes(2);
    expect(canvas.dataset.rendered).toBeUndefined();
  });

  it('retains the canvas allocation when its renderer is recreated after context restoration', () => {
    const canvas = document.createElement('canvas');
    const gl = mockContext(canvas);
    const first = createCloudRenderer(canvas)!;
    first.draw(.7, 390, 844);
    const initialSize = { width: canvas.width, height: canvas.height };
    first.dispose();
    const widthSetter = vi.spyOn(canvas, 'width', 'set');
    const heightSetter = vi.spyOn(canvas, 'height', 'set');
    const restored = createCloudRenderer(canvas)!;
    restored.draw(.8, 1440, 900);
    expect({ width: canvas.width, height: canvas.height }).toEqual(initialSize);
    expect(widthSetter).not.toHaveBeenCalled();
    expect(heightSetter).not.toHaveBeenCalled();
    expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'aspect' }, 1440 / 900);
    expect(canvas.dataset.rendered).toBe('true');
    restored.dispose();
  });

  it('does not issue drawing commands against a lost context', () => {
    const canvas = document.createElement('canvas');
    const gl = mockContext(canvas);
    const renderer = createCloudRenderer(canvas)!;
    gl.isContextLost.mockReturnValue(true);
    renderer.draw(.7, 390, 844);
    expect(gl.drawArrays).not.toHaveBeenCalled();
    expect(canvas.dataset.rendered).toBeUndefined();
    gl.isContextLost.mockReturnValue(false);
    renderer.draw(.7, 390, 844);
    expect(gl.drawArrays).toHaveBeenCalledTimes(1);
  });
});
