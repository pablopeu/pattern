import { describe, expect, it } from 'vitest';
import { newStudy } from '../app/model';
import {
  SHARE_LIMITS,
  byteLength,
  gzipSize,
  shareDocument,
  validateSharePayload,
} from '../share/document';
import { parseProject } from '../persistence/schema';
import { documentHash } from '../share/api';

const sample = () => {
  const project = newStudy();
  project.metadata.name = 'Publicación de prueba';
  return project;
};

describe('documento compartible', () => {
  it('serializa compacto, valida con el esquema vigente y reabre idéntico', () => {
    const project = sample(),
      document = shareDocument(project);
    expect(document.includes('\n')).toBe(false);
    expect(parseProject(document)).toEqual(parseProject(JSON.stringify(project)));
    expect(() =>
      validateSharePayload({ protocol: SHARE_LIMITS.protocol, document }),
    ).not.toThrow();
  });
  it('rechaza protocolo, tamaño y miniaturas inválidas', () => {
    const document = shareDocument(sample());
    expect(() => validateSharePayload({ protocol: 9, document })).toThrow(/protocolo/);
    expect(() =>
      validateSharePayload({ protocol: 1, document: 'x'.repeat(SHARE_LIMITS.documentBytes + 1) }),
    ).toThrow(/límite/);
    expect(() =>
      validateSharePayload({ protocol: 1, document, preview: 'data:image/svg+xml;base64,PHN2Zz4=' }),
    ).toThrow(/JPEG/);
    expect(() =>
      validateSharePayload({
        protocol: 1,
        document,
        preview: `data:image/jpeg;base64,${'A'.repeat(200 * 1024)}`,
      }),
    ).toThrow(/miniatura|tamaño/);
  });
  it('mide bytes reales y comprime mejor que el JSON crudo', async () => {
    const document = shareDocument(sample()),
      json = byteLength(document),
      gzip = await gzipSize(document);
    expect(json).toBeGreaterThan(0);
    expect(gzip).toBeGreaterThan(0);
    expect(gzip).toBeLessThan(json);
  });
  it('documentHash es estable y distinta por contenido', async () => {
    const a = await documentHash('contenido'),
      b = await documentHash('contenido'),
      c = await documentHash('contenido-2');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
