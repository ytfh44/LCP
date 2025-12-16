import {
  toZeroBased,
  toOneBased,
  positionToZeroBased,
  positionToOneBased,
  rangeToZeroBased,
  rangeToOneBased
} from '../../../src/utils/coordinate-converter';

describe('coordinate-converter', () => {
  describe('toZeroBased', () => {
    it('should convert 1-based line number to 0-based', () => {
      expect(toZeroBased(1)).toBe(0);
      expect(toZeroBased(2)).toBe(1);
      expect(toZeroBased(10)).toBe(9);
    });

    it('should return 0 for line number 0', () => {
      expect(toZeroBased(0)).toBe(0);
    });

    it('should handle negative line numbers', () => {
      expect(toZeroBased(-1)).toBe(0);
      expect(toZeroBased(-10)).toBe(0);
    });
  });

  describe('toOneBased', () => {
    it('should convert 0-based line number to 1-based', () => {
      expect(toOneBased(0)).toBe(1);
      expect(toOneBased(1)).toBe(2);
      expect(toOneBased(9)).toBe(10);
    });

    it('should handle negative line numbers', () => {
      expect(toOneBased(-1)).toBe(0);
      expect(toOneBased(-10)).toBe(-9);
    });
  });

  describe('positionToZeroBased', () => {
    it('should convert 1-based position to 0-based', () => {
      const position = { line: 5, character: 10 };
      const result = positionToZeroBased(position);
      
      expect(result).toEqual({ line: 4, character: 10 });
    });

    it('should handle line number 0', () => {
      const position = { line: 0, character: 10 };
      const result = positionToZeroBased(position);
      
      expect(result).toEqual({ line: 0, character: 10 });
    });

    it('should handle negative line numbers', () => {
      const position = { line: -1, character: 10 };
      const result = positionToZeroBased(position);
      
      expect(result).toEqual({ line: 0, character: 10 });
    });
  });

  describe('positionToOneBased', () => {
    it('should convert 0-based position to 1-based', () => {
      const position = { line: 4, character: 10 };
      const result = positionToOneBased(position);
      
      expect(result).toEqual({ line: 5, character: 10 });
    });

    it('should handle line number 0', () => {
      const position = { line: 0, character: 10 };
      const result = positionToOneBased(position);
      
      expect(result).toEqual({ line: 1, character: 10 });
    });

    it('should handle negative line numbers', () => {
      const position = { line: -1, character: 10 };
      const result = positionToOneBased(position);
      
      expect(result).toEqual({ line: 0, character: 10 });
    });
  });

  describe('rangeToZeroBased', () => {
    it('should convert 1-based range to 0-based', () => {
      const range = {
        start: { line: 5, character: 10 },
        end: { line: 10, character: 20 }
      };
      const result = rangeToZeroBased(range);
      
      expect(result).toEqual({
        start: { line: 4, character: 10 },
        end: { line: 9, character: 20 }
      });
    });

    it('should handle range with line number 0', () => {
      const range = {
        start: { line: 0, character: 10 },
        end: { line: 5, character: 20 }
      };
      const result = rangeToZeroBased(range);
      
      expect(result).toEqual({
        start: { line: 0, character: 10 },
        end: { line: 4, character: 20 }
      });
    });

    it('should handle range with negative line numbers', () => {
      const range = {
        start: { line: -1, character: 10 },
        end: { line: 5, character: 20 }
      };
      const result = rangeToZeroBased(range);
      
      expect(result).toEqual({
        start: { line: 0, character: 10 },
        end: { line: 4, character: 20 }
      });
    });
  });

  describe('rangeToOneBased', () => {
    it('should convert 0-based range to 1-based', () => {
      const range = {
        start: { line: 4, character: 10 },
        end: { line: 9, character: 20 }
      };
      const result = rangeToOneBased(range);
      
      expect(result).toEqual({
        start: { line: 5, character: 10 },
        end: { line: 10, character: 20 }
      });
    });

    it('should handle range with line number 0', () => {
      const range = {
        start: { line: 0, character: 10 },
        end: { line: 4, character: 20 }
      };
      const result = rangeToOneBased(range);
      
      expect(result).toEqual({
        start: { line: 1, character: 10 },
        end: { line: 5, character: 20 }
      });
    });

    it('should handle range with negative line numbers', () => {
      const range = {
        start: { line: -1, character: 10 },
        end: { line: 4, character: 20 }
      };
      const result = rangeToOneBased(range);
      
      expect(result).toEqual({
        start: { line: 0, character: 10 },
        end: { line: 5, character: 20 }
      });
    });
  });
});
