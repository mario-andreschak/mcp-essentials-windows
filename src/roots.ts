import { Root } from "@modelcontextprotocol/sdk/types.js";
import path from "path";
import { fileURLToPath } from "url";

// Store the current roots
let currentRoots: Root[] = [];

/**
 * Initialize the roots module
 */
export function initRoots(): void {
  currentRoots = [];
}

/**
 * Update the current roots
 * @param roots The new roots to set
 */
export function updateRoots(roots: Root[]): void {
  currentRoots = roots;
  console.error(`Roots updated: ${JSON.stringify(currentRoots)}`);
}

/**
 * Get the current roots
 * @returns The current roots
 */
export function getCurrentRoots(): Root[] {
  return currentRoots;
}

/**
 * Check if a path is allowed based on the current roots
 * @param filePath The path to check
 * @returns True if the path is allowed, false otherwise
 */
export function isPathAllowed(filePath: string): boolean {
  // If no roots are defined, allow access to everything
  if (currentRoots.length === 0) {
    return true;
  }

  // Normalize the path for comparison
  const normalizedPath = path.normalize(filePath);

  // Check if the path is within any of the roots
  return currentRoots.some(root => {
    try {
      // Convert the root URI to a file path
      const rootUrl = new URL(root.uri);
      if (rootUrl.protocol !== 'file:') {
        return false;
      }

      const rootPath = path.normalize(fileURLToPath(rootUrl));
      
      // Check if the path starts with the root path
      return normalizedPath.startsWith(rootPath);
    } catch (error) {
      console.error(`Error checking root ${root.uri}: ${error}`);
      return false;
    }
  });
}
