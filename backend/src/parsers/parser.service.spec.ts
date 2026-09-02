import { NotFoundException } from '@nestjs/common';
import { ParserService } from './parser.service';
describe('ParserService', () => {
  it('lists the default VLM method', () => {
    expect(new ParserService().list()).toEqual([{ method: 'vlm', supportedRuntimes: ['cpu'] }]);
  });
  it('rejects unknown methods', () => {
    expect(() => new ParserService().get('missing')).toThrow(NotFoundException);
  });
});
