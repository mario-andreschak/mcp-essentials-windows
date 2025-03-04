// @ts-nocheck
import { jest } from '@jest/globals';
import { cmdTools } from '../src/cmd-tools.js';
import { exec } from 'child_process';
import * as rootsModule from '../src/roots.js';

// Mock child_process.exec
jest.mock('child_process', () => ({
  exec: jest.fn(),
  // Include other exports if needed
}));

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

describe('Command Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock to its default behavior
    rootsModule.isPathAllowed.mockReturnValue(true);
  });

  describe('execute-command', () => {
    const executeCommandTool = cmdTools.find(tool => tool.name === 'execute-command');

    it('should exist', () => {
      expect(executeCommandTool).toBeDefined();
    });

    it('should check if working directory is allowed', async () => {
      rootsModule.isPathAllowed.mockReturnValueOnce(false);

      const result = await executeCommandTool!.handler({ 
        command: 'echo test', 
        workingDir: 'C:/restricted' 
      });
      
      expect(rootsModule.isPathAllowed).toHaveBeenCalledWith('C:/restricted');
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Access denied');
    });

    it('should execute command successfully', async () => {
      // Mock successful command execution
      (exec as unknown as jest.Mock).mockImplementationOnce((cmd, options, callback) => {
        (callback as Function)(null, { stdout: 'Command output', stderr: '' });
        return { stdout: 'Command output', stderr: '' };
      });

      const result = await executeCommandTool!.handler({ command: 'echo test' });
      
      expect(exec).toHaveBeenCalled();
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('STDOUT:\nCommand output');
    });

    it('should handle command with stderr output', async () => {
      // Mock command execution with stderr
      (exec as unknown as jest.Mock).mockImplementationOnce((cmd, options, callback) => {
        (callback as Function)(null, { stdout: 'Command output', stderr: 'Warning message' });
        return { stdout: 'Command output', stderr: 'Warning message' };
      });

      const result = await executeCommandTool!.handler({ command: 'echo test' });
      
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('STDOUT:\nCommand output');
      expect(result.content[0].text).toContain('STDERR:\nWarning message');
    });

    it('should handle command execution errors', async () => {
      // Mock command execution error
      const error = new Error('Command failed');
      (error as any).code = 1;
      (error as any).stdout = 'Some output';
      (error as any).stderr = 'Error message';
      
      (exec as unknown as jest.Mock).mockImplementationOnce((cmd, options, callback) => {
        (callback as Function)(error, { stdout: 'Some output', stderr: 'Error message' });
        return { stdout: 'Some output', stderr: 'Error message' };
      });

      const result = await executeCommandTool!.handler({ command: 'invalid-command' });
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error executing command');
      expect(result.content[0].text).toContain('Exit code: 1');
      expect(result.content[0].text).toContain('STDOUT:\nSome output');
      expect(result.content[0].text).toContain('STDERR:\nError message');
    });

    it('should respect timeout option', async () => {
      // Mock successful command execution
      (exec as unknown as jest.Mock).mockImplementationOnce((cmd, options, callback) => {
        (callback as Function)(null, { stdout: 'Command output', stderr: '' });
        return { stdout: 'Command output', stderr: '' };
      });

      const result = await executeCommandTool!.handler({ 
        command: 'echo test', 
        timeout: 5000 
      });
      
      expect(exec).toHaveBeenCalledWith(
        'echo test', 
        expect.objectContaining({ timeout: 5000 }),
        expect.any(Function)
      );
    });
  });

  describe('execute-powershell', () => {
    const executePowershellTool = cmdTools.find(tool => tool.name === 'execute-powershell');

    it('should exist', () => {
      expect(executePowershellTool).toBeDefined();
    });

    it('should check if working directory is allowed', async () => {
      rootsModule.isPathAllowed.mockReturnValueOnce(false);

      const result = await executePowershellTool!.handler({ 
        script: 'Get-Process', 
        workingDir: 'C:/restricted' 
      });
      
      expect(rootsModule.isPathAllowed).toHaveBeenCalledWith('C:/restricted');
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Access denied');
    });

    it('should execute PowerShell script successfully', async () => {
      // Mock successful script execution
      (exec as unknown as jest.Mock).mockImplementationOnce((cmd, options, callback) => {
        (callback as Function)(null, { stdout: 'Script output', stderr: '' });
        return { stdout: 'Script output', stderr: '' };
      });

      const result = await executePowershellTool!.handler({ script: 'Get-Process' });
      
      expect(exec).toHaveBeenCalledWith(
        expect.stringContaining('powershell'),
        expect.any(Object),
        expect.any(Function)
      );
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('STDOUT:\nScript output');
    });

    it('should escape single quotes in the script', async () => {
      (exec as unknown as jest.Mock).mockImplementationOnce((cmd, options, callback) => {
        (callback as Function)(null, { stdout: 'Script output', stderr: '' });
        return { stdout: 'Script output', stderr: '' };
      });

      await executePowershellTool!.handler({ script: "Write-Host 'Hello'" });
      
      expect(exec).toHaveBeenCalledWith(
        expect.stringContaining("''Hello''"),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should handle script execution errors', async () => {
      // Mock script execution error
      const error = new Error('Script failed');
      (error as any).code = 1;
      (error as any).stdout = 'Some output';
      (error as any).stderr = 'Error message';
      
      (exec as unknown as jest.Mock).mockImplementationOnce((cmd, options, callback) => {
        (callback as Function)(error, { stdout: 'Some output', stderr: 'Error message' });
        return { stdout: 'Some output', stderr: 'Error message' };
      });

      const result = await executePowershellTool!.handler({ script: 'Invalid-Command' });
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error executing PowerShell script');
      expect(result.content[0].text).toContain('Exit code: 1');
      expect(result.content[0].text).toContain('STDOUT:\nSome output');
      expect(result.content[0].text).toContain('STDERR:\nError message');
    });

    it('should respect timeout option', async () => {
      // Mock successful script execution
      (exec as unknown as jest.Mock).mockImplementationOnce((cmd, options, callback) => {
        (callback as Function)(null, { stdout: 'Script output', stderr: '' });
        return { stdout: 'Script output', stderr: '' };
      });

      const result = await executePowershellTool!.handler({ 
        script: 'Get-Process', 
        timeout: 5000 
      });
      
      expect(exec).toHaveBeenCalledWith(
        expect.any(String), 
        expect.objectContaining({ timeout: 5000 }),
        expect.any(Function)
      );
    });
  });
});
