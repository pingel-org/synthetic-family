/**
 * Corpus file discovery and ingest input preparation.
 *
 * Walks the typical biography / local-history KB layout (`bios/`, `letters/`,
 * `diaries/`, `memoirs/`, `generated/`, `photos/`, `data/`) and classifies
 * each file by directory + extension to determine entity types and format.
 *
 * Used by skill 1 (`ingest-corpus`).
 *
 * Generic across any biographical / local-history corpus following the same
 * directory conventions. Users with a different layout can pass `overrides`
 * to redirect classification rules without modifying this module.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

export type CorpusFileSource =
  | 'biographical'
  | 'curated-context'
  | 'photograph'
  | 'data'
  | 'other';

export interface CorpusFile {
  /** Repo-relative path. */
  path: string;
  /** Display name for the resource. */
  name: string;
  /** MIME type. */
  format: string;
  /** Entity types to attach to the resource. */
  entityTypes: string[];
  /** Stable storage identifier; we use file:// URIs. */
  storageUri: string;
  /** Coarse classification, useful for downstream filtering. */
  source: CorpusFileSource;
}

interface DirRule {
  source: CorpusFileSource;
  entityTypes: (filename: string) => string[];
}

export interface ClassificationConfig {
  /** Map directory name → rule. */
  dirs: Record<string, DirRule>;
  /** Extensions to skip outright (e.g., README files, hidden, etc.). */
  skipFilenames: Set<string>;
}

const DEFAULT_CONFIG: ClassificationConfig = {
  dirs: {
    bios: {
      source: 'biographical',
      entityTypes: () => ['Biography', 'Subject'],
    },
    biographies: {
      source: 'biographical',
      entityTypes: () => ['Biography', 'Subject'],
    },
    letters: {
      source: 'biographical',
      entityTypes: () => ['Letter', 'Correspondence'],
    },
    diaries: {
      source: 'biographical',
      entityTypes: () => ['Diary', 'Journal'],
    },
    memoirs: {
      source: 'biographical',
      entityTypes: () => ['Memoir'],
    },
    generated: {
      source: 'curated-context',
      entityTypes: () => ['HistoricalContext', 'Curated'],
    },
    context: {
      source: 'curated-context',
      entityTypes: () => ['HistoricalContext', 'Curated'],
    },
    photos: {
      source: 'photograph',
      entityTypes: () => ['Photograph', 'FamilyImage'],
    },
    images: {
      source: 'photograph',
      entityTypes: () => ['Photograph', 'FamilyImage'],
    },
    data: {
      source: 'data',
      entityTypes: () => ['SourceData'],
    },
  },
  skipFilenames: new Set([
    'README.md',
    'readme.md',
    'README',
    '.DS_Store',
    'LICENSE',
    'AGENTS.md',
  ]),
};

const FORMAT_BY_EXT: Record<string, string> = {
  '.md': 'text/markdown',
  '.txt': 'text/plain',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.csv': 'text/csv',
};

function nameFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '');
  return base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Walk the repo and produce one CorpusFile per ingestable file.
 * @param repoRoot Absolute path to the repo root. Defaults to the current working directory.
 * @param overrides Optional classification rule overrides.
 */
export function discoverCorpus(
  repoRoot: string = process.cwd(),
  overrides: Partial<ClassificationConfig> = {},
): CorpusFile[] {
  const config: ClassificationConfig = {
    dirs: { ...DEFAULT_CONFIG.dirs, ...overrides.dirs },
    skipFilenames: overrides.skipFilenames ?? DEFAULT_CONFIG.skipFilenames,
  };

  const out: CorpusFile[] = [];

  for (const dirName of Object.keys(config.dirs)) {
    const dirPath = join(repoRoot, dirName);
    if (!existsSync(dirPath)) continue;
    const rule = config.dirs[dirName];

    walkDir(dirPath, repoRoot, (absPath) => {
      const filename = absPath.slice(absPath.lastIndexOf('/') + 1);
      if (config.skipFilenames.has(filename)) return;
      const ext = extname(filename).toLowerCase();
      const format = FORMAT_BY_EXT[ext];
      if (!format) return; // unknown extension — skip

      const relPath = relative(repoRoot, absPath);
      out.push({
        path: relPath,
        name: nameFromFilename(filename),
        format,
        entityTypes: rule.entityTypes(filename),
        storageUri: `file://${relPath}`,
        source: rule.source,
      });
    });
  }

  return out;
}

function walkDir(
  dir: string,
  repoRoot: string,
  visit: (absPath: string) => void,
): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkDir(full, repoRoot, visit);
    } else if (st.isFile()) {
      visit(full);
    }
  }
}

/** Read file contents into a Buffer for upload via yield.resource. */
export function readForUpload(file: CorpusFile, repoRoot: string = process.cwd()): Buffer {
  return readFileSync(join(repoRoot, file.path));
}
