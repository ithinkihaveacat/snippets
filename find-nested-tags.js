#!/usr/bin/env node

/**
 * Script to find nested START/END tags in the codebase.
 *
 * Nested tags occur when one snippet region is contained within another:
 *
 *   // [START outer]
 *   code...
 *   // [START inner]    <-- nested inside "outer"
 *   more code...
 *   // [END inner]
 *   // [END outer]
 *
 * This is another reason why simple string matching is insufficient -
 * you need to track state to understand tag relationships.
 */

const fs = require('fs');
const path = require('path');

const START_PATTERN = /\[START\s+([^\]]+)\]/g;
const END_PATTERN = /\[END\s+([^\]]+)\]/g;

/**
 * Recursively find all files in a directory
 */
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);

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
 * Parse a file and find all tag events (START/END) with line numbers
 */
function parseTagEvents(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const events = [];

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // Find START tags
      let match;
      const startRegex = /\[START\s+([^\]]+)\]/g;
      while ((match = startRegex.exec(line)) !== null) {
        events.push({
          type: 'START',
          tag: match[1].trim(),
          line: lineNum,
          file: filePath
        });
      }

      // Find END tags
      const endRegex = /\[END\s+([^\]]+)\]/g;
      while ((match = endRegex.exec(line)) !== null) {
        events.push({
          type: 'END',
          tag: match[1].trim(),
          line: lineNum,
          file: filePath
        });
      }
    });

    return events;
  } catch (err) {
    return [];
  }
}

/**
 * Analyze a file for nested tags
 */
function findNestedTags(filePath) {
  const events = parseTagEvents(filePath);
  if (events.length === 0) return null;

  const stack = [];
  const nestedPairs = [];
  const errors = [];

  events.forEach(event => {
    if (event.type === 'START') {
      // If there's already something on the stack, this is nested
      if (stack.length > 0) {
        nestedPairs.push({
          outer: { ...stack[stack.length - 1] },
          inner: { ...event },
          depth: stack.length + 1
        });
      }
      stack.push(event);
    } else if (event.type === 'END') {
      if (stack.length === 0) {
        errors.push({
          type: 'UNMATCHED_END',
          tag: event.tag,
          line: event.line
        });
      } else {
        const top = stack[stack.length - 1];
        if (top.tag !== event.tag) {
          errors.push({
            type: 'MISMATCHED_END',
            expected: top.tag,
            got: event.tag,
            startLine: top.line,
            endLine: event.line
          });
        }
        stack.pop();
      }
    }
  });

  // Check for unclosed tags
  stack.forEach(unclosed => {
    errors.push({
      type: 'UNCLOSED_START',
      tag: unclosed.tag,
      line: unclosed.line
    });
  });

  return {
    file: filePath,
    nestedPairs,
    errors,
    totalTags: events.length
  };
}

/**
 * Main function
 */
function main() {
  console.log('='.repeat(80));
  console.log('Nested START/END Tag Analysis');
  console.log('='.repeat(80));
  console.log();

  const rootDir = process.cwd();
  console.log(`Scanning directory: ${rootDir}`);
  console.log();

  const allFiles = getAllFiles(rootDir);
  console.log(`Found ${allFiles.length} files to scan`);
  console.log();

  const allNested = [];
  const allErrors = [];
  let filesWithTags = 0;

  allFiles.forEach(file => {
    const result = findNestedTags(file);
    if (result && result.totalTags > 0) {
      filesWithTags++;
      if (result.nestedPairs.length > 0) {
        allNested.push(...result.nestedPairs.map(p => ({
          ...p,
          file: path.relative(rootDir, file)
        })));
      }
      if (result.errors.length > 0) {
        allErrors.push(...result.errors.map(e => ({
          ...e,
          file: path.relative(rootDir, file)
        })));
      }
    }
  });

  // Report nested tags
  console.log('='.repeat(80));
  console.log('NESTED TAGS FOUND');
  console.log('='.repeat(80));
  console.log();
  console.log(`Found ${allNested.length} nested tag pairs in ${filesWithTags} files with tags`);
  console.log();

  if (allNested.length > 0) {
    // Group by file
    const byFile = {};
    allNested.forEach(n => {
      if (!byFile[n.file]) byFile[n.file] = [];
      byFile[n.file].push(n);
    });

    // Find max nesting depth
    const maxDepth = Math.max(...allNested.map(n => n.depth));
    console.log(`Maximum nesting depth: ${maxDepth}`);
    console.log();

    // Show files with most nesting
    const filesByNesting = Object.entries(byFile)
      .map(([file, pairs]) => ({ file, count: pairs.length, maxDepth: Math.max(...pairs.map(p => p.depth)) }))
      .sort((a, b) => b.count - a.count);

    console.log('Files with nested tags (sorted by count):');
    console.log();

    filesByNesting.slice(0, 20).forEach(({ file, count, maxDepth }) => {
      console.log(`  ${file}`);
      console.log(`    Nested pairs: ${count}, Max depth: ${maxDepth}`);

      // Show examples from this file
      const examples = byFile[file].slice(0, 3);
      examples.forEach(ex => {
        console.log(`    - [START ${ex.outer.tag}] (line ${ex.outer.line}) contains [START ${ex.inner.tag}] (line ${ex.inner.line})`);
      });
      if (byFile[file].length > 3) {
        console.log(`    ... and ${byFile[file].length - 3} more`);
      }
      console.log();
    });

    if (filesByNesting.length > 20) {
      console.log(`... and ${filesByNesting.length - 20} more files with nested tags`);
      console.log();
    }

    // Show deepest nesting examples
    const deeplyNested = allNested.filter(n => n.depth >= 3).sort((a, b) => b.depth - a.depth);
    if (deeplyNested.length > 0) {
      console.log('='.repeat(80));
      console.log('DEEPLY NESTED TAGS (depth >= 3)');
      console.log('='.repeat(80));
      console.log();

      deeplyNested.slice(0, 10).forEach(n => {
        console.log(`  ${n.file}:${n.inner.line}`);
        console.log(`    Depth ${n.depth}: [START ${n.inner.tag}] nested inside [START ${n.outer.tag}]`);
      });
      console.log();
    }
  }

  // Report errors
  if (allErrors.length > 0) {
    console.log('='.repeat(80));
    console.log('TAG ERRORS FOUND');
    console.log('='.repeat(80));
    console.log();
    console.log(`Found ${allErrors.length} potential issues:`);
    console.log();

    allErrors.forEach(err => {
      if (err.type === 'UNMATCHED_END') {
        console.log(`  ${err.file}:${err.line}`);
        console.log(`    UNMATCHED END: [END ${err.tag}] has no corresponding START`);
      } else if (err.type === 'MISMATCHED_END') {
        console.log(`  ${err.file}:${err.endLine}`);
        console.log(`    MISMATCHED: Expected [END ${err.expected}] but got [END ${err.got}]`);
        console.log(`    (START was at line ${err.startLine})`);
      } else if (err.type === 'UNCLOSED_START') {
        console.log(`  ${err.file}:${err.line}`);
        console.log(`    UNCLOSED: [START ${err.tag}] has no corresponding END`);
      }
      console.log();
    });
  }

  // Why this matters
  console.log('='.repeat(80));
  console.log('WHY NESTED TAGS COMPLICATE STRING MATCHING');
  console.log('='.repeat(80));
  console.log();
  console.log('1. CONTEXT-DEPENDENT EXTRACTION:');
  console.log('   When extracting snippet content, you need to decide whether');
  console.log('   to include or exclude nested regions.');
  console.log();
  console.log('2. OVERLAPPING CONTENT:');
  console.log('   The same lines of code belong to multiple snippets.');
  console.log('   A change affects all containing snippets.');
  console.log();
  console.log('3. TAG DELETION RISKS:');
  console.log('   Removing an outer tag pair could orphan inner tags,');
  console.log('   or removing inner tags might break expected nesting.');
  console.log();
  console.log('4. REFACTORING DEPENDENCIES:');
  console.log('   Renaming a tag requires understanding its nesting context');
  console.log('   to avoid breaking snippet extraction logic.');
  console.log();

  // Summary
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log();
  console.log(`Files with tags: ${filesWithTags}`);
  console.log(`Nested tag pairs: ${allNested.length}`);
  console.log(`Files with nesting: ${Object.keys(allNested.reduce((acc, n) => { acc[n.file] = true; return acc; }, {})).length}`);
  console.log(`Tag errors found: ${allErrors.length}`);
  if (allNested.length > 0) {
    console.log(`Maximum nesting depth: ${Math.max(...allNested.map(n => n.depth))}`);
  }
}

main();
