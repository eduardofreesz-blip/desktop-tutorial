import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();

export async function readFile(filePath: string): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const fullPath = path.resolve(PROJECT_ROOT, filePath);
    if (!fullPath.startsWith(PROJECT_ROOT)) {
      return { success: false, error: 'Acesso negado: caminho fora do projeto' };
    }
    const content = fs.readFileSync(fullPath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: `Erro ao ler arquivo: ${error}` };
  }
}

export async function listFiles(dirPath: string = '.', extensions?: string[]): Promise<{ success: boolean; files?: string[]; error?: string }> {
  try {
    const fullPath = path.resolve(PROJECT_ROOT, dirPath);
    if (!fullPath.startsWith(PROJECT_ROOT)) {
      return { success: false, error: 'Acesso negado' };
    }
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    const files = entries
      .filter((e) => !e.name.startsWith('.') && e.name !== 'node_modules')
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
    return { success: true, files };
  } catch (error) {
    return { success: false, error: `Erro ao listar: ${error}` };
  }
}

export async function searchInFiles(query: string, dirPath: string = '.'): Promise<{ success: boolean; results?: Array<{ file: string; line: number; content: string }>; error?: string }> {
  try {
    const results: Array<{ file: string; line: number; content: string }> = [];
    const fullPath = path.resolve(PROJECT_ROOT, dirPath);

    function search(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '.next') continue;
        const fp = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          search(fp);
        } else if (/\.(ts|tsx|js|jsx|json)$/.test(entry.name)) {
          const content = fs.readFileSync(fp, 'utf-8');
          content.split('\n').forEach((line, i) => {
            if (line.toLowerCase().includes(query.toLowerCase())) {
              results.push({ file: path.relative(PROJECT_ROOT, fp), line: i + 1, content: line.trim() });
            }
          });
        }
      }
    }

    search(fullPath);
    return { success: true, results: results.slice(0, 50) };
  } catch (error) {
    return { success: false, error: `Erro na busca: ${error}` };
  }
}
