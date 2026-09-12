import { createHash, randomUUID } from 'node:crypto';
import { readFile, rename, writeFile, unlink } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

export class RequestError extends Error {
  public status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
const revisionOf = (bytes: string) => createHash('sha256').update(bytes).digest('hex');

type CatalogAdapter<T> = {
  endpoint: string;
  validate: (value: unknown) => T;
  change: (catalog: T, operation: 'save' | 'delete', body: Record<string, unknown>) => { catalog: T; savedId?: string };
};
export function createProjectStore<T>(file: string, adapter: CatalogAdapter<T>) {
  let queue = Promise.resolve();
  async function read() {
    const bytes = await readFile(file, 'utf8');
    return { ...adapter.validate(JSON.parse(bytes)), revision: revisionOf(bytes) };
  }
  function mutate(operation: 'save' | 'delete', body: Record<string, unknown>) {
    const task = queue.then(async () => {
      const current = await read();
      if (body.revision !== current.revision) throw new RequestError(409, 'The project catalog changed. Review the refreshed library, then save again. Your editor draft is retained.');
      const { catalog, savedId } = adapter.change(current, operation, body);
      const bytes = JSON.stringify(catalog, null, 2) + '\n';
      const temporary = `${file}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, bytes, { encoding: 'utf8', flag: 'wx' });
        await rename(temporary, file);
      } finally { await unlink(temporary).catch(() => undefined); }
      return { ...catalog, revision: revisionOf(bytes), savedId };
    });
    queue = task.then(() => undefined, () => undefined);
    return task;
  }
  return { read, mutate };
}

function localRequest(req: IncomingMessage) {
  const remote = req.socket.remoteAddress ?? '';
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)) return false;
  try {
    const host = new URL(`http://${req.headers.host}`);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(host.hostname)) return false;
    return !req.headers.origin || new URL(req.headers.origin).origin === host.origin;
  } catch { return false; }
}

export function projectMiddleware<T>(file: string, adapter: CatalogAdapter<T>) {
  const store = createProjectStore(file, adapter);
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.url?.split('?')[0] !== adapter.endpoint) { next(); return; }
    res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
    try {
      if (!localRequest(req)) throw new RequestError(403, 'Project editing is available only on this computer.');
      if (req.method === 'GET') { res.end(JSON.stringify(await store.read())); return; }
      if (!['PUT', 'DELETE'].includes(req.method ?? '')) throw new RequestError(405, 'Method not supported.');
      if (req.headers['x-tenmulate-project'] !== '1' || req.headers['content-type']?.split(';')[0] !== 'application/json')
        throw new RequestError(403, 'A same-origin project editor request is required.');
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 1_000_000) throw new RequestError(413, 'Project entry is too large.');
        chunks.push(chunk);
      }
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
      } catch { throw new RequestError(400, 'Invalid JSON request.'); }
      const result = await store.mutate(req.method === 'PUT' ? 'save' : 'delete', body);
      res.end(JSON.stringify(result));
    } catch (error) {
      res.statusCode = error instanceof RequestError ? error.status : error instanceof SyntaxError ? 400 : 422;
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Project save failed.' }));
    }
  };
}

export function projectCatalogPlugin<T>(name: string, catalogFile: string, adapter: CatalogAdapter<T>): Plugin {
  const file = resolve(catalogFile);
  return {
    name,
    configureServer(server) { server.middlewares.use(projectMiddleware(file, adapter)); },
    // The API response refreshes the catalog. A full reload would discard live UI state.
    handleHotUpdate(context) { if (resolve(context.file) === file) return []; },
  };
}
