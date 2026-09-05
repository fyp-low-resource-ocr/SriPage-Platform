import {
  ParserInput,
  ParserOutput,
  PdfParser,
  ParserRuntime,
} from './parser.types';

export class ModelParser implements PdfParser {
  // Runtime is retained for API compatibility. CPU/GPU placement belongs to
  // the model deployment, not to this worker.
  supportedRuntimes: ParserRuntime[] = ['cpu', 'gpu'];
  constructor(
    public readonly method: string,
    private readonly endpoint: string,
    private readonly timeoutMs: number,
  ) {}

  async parse(input: ParserInput): Promise<ParserOutput> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(
        `${this.endpoint.replace(/\/$/, '')}/v1/parse`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
          signal: controller.signal,
        },
      );
      if (!response.ok)
        throw new Error(`Model service returned HTTP ${response.status}`);
      const output = (await response.json()) as Partial<ParserOutput>;
      if (typeof output.pages !== 'number' || !output.fields) {
        throw new Error('Model service returned an invalid parser result');
      }
      return {
        method: this.method,
        pages: output.pages,
        fields: output.fields,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Model service timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function modelParserConfig(method: string) {
  const envName = `${method.replace(/-/g, '_').toUpperCase()}_MODEL_URL`;
  return new ModelParser(
    method,
    process.env[envName] ?? `http://localhost:8080`,
    Number(process.env.MODEL_REQUEST_TIMEOUT_MS ?? 300_000),
  );
}
