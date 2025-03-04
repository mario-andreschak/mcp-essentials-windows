// @ts-nocheck
import { jest } from '@jest/globals';
import { initRoots, updateRoots, getCurrentRoots, isPathAllowed } from '../src/roots.js';
import { fileURLToPath } from 'url';

// Mock url module
jest.mock('url', () => ({
  fileURLToPath: jest.fn((url) => {
    if (url === 'file:///C:/allowed') return 'C:/allowed';
    if (url === 'file:///C:/another') return 'C:/another';
    return url.replace('file://', '');
  })
}));

describe('Roots Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    initRoots();
  });

  describe('initRoots', () => {
    it('should initialize roots to an empty array', () => {
      // Call initRoots again to ensure it resets
      initRoots();
      expect(getCurrentRoots()).toEqual([]);
    });
  });

  describe('updateRoots', () => {
    it('should update the current roots', () => {
      const newRoots = [
        { uri: 'file:///C:/test', name: 'Test Root' }
      ];
      
      updateRoots(newRoots);
      expect(getCurrentRoots()).toEqual(newRoots);
    });
  });

  describe('getCurrentRoots', () => {
    it('should return the current roots', () => {
      const newRoots = [
        { uri: 'file:///C:/test1', name: 'Test Root 1' },
        { uri: 'file:///C:/test2', name: 'Test Root 2' }
      ];
      
      updateRoots(newRoots);
      expect(getCurrentRoots()).toEqual(newRoots);
    });
  });

  describe('isPathAllowed', () => {
    it('should allow all paths when no roots are defined', () => {
      initRoots(); // Ensure no roots
      expect(isPathAllowed('C:/any/path')).toBe(true);
    });

    it('should check if path is within any root', () => {
      // Set up roots
      updateRoots([
        { uri: 'file:///C:/allowed', name: 'Allowed Root' },
        { uri: 'file:///C:/another', name: 'Another Root' }
      ]);

      // Test paths
      expect(isPathAllowed('C:/allowed/file.txt')).toBe(true);
      expect(isPathAllowed('C:/allowed/subdir/file.txt')).toBe(true);
      expect(isPathAllowed('C:/another/file.txt')).toBe(true);
      expect(isPathAllowed('C:/restricted/file.txt')).toBe(false);
    });

    it('should handle non-file protocol roots', () => {
      updateRoots([
        { uri: 'http://example.com', name: 'Web Root' }
      ]);

      // Non-file protocol roots should not affect file path checks
      expect(isPathAllowed('C:/any/path')).toBe(false);
    });

    it('should handle errors in URL parsing', () => {
      // Override the mock for this test only
      jest.spyOn(URL.prototype, 'href', 'get').mockImplementation(() => {
        throw new Error('Invalid URL');
      });

      updateRoots([
        { uri: 'file:///C:/allowed', name: 'Allowed Root' }
      ]);

      // Should return false when URL parsing fails
      expect(isPathAllowed('C:/any/path')).toBe(false);
    });
  });
});
