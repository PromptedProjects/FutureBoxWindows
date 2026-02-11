import { existsSync } from 'node:fs';
import { exec } from 'node:child_process';
import type { Browser, Page } from 'puppeteer-core';

let browser: Browser | null = null;

async function launchPuppeteer() {
  const pup = await import('puppeteer-core');
  return pup;
}

/** Find installed Chrome/Edge executable */
function findBrowserPath(): string {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  throw new Error('No Chrome or Edge installation found');
}

/** Open a URL in the system's default browser */
export function openInDefaultBrowser(url: string): void {
  exec(`start "" "${url}"`, { timeout: 5000 });
}

/** Connect to or launch a browser instance */
export async function ensureBrowser(): Promise<Browser> {
  if (browser && browser.connected) return browser;

  const pup = await launchPuppeteer();
  const execPath = findBrowserPath();

  browser = await pup.launch({
    executablePath: execPath,
    headless: false,
    defaultViewport: null,
    args: ['--no-first-run', '--no-default-browser-check'],
  });

  browser.on('disconnected', () => {
    browser = null;
  });

  return browser;
}

/** Close browser if open */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

export interface TabInfo {
  id: string;
  url: string;
  title: string;
}

/** List open tabs */
export async function listTabs(): Promise<TabInfo[]> {
  const b = await ensureBrowser();
  const pages = await b.pages();
  return pages.map((p, i) => ({
    id: String(i),
    url: p.url(),
    title: p.url(),
  }));
}

/** Open a new tab */
export async function openTab(url: string): Promise<TabInfo> {
  const b = await ensureBrowser();
  const page = await b.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const pages = await b.pages();
  const idx = pages.indexOf(page);
  return { id: String(idx), url: page.url(), title: await page.title() };
}

/** Close a tab by index */
export async function closeTab(id: string): Promise<boolean> {
  const b = await ensureBrowser();
  const pages = await b.pages();
  const idx = parseInt(id, 10);
  if (idx < 0 || idx >= pages.length) return false;
  await pages[idx].close();
  return true;
}

/** Navigate a tab to a URL */
export async function navigateTab(id: string, url: string): Promise<TabInfo> {
  const page = await getPage(id);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  return { id, url: page.url(), title: await page.title() };
}

/** Screenshot a page as base64 PNG */
export async function screenshotPage(id: string): Promise<string> {
  const page = await getPage(id);
  const buf = await page.screenshot({ encoding: 'base64', type: 'png' });
  return buf as string;
}

/** Get page text content */
export async function getPageContent(id: string): Promise<string> {
  const page = await getPage(id);
  return page.evaluate('document.body ? document.body.innerText : ""') as Promise<string>;
}

/** Click an element by selector */
export async function clickElement(id: string, selector: string): Promise<void> {
  const page = await getPage(id);
  await page.click(selector);
}

/** Type text into an element */
export async function typeInElement(id: string, selector: string, text: string): Promise<void> {
  const page = await getPage(id);
  await page.type(selector, text);
}

/** Evaluate JavaScript in page context */
export async function evaluateScript(id: string, script: string): Promise<unknown> {
  const page = await getPage(id);
  return page.evaluate(script);
}

/** Extract all links from a page */
export async function extractLinks(id: string): Promise<{ href: string; text: string }[]> {
  const page = await getPage(id);
  return page.evaluate(
    'Array.from(document.querySelectorAll("a[href]")).map(a => ({ href: a.href, text: (a.textContent || "").trim() }))'
  ) as Promise<{ href: string; text: string }[]>;
}

/** Extract text from selector (or full body) */
export async function extractText(id: string, selector?: string): Promise<string> {
  const page = await getPage(id);
  if (selector) {
    return page.evaluate(
      `(function() { var el = document.querySelector(${JSON.stringify(selector)}); return el ? el.textContent : ""; })()`
    ) as Promise<string>;
  }
  return page.evaluate('document.body ? document.body.innerText : ""') as unknown as Promise<string>;
}

async function getPage(id: string): Promise<Page> {
  const b = await ensureBrowser();
  const pages = await b.pages();
  const idx = parseInt(id, 10);
  if (idx < 0 || idx >= pages.length) {
    throw new Error(`Tab ${id} not found`);
  }
  return pages[idx];
}
