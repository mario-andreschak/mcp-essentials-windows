// Simple test script for the new file tools functionality

const fs = require('fs-extra');
const path = require('path');

// Create a test file
async function runTests() {
  console.log('Testing new file tools functionality...');
  
  // Test directory
  const testDir = path.join(__dirname, 'test-files');
  await fs.ensureDir(testDir);
  
  // Test file paths
  const testFile1 = path.join(testDir, 'test1.txt');
  const testFile2 = path.join(testDir, 'test2.txt');
  
  try {
    // Clean up any existing test files
    await fs.remove(testDir);
    await fs.ensureDir(testDir);
    
    // Test 1: Write file with line numbers
    console.log('\nTest 1: Write file with line numbers');
    const contentWithLineNumbers = '1:First line\n2:Second line\n3:Third line';
    await fs.writeFile(testFile1, contentWithLineNumbers);
    console.log('File written with line numbers');
    
    // Simulate stripping line numbers (like line_numbers_included=true)
    const lines = contentWithLineNumbers.split('\n');
    const strippedContent = lines.map(line => {
      const match = line.match(/^\d+:(.*)/);
      return match ? match[1] : line;
    }).join('\n');
    await fs.writeFile(testFile1, strippedContent);
    console.log('Line numbers stripped:');
    console.log(await fs.readFile(testFile1, 'utf-8'));
    
    // Test 2: Read file with line numbers
    console.log('\nTest 2: Read file with line numbers');
    const content = 'First line\nSecond line\nThird line';
    await fs.writeFile(testFile1, content);
    
    // Simulate adding line numbers (like line_numbers_included=true)
    const contentLines = content.split('\n');
    const numberedContent = contentLines.map((line, index) => `${index + 1}:${line}`).join('\n');
    console.log('Content with line numbers:');
    console.log(numberedContent);
    
    // Test 3: Write specific lines
    console.log('\nTest 3: Write specific lines');
    await fs.writeFile(testFile1, 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5');
    
    // Simulate write-lines tool
    const fileContent = (await fs.readFile(testFile1, 'utf-8')).split('\n');
    const lineUpdates = new Map();
    lineUpdates.set(1, 'Modified Line 1');
    lineUpdates.set(4, 'Modified Line 4');
    
    for (const [lineNumber, content] of lineUpdates.entries()) {
      const index = lineNumber - 1;
      fileContent[index] = content;
    }
    
    await fs.writeFile(testFile1, fileContent.join('\n'));
    console.log('After writing specific lines:');
    console.log(await fs.readFile(testFile1, 'utf-8'));
    
    // Test 4: Append text before/after
    console.log('\nTest 4: Append text before/after');
    const originalContent = 'Original content';
    await fs.writeFile(testFile1, originalContent);
    
    // Append before
    const beforeText = 'Text before\n';
    await fs.writeFile(testFile1, beforeText + originalContent);
    console.log('After appending before:');
    console.log(await fs.readFile(testFile1, 'utf-8'));
    
    // Append after
    const afterText = '\nText after';
    await fs.writeFile(testFile1, beforeText + originalContent + afterText);
    console.log('After appending after:');
    console.log(await fs.readFile(testFile1, 'utf-8'));
    
    // Test 5: Search files
    console.log('\nTest 5: Search files');
    await fs.writeFile(path.join(testDir, 'file1.txt'), 'This is a test file with some content');
    await fs.writeFile(path.join(testDir, 'file2.txt'), 'Another file with different content');
    await fs.writeFile(path.join(testDir, 'file3.js'), 'console.log("Hello world");');
    
    // Simulate search-files tool
    const pattern = 'test';
    const regex = new RegExp(pattern, 'i');
    const files = await fs.readdir(testDir);
    
    console.log(`Searching for pattern: ${pattern}`);
    for (const file of files) {
      const filePath = path.join(testDir, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isFile()) {
        // Search in file name
        if (regex.test(file)) {
          console.log(`File name matches: ${file}`);
        }
        
        // Search in content
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            console.log(`Match in ${file}, line ${i + 1}: ${lines[i]}`);
          }
        }
      }
    }
    
    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Error during tests:', error);
  } finally {
    // Clean up test files
    await fs.remove(testDir);
  }
}

runTests();
