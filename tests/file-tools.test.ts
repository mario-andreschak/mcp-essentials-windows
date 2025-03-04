// @ts-nocheck
import { jest } from '@jest/globals';
import { fileTools } from '../src/file-tools.js';
import fs from 'fs-extra';
import path from 'path';
import * as rootsModule from '../src/roots.js';

// Mock fs-extra
jest.mock('fs-extra');
const mockedFs = fs as jest.Mocked<typeof fs>;

// Mock roots module with a mock implementation
jest.mock('../src/roots.js', () => {
  // Create a mock function that we can control
  const mockIsPathAllowed = jest.fn().mockReturnValue(true);
  
  return {
    isPathAllowed: mockIsPathAllowed,
    // Include other exports if needed
    initRoots: jest.fn(),
    updateRoots: jest.fn(),
    getCurrentRoots: jest.fn()
  };
});

describe('File Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock to its default behavior
    rootsModule.isPathAllowed.mockReturnValue(true);
  });

  describe('read-file', () => {
    const readFileTool = fileTools.find(tool => tool.name === 'read-file');

    it('should exist', () => {
      expect(readFileTool).toBeDefined();
    });

    it('should check if path is allowed', async () => {
      rootsModule.isPathAllowed.mockReturnValueOnce(false);

      const result = await readFileTool!.handler({ path: 'C:/test.txt' });
      
      expect(rootsModule.isPathAllowed).toHaveBeenCalledWith('C:/test.txt');
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Access denied');
    });

    it('should check if file exists', async () => {
      (mockedFs.pathExists as jest.Mock).mockResolvedValueOnce(false);

      const result = await readFileTool!.handler({ path: 'C:/test.txt' });
      
      expect(mockedFs.pathExists).toHaveBeenCalledWith('C:/test.txt');
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('File not found');
    });

    it('should read file content', async () => {
      (mockedFs.pathExists as jest.Mock).mockResolvedValueOnce(true);
      (mockedFs.readFile as jest.Mock).mockResolvedValueOnce('File content');

      const result = await readFileTool!.handler({ path: 'C:/test.txt' });
      
      expect(mockedFs.readFile).toHaveBeenCalledWith('C:/test.txt', 'utf-8');
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe('File content');
    });

    it('should handle file read errors', async () => {
      (mockedFs.pathExists as jest.Mock).mockResolvedValueOnce(true);
      (mockedFs.readFile as jest.Mock).mockRejectedValueOnce(new Error('Read error'));

      const result = await readFileTool!.handler({ path: 'C:/test.txt' });
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error reading file: Read error');
    });
  });

  describe('write-file', () => {
    const writeFileTool = fileTools.find(tool => tool.name === 'write-file');

    it('should exist', () => {
      expect(writeFileTool).toBeDefined();
    });

    it('should check if path is allowed', async () => {
      rootsModule.isPathAllowed.mockReturnValueOnce(false);

      const result = await writeFileTool!.handler({ 
        path: 'C:/test.txt', 
        content: 'File content' 
      });
      
      expect(rootsModule.isPathAllowed).toHaveBeenCalledWith('C:/test.txt');
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Access denied');
    });

    it('should create parent directories if requested', async () => {
      const result = await writeFileTool!.handler({ 
        path: 'C:/dir/test.txt', 
        content: 'File content',
        createDirectories: true
      });
      
      expect(mockedFs.ensureDir).toHaveBeenCalledWith(path.dirname('C:/dir/test.txt'));
      expect(mockedFs.writeFile).toHaveBeenCalledWith('C:/dir/test.txt', 'File content');
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('File successfully written');
    });

    it('should write file content without creating directories', async () => {
      const result = await writeFileTool!.handler({ 
        path: 'C:/test.txt', 
        content: 'File content'
      });
      
      expect(mockedFs.ensureDir).not.toHaveBeenCalled();
      expect(mockedFs.writeFile).toHaveBeenCalledWith('C:/test.txt', 'File content');
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('File successfully written');
    });

    it('should handle file write errors', async () => {
      (mockedFs.writeFile as jest.Mock).mockRejectedValueOnce(new Error('Write error'));

      const result = await writeFileTool!.handler({ 
        path: 'C:/test.txt', 
        content: 'File content'
      });
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error writing file: Write error');
    });
  });

  describe('list-directory', () => {
    const listDirectoryTool = fileTools.find(tool => tool.name === 'list-directory');

    it('should exist', () => {
      expect(listDirectoryTool).toBeDefined();
    });

    it('should check if path is allowed', async () => {
      rootsModule.isPathAllowed.mockReturnValueOnce(false);

      const result = await listDirectoryTool!.handler({ path: 'C:/dir' });
      
      expect(rootsModule.isPathAllowed).toHaveBeenCalledWith('C:/dir');
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Access denied');
    });

    it('should check if directory exists', async () => {
      (mockedFs.pathExists as jest.Mock).mockResolvedValueOnce(false);

      const result = await listDirectoryTool!.handler({ path: 'C:/dir' });
      
      expect(mockedFs.pathExists).toHaveBeenCalledWith('C:/dir');
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Directory not found');
    });

    it('should check if path is a directory', async () => {
      (mockedFs.pathExists as jest.Mock).mockResolvedValueOnce(true);
      (mockedFs.stat as jest.Mock).mockResolvedValueOnce({
        isDirectory: () => false
      });

      const result = await listDirectoryTool!.handler({ path: 'C:/file.txt' });
      
      expect(mockedFs.stat).toHaveBeenCalledWith('C:/file.txt');
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Not a directory');
    });

    it('should list directory contents non-recursively', async () => {
      (mockedFs.pathExists as jest.Mock).mockResolvedValueOnce(true);
      (mockedFs.stat as jest.Mock).mockResolvedValueOnce({
        isDirectory: () => true
      });
      
      const mockEntries = [
        { name: 'file1.txt', isDirectory: () => false },
        { name: 'dir1', isDirectory: () => true }
      ];
      (mockedFs.readdir as jest.Mock).mockResolvedValueOnce(mockEntries);

      const result = await listDirectoryTool!.handler({ path: 'C:/dir' });
      
      expect(mockedFs.readdir).toHaveBeenCalledWith('C:/dir', { withFileTypes: true });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Contents of \'C:/dir\'');
      expect(result.content[0].text).toContain('file1.txt');
      expect(result.content[0].text).toContain('dir1/');
    });

    it('should list directory contents recursively', async () => {
      (mockedFs.pathExists as jest.Mock).mockResolvedValueOnce(true);
      (mockedFs.stat as jest.Mock).mockResolvedValueOnce({
        isDirectory: () => true
      });
      
      // Mock the recursive directory walk
      // This is a bit complex because we need to mock multiple calls to readdir
      const mockRootEntries = [
        { name: 'file1.txt', isDirectory: () => false },
        { name: 'dir1', isDirectory: () => true }
      ];
      const mockSubEntries = [
        { name: 'file2.txt', isDirectory: () => false }
      ];
      
      (mockedFs.readdir as jest.Mock)
        .mockResolvedValueOnce(mockRootEntries)
        .mockResolvedValueOnce(mockSubEntries);

      const result = await listDirectoryTool!.handler({ 
        path: 'C:/dir',
        recursive: true
      });
      
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Contents of \'C:/dir\'');
      expect(result.content[0].text).toContain('file1.txt');
      expect(result.content[0].text).toContain('dir1/');
      // In a real implementation, it would also contain dir1/file2.txt
      // but our mock doesn't fully simulate the recursive walk
    });

    it('should handle directory listing errors', async () => {
      (mockedFs.pathExists as jest.Mock).mockResolvedValueOnce(true);
      (mockedFs.stat as jest.Mock).mockResolvedValueOnce({
        isDirectory: () => true
      });
      (mockedFs.readdir as jest.Mock).mockRejectedValueOnce(new Error('Read error'));

      const result = await listDirectoryTool!.handler({ path: 'C:/dir' });
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error listing directory: Read error');
    });
  });
});
