import { Injectable, NotFoundException } from '@nestjs/common';
import { modelParserConfig } from './model.parser';
import { PdfParser, ParserRuntime, ParserInput } from './parser.types';
@Injectable()
export class ParserService {
  private readonly parsers: Map<string, PdfParser>;
  constructor() {
    this.parsers = new Map([
      ['non-vlm', modelParserConfig('non-vlm')],
      ['vlm', modelParserConfig('vlm')],
    ]);
  }
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
    return parser.parse(input);
  }
}
