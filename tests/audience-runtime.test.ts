import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { AudienceSystem } from '../src/engine/rendering/AudienceSystem';

const data = JSON.stringify({ version: 1, stride: 4, count: 5,
  seats: [[-2,0,3,0],[-1,0,3,0],[0,0,3,0],[1,0,3,0],[2,0,3,0]] });
const sha256 = createHash('sha256').update(data).digest('hex');
const descriptor = { bytes: Buffer.byteLength(data), sha256, count: 5,
  url: `/assets/venues/timber-hall/audience-seats.${sha256.slice(0,12)}.json` };
function serve() {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(url.endsWith('.json') ? data : 'image')));
  const images: { close: ReturnType<typeof vi.fn>; width: number; height: number }[] = [];
  vi.stubGlobal('createImageBitmap', vi.fn(async () => {
    const image = { close: vi.fn(), width: 512, height: 512 }; images.push(image); return image;
  }));
  return images;
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('audience resource ownership', () => {
  it('does no network work for empty occupancy or an unready venue', () => {
    serve(); const audience = new AudienceSystem();
    audience.apply('timber-hall', descriptor, 'empty', 'quality');
    audience.apply('timber-hall', undefined, 'full', 'quality');
    expect(fetch).not.toHaveBeenCalled();
    expect(audience.group.children).toHaveLength(0);
    audience.dispose();
  });
  it('fetches only low-resolution artwork in Performance and reuses it across exact occupancy changes', async () => {
    const images = serve(); const audience = new AudienceSystem();
    audience.apply('timber-hall', descriptor, 'full', 'performance');
    await vi.waitFor(() => expect(audience.state).toEqual({ status: 'ready', count: 5 }));
    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([descriptor.url,
      '/assets/audience/spectators-front-512.webp', '/assets/audience/spectators-back-512.webp']);
    const textureDispose = vi.spyOn(((audience.group.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).map!, 'dispose');
    audience.apply('timber-hall', descriptor, 'half', 'performance');
    expect(audience.state.count).toBe(2);
    audience.apply('timber-hall', descriptor, 'full', 'performance');
    expect(audience.state.count).toBe(5);
    expect(fetch).toHaveBeenCalledTimes(3);
    audience.apply('timber-hall', descriptor, 'empty', 'performance');
    expect(audience.state).toEqual({ status: 'empty', count: 0 });
    expect(audience.group.children).toHaveLength(0);
    expect(textureDispose).toHaveBeenCalledOnce();
    images.forEach(image => expect(image.close).toHaveBeenCalledOnce());
    audience.dispose();
    images.forEach(image => expect(image.close).toHaveBeenCalledOnce());
  });
  it('rejects corrupt seats before downloading artwork and supports retry', async () => {
    serve(); const audience = new AudienceSystem();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}'));
    audience.apply('timber-hall', descriptor, 'half', 'quality');
    await vi.waitFor(() => expect(audience.state.status).toBe('error'));
    expect(fetch).toHaveBeenCalledOnce();
    audience.retry();
    audience.apply('timber-hall', descriptor, 'half', 'quality');
    await vi.waitFor(() => expect(audience.state).toEqual({ status: 'ready', count: 2 }));
    audience.dispose();
  });
  it('closes an already decoded front atlas if the back request fails', async () => {
    const images = serve(); const audience = new AudienceSystem();
    vi.mocked(fetch).mockImplementation(async url => new Response(String(url).endsWith('.json') ? data : 'image',
      { status: String(url).includes('back') ? 503 : 200 }));
    audience.apply('timber-hall', descriptor, 'full', 'quality');
    await vi.waitFor(() => expect(audience.state.status).toBe('error'));
    expect(images).toHaveLength(1); expect(images[0]!.close).toHaveBeenCalledOnce();
    expect(audience.group.children).toHaveLength(0); audience.dispose();
  });
  it('aborts pending artwork on deselection and never reattaches a late decode', async () => {
    const images = serve(); const audience = new AudienceSystem();
    let finish: ((image: ImageBitmap) => void) | undefined;
    const late = { close: vi.fn(), width: 512, height: 512 };
    vi.mocked(createImageBitmap).mockImplementationOnce(async () => {
      images[0] = { close: vi.fn(), width: 512, height: 512 }; return images[0] as unknown as ImageBitmap;
    })
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    audience.apply('timber-hall', descriptor, 'full', 'quality');
    await vi.waitFor(() => expect(finish).toBeDefined());
    const signal = vi.mocked(fetch).mock.calls[2]![1]!.signal!;
    audience.apply('timber-hall', descriptor, 'empty', 'quality');
    expect(signal.aborted).toBe(true); finish!(late as unknown as ImageBitmap);
    await vi.waitFor(() => expect(late.close).toHaveBeenCalledOnce());
    expect(images[0]!.close).toHaveBeenCalledOnce();
    expect(audience.state.status).toBe('empty');
    expect(audience.group.children).toHaveLength(0); audience.dispose();
  });
});
