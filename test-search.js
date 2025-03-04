import { webTools } from './dist/web-tools.js';

// Find the web-search tool
const webSearchTool = webTools.find(tool => tool.name === 'web-search');

if (!webSearchTool) {
  console.error('Web search tool not found!');
  process.exit(1);
}

// Test the web-search tool with "Mario Andreschak"
async function testSearch() {
  try {
    console.log('Searching for "Mario Andreschak"...');
    const result = await webSearchTool.handler({ query: 'Mario Andreschak' });
    
    console.log('Search results:');
    console.log(result.content[0].text);
    
    // Check if GitHub is in the results
    const hasGithub = result.content[0].text.toLowerCase().includes('github');
    console.log('\nGitHub found in results:', hasGithub);
    
    return hasGithub;
  } catch (error) {
    console.error('Error during search:', error);
    return false;
  }
}

testSearch().then(success => {
  if (!success) {
    console.log('GitHub not found in results. The implementation may need improvement.');
    process.exit(1);
  } else {
    console.log('Test passed! GitHub found in results.');
    process.exit(0);
  }
});
