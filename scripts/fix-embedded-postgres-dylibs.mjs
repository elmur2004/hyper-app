// Repairs the macOS embedded-postgres binary (used by the test suite + `prisma db seed`
// verification). The 18.4.0-beta.17 build ships ICU/zstd/etc. dylibs only under their full
// version (e.g. libicudata.77.1.dylib) but the postgres binary links against the SONAME
// (libicudata.77.dylib) and the unversioned alias (libicudata.dylib). We create the missing
// symlinks. Idempotent, darwin-only, and a no-op everywhere else — safe as a postinstall.
import { existsSync, readdirSync, lstatSync, symlinkSync, globSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'darwin') process.exit(0);

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// Find the native lib dir under whichever node_modules layout pnpm produced (isolated or hoisted).
let libDirs = [];
try {
  libDirs = globSync('**/@embedded-postgres/darwin-*/native/lib', { cwd: root })
    .map((p) => join(root, p))
    .filter((p) => existsSync(p));
} catch {
  // globSync needs Node 22+; if unavailable, bail quietly.
  process.exit(0);
}

let linked = 0;
for (const libDir of libDirs) {
  const files = readdirSync(libDir).filter((f) => f.endsWith('.dylib') && !lstatSync(join(libDir, f)).isSymbolicLink());
  for (const f of files) {
    // For libfoo.MAJOR.MINOR.dylib produce both libfoo.MAJOR.dylib (SONAME) and libfoo.dylib.
    const m = /^(.+?)\.(\d+)(?:\.\d+)*\.dylib$/.exec(f);
    if (!m) continue;
    const [, base, major] = m;
    for (const alias of [`${base}.${major}.dylib`, `${base}.dylib`]) {
      const dest = join(libDir, alias);
      if (alias !== f && !existsSync(dest)) {
        try {
          symlinkSync(f, dest);
          linked++;
        } catch {
          /* ignore races */
        }
      }
    }
  }
}

if (linked) console.log(`[fix-embedded-postgres] created ${linked} dylib symlink(s).`);
