import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(full));
    } else if (full.endsWith('.jsx') || full.endsWith('.tsx') || full.endsWith('.js')) {
      results.push(full);
    }
  });
  return results;
}

const files = walk('./src');
const issues = [];

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');

  // Check <tr> with <th>
  const trMatches = content.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  if (trMatches) {
    trMatches.forEach(tr => {
      const thMatches = tr.match(/<th\b/gi);
      if (thMatches && thMatches.length > 4) {
        issues.push({
          file: f,
          type: 'th count > 4',
          count: thMatches.length,
          snippet: tr.slice(0, 150).replace(/\s+/g, ' ')
        });
      }
    });
  }

  // Check TableHeader / TableRow with TableHead
  const tableRowMatches = content.match(/<TableRow[^>]*>([\s\S]*?)<\/TableRow>/gi);
  if (tableRowMatches) {
    tableRowMatches.forEach(tr => {
      const thMatches = tr.match(/<TableHead\b/gi);
      if (thMatches && thMatches.length > 4) {
        issues.push({
          file: f,
          type: 'TableHead count > 4',
          count: thMatches.length,
          snippet: tr.slice(0, 150).replace(/\s+/g, ' ')
        });
      }
    });
  }

  // Check const columns = [ ... ]
  const colMatch = content.match(/const\s+columns\s*=\s*\[([\s\S]*?)\];/);
  if (colMatch) {
    const block = colMatch[1];
    const headers = block.match(/header\s*:\s*['"`]/g);
    if (headers && headers.length > 4) {
      issues.push({
        file: f,
        type: 'columns array headers > 4',
        count: headers.length
      });
    }
  }
});

console.log('Total issues found:', issues.length);
if (issues.length > 0) {
  console.log(JSON.stringify(issues, null, 2));
  process.exit(1);
} else {
  console.log('SUCCESS: All tables across all portals have <= 4 visible columns!');
  process.exit(0);
}
