#!/usr/bin/env node

/**
 * Script to find START tags that are substrings of other START tags.
 *
 * This demonstrates why simple string matching is problematic when
 * refactoring code that uses snippet markers like [START tag_name].
 *
 * Problem scenarios:
 * 1. Tag "foo" is a substring of "foo_bar" - searching for "[START foo]"
 *    might accidentally match when replacing "[START foo_bar]"
 * 2. When doing find/replace, you might match partial tags
 * 3. Regex without word boundaries can cause false positives
 */

const fs = require('fs');
const path = require('path');

// Patterns to find START tags
const START_TAG_PATTERN = /\[START\s+([^\]]+)\]/g;

/**
 * Recursively find all files in a directory
 */
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);

    // Skip common non-source directories
    if (file === 'node_modules' || file === '.git' || file === 'build' || file === '.gradle') {
      return;
    }

    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

/**
 * Extract all START tags from a file
 */
function extractStartTags(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const tags = [];
    let match;

    while ((match = START_TAG_PATTERN.exec(content)) !== null) {
      tags.push({
        tag: match[1].trim(),
        file: filePath,
        fullMatch: match[0]
      });
    }

    return tags;
  } catch (err) {
    // Skip binary files or files we can't read
    return [];
  }
}

/**
 * Find tags that are substrings of other tags
 */
function findSubstringTags(allTags) {
  const uniqueTags = [...new Set(allTags.map(t => t.tag))].sort();
  const substringPairs = [];

  for (let i = 0; i < uniqueTags.length; i++) {
    for (let j = 0; j < uniqueTags.length; j++) {
      if (i !== j) {
        const shorter = uniqueTags[i];
        const longer = uniqueTags[j];

        // Check if shorter tag is a substring of longer tag
        // and they're not the same
        if (longer.includes(shorter) && shorter !== longer) {
          substringPairs.push({
            substring: shorter,
            superstring: longer
          });
        }
      }
    }
  }

  return substringPairs;
}

/**
 * Get file locations for a specific tag
 */
function getTagLocations(allTags, tagName) {
  return allTags
    .filter(t => t.tag === tagName)
    .map(t => t.file);
}

/**
 * Main function
 */
function main() {
  console.log('='.repeat(80));
  console.log('START Tag Substring Analysis');
  console.log('='.repeat(80));
  console.log();

  const rootDir = process.cwd();
  console.log(`Scanning directory: ${rootDir}`);
  console.log();

  // Get all files
  const allFiles = getAllFiles(rootDir);
  console.log(`Found ${allFiles.length} files to scan`);

  // Extract all START tags
  const allTags = [];
  allFiles.forEach(file => {
    const tags = extractStartTags(file);
    allTags.push(...tags);
  });

  console.log(`Found ${allTags.length} total START tags`);

  const uniqueTags = [...new Set(allTags.map(t => t.tag))];
  console.log(`Found ${uniqueTags.length} unique tag names`);
  console.log();

  // Find substring pairs
  const substringPairs = findSubstringTags(allTags);

  // Deduplicate and organize by substring
  const bySubstring = {};
  substringPairs.forEach(pair => {
    if (!bySubstring[pair.substring]) {
      bySubstring[pair.substring] = new Set();
    }
    bySubstring[pair.substring].add(pair.superstring);
  });

  console.log('='.repeat(80));
  console.log('TAGS THAT ARE SUBSTRINGS OF OTHER TAGS');
  console.log('='.repeat(80));
  console.log();
  console.log(`Found ${Object.keys(bySubstring).length} tags that are substrings of other tags`);
  console.log();

  // Sort by number of superstrings (most problematic first)
  const sortedSubstrings = Object.entries(bySubstring)
    .map(([sub, supers]) => ({ substring: sub, superstrings: [...supers].sort() }))
    .sort((a, b) => b.superstrings.length - a.superstrings.length);

  sortedSubstrings.forEach(({ substring, superstrings }) => {
    const locations = getTagLocations(allTags, substring);
    console.log(`\n[START ${substring}]`);
    console.log(`  Found in ${locations.length} file(s):`);
    locations.slice(0, 3).forEach(loc => {
      console.log(`    - ${path.relative(rootDir, loc)}`);
    });
    if (locations.length > 3) {
      console.log(`    ... and ${locations.length - 3} more`);
    }
    console.log(`  Is a substring of ${superstrings.length} other tag(s):`);
    superstrings.slice(0, 5).forEach(sup => {
      console.log(`    - [START ${sup}]`);
    });
    if (superstrings.length > 5) {
      console.log(`    ... and ${superstrings.length - 5} more`);
    }
  });

  // Demonstrate the problem
  console.log();
  console.log('='.repeat(80));
  console.log('WHY THIS IS A PROBLEM FOR SIMPLE STRING MATCHING');
  console.log('='.repeat(80));
  console.log();

  console.log('Example problematic scenarios:');
  console.log();

  if (sortedSubstrings.length > 0) {
    const example = sortedSubstrings[0];
    console.log(`1. FIND/REPLACE COLLISION:`);
    console.log(`   If you search for: "[START ${example.substring}]"`);
    console.log(`   You might accidentally match text containing:`);
    example.superstrings.slice(0, 3).forEach(sup => {
      console.log(`     "[START ${sup}]"`);
    });
    console.log();

    console.log(`2. GREEDY REGEX MATCHING:`);
    console.log(`   A naive regex like /\\[START ${example.substring}/`);
    console.log(`   would match both the intended tag AND longer variants.`);
    console.log();

    console.log(`3. PARTIAL WORD MATCHING:`);
    console.log(`   Without proper word boundaries, searching for "${example.substring}"`);
    console.log(`   in tag names will return false positives.`);
  }

  console.log();
  console.log('='.repeat(80));
  console.log('OTHER SUBSTRING MATCHING PITFALLS IN THIS CODEBASE');
  console.log('='.repeat(80));
  console.log();

  console.log('Additional scenarios where simple string matching fails:');
  console.log();
  console.log('1. COMMENT STYLE VARIATIONS:');
  console.log('   Tags can appear with different comment prefixes:');
  console.log('   - // [START tag]  (Kotlin, Java, Swift)');
  console.log('   - # [START tag]   (ProGuard, Python)');
  console.log('   - /* [START tag] */ (block comments)');
  console.log();
  console.log('2. WHITESPACE VARIATIONS:');
  console.log('   - [START  tag]   (extra space)');
  console.log('   - [START tag ]   (trailing space)');
  console.log('   - [ START tag]   (leading space)');
  console.log();
  console.log('3. START/END MISMATCH DETECTION:');
  console.log('   Simple string matching cannot verify that every');
  console.log('   [START tag] has a corresponding [END tag].');
  console.log();
  console.log('4. NESTED OR OVERLAPPING REGIONS:');
  console.log('   If snippets can nest, string matching cannot track');
  console.log('   proper nesting depth or detect improper overlaps.');
  console.log();
  console.log('5. CROSS-FILE REFACTORING:');
  console.log('   The same tag ID might intentionally appear in multiple');
  console.log('   files (e.g., Java + Kotlin versions). A rename needs to');
  console.log('   update ALL occurrences atomically.');
  console.log();

  // Summary stats
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log();
  console.log(`Total unique tags: ${uniqueTags.length}`);
  console.log(`Tags that are substrings of others: ${Object.keys(bySubstring).length}`);
  console.log(`Total substring relationships: ${substringPairs.length}`);

  const mostAmbiguous = sortedSubstrings[0];
  if (mostAmbiguous) {
    console.log(`Most ambiguous tag: "${mostAmbiguous.substring}" (substring of ${mostAmbiguous.superstrings.length} other tags)`);
  }

  console.log();
  console.log('RECOMMENDATION: Use a proper parser or AST-based approach');
  console.log('when refactoring snippet tags to avoid these pitfalls.');
}

main();
