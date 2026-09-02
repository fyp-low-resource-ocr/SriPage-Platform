import { NotFoundException } from '@nestjs/common';
import { ParserService } from './parser.service';
describe('ParserService', () => {
  it('lists both available methods with Non-VLM first as the default', () => {
    expect(new ParserService().list()).toEqual([{ method: 'non-vlm', supportedRuntimes: ['cpu'] }, { method: 'vlm', supportedRuntimes: ['cpu'] }]);
  });
  it('rejects unknown methods', () => {
    expect(() => new ParserService().get('missing')).toThrow(NotFoundException);
  });
});
