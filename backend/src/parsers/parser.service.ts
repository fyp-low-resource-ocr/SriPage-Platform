import { Injectable, NotFoundException } from '@nestjs/common';
import { DummyNonVlmParser, DummyVlmParser } from './dummy.parser';
import { PdfParser, ParserRuntime, ParserInput } from './parser.types';
@Injectable()
export class ParserService {
  private readonly parsers = new Map<string, PdfParser>([
    ['non-vlm', new DummyNonVlmParser()],
    ['vlm', new DummyVlmParser()],
  ]);
  private readonly initializedRuntimes = new Set<ParserRuntime>();
  list() {
    return [...this.parsers.values()].map(({ method, supportedRuntimes }) => ({
      method,
      supportedRuntimes,
    }));
  }
  get(method: string) {
    const parser = this.parsers.get(method);
    if (!parser)
      throw new NotFoundException(`Unknown parser method: ${method}`);
    return parser;
  }
  parse(method: string, runtime: ParserRuntime, input: ParserInput) {
    const parser = this.get(method);
    if (!parser.supportedRuntimes.includes(runtime))
      throw new Error(`Method ${method} does not support ${runtime}`);
    this.initializedRuntimes.add(runtime);
    return parser.parse(input);
  }
}
