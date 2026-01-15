// Utility to split large SQL files into smaller chunks for processing

const CHUNK_SIZE = 500 * 1024; // 500KB per chunk

export interface SQLChunk {
  content: string;
  index: number;
  total: number;
  isLast: boolean;
}

// Split SQL by complete statements, respecting string literals
function splitSQLStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    
    // Handle string detection
    if (!inString && (char === "'" || char === '"')) {
      inString = true;
      stringChar = char;
      current += char;
      continue;
    }
    
    if (inString) {
      current += char;
      if (char === stringChar) {
        // Check for escape
        if (i + 1 < sql.length && sql[i + 1] === stringChar) {
          current += sql[i + 1];
          i++;
        } else {
          inString = false;
        }
      }
      continue;
    }
    
    // Statement end
    if (char === ';') {
      current += char;
      const stmt = current.trim();
      if (stmt) {
        statements.push(stmt);
      }
      current = '';
      continue;
    }
    
    current += char;
  }
  
  // Last statement without semicolon
  const lastStmt = current.trim();
  if (lastStmt) {
    statements.push(lastStmt);
  }
  
  return statements;
}

export function createChunks(sql: string): SQLChunk[] {
  const statements = splitSQLStatements(sql);
  const chunks: SQLChunk[] = [];
  let currentChunk = '';
  
  for (const stmt of statements) {
    // If adding this statement would exceed chunk size, save current chunk
    if (currentChunk.length + stmt.length > CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk,
        index: chunks.length,
        total: 0, // Will be set later
        isLast: false
      });
      currentChunk = '';
    }
    
    currentChunk += stmt + '\n';
  }
  
  // Don't forget last chunk
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk,
      index: chunks.length,
      total: 0,
      isLast: true
    });
  }
  
  // Update totals and isLast
  const total = chunks.length;
  chunks.forEach((chunk, i) => {
    chunk.total = total;
    chunk.isLast = i === total - 1;
  });
  
  return chunks;
}

export function estimateChunks(fileSize: number): number {
  return Math.ceil(fileSize / CHUNK_SIZE);
}
