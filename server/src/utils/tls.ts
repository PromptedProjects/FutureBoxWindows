import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Logger } from './logger.js';

interface TLSCerts {
  key: string;
  cert: string;
}

/** Generate self-signed certs for local network HTTPS */
export function ensureSelfSignedCerts(dataDir: string, logger: Logger): TLSCerts {
  const certDir = join(dataDir, 'certs');
  const keyPath = join(certDir, 'futurebox.key');
  const certPath = join(certDir, 'futurebox.crt');

  if (existsSync(keyPath) && existsSync(certPath)) {
    logger.info('TLS certs found');
    return { key: readFileSync(keyPath, 'utf-8'), cert: readFileSync(certPath, 'utf-8') };
  }

  if (!existsSync(certDir)) {
    mkdirSync(certDir, { recursive: true });
  }

  logger.info('Generating self-signed TLS certificate...');

  try {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=futurebox.local"`,
      { stdio: 'pipe' },
    );
    logger.info('Self-signed TLS certificate generated');
  } catch {
    logger.warn('openssl not available — TLS disabled. Install openssl to enable HTTPS.');
    return { key: '', cert: '' };
  }

  return { key: readFileSync(keyPath, 'utf-8'), cert: readFileSync(certPath, 'utf-8') };
}

/** Load TLS certs from explicit paths */
export function loadTLSCerts(keyPath: string, certPath: string): TLSCerts {
  return {
    key: readFileSync(keyPath, 'utf-8'),
    cert: readFileSync(certPath, 'utf-8'),
  };
}
