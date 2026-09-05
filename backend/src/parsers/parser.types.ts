export type ParserRuntime = 'cpu' | 'gpu';
export interface ParserInput {
  jobId: string;
  filename: string;
  inputObjectKey: string;
  mimeType: string;
}
export interface ParserOutput {
  method: string;
  pages: number;
  fields: Record<string, unknown>;
}
export interface PdfParser {
  method: string;
  supportedRuntimes: ParserRuntime[];
  parse(input: ParserInput): Promise<ParserOutput>;
}
