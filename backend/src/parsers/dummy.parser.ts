import { PdfParser } from './parser.types';
export class DummyVlmParser implements PdfParser {
  method = 'vlm'; supportedRuntimes = ['cpu' as const];
  async parse(input: Parameters<PdfParser['parse']>[0]) {
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    return { method: this.method, pages: 1, fields: { document_type: 'dummy-invoice', filename: input.filename, invoice_number: 'DEMO-0001', total: 1234.56, processed_at: new Date().toISOString() } };
  }
}
