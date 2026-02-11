import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  listTabs, openTab, closeTab, navigateTab,
  screenshotPage, getPageContent, clickElement,
  typeInElement, evaluateScript, extractLinks, extractText,
  openInDefaultBrowser,
} from '../services/browser.service.js';

const openTabBody = z.object({ url: z.string().url() });
const navigateBody = z.object({ url: z.string().url() });
const clickBody = z.object({ selector: z.string().min(1) });
const typeBody = z.object({ selector: z.string().min(1), text: z.string() });
const evalBody = z.object({ script: z.string().min(1) });
const textBody = z.object({ selector: z.string().optional() });

export async function browserRoutes(app: FastifyInstance): Promise<void> {
  /** Open URL in default system browser (green) */
  app.post('/browser/open', async (request, reply) => {
    const body = openTabBody.safeParse(request.body);
    if (!body.success) {
      reply.code(400).send({ ok: false, error: 'url is required' });
      return;
    }
    try {
      openInDefaultBrowser(body.data.url);
      return { ok: true, data: { opened: true, url: body.data.url } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to open URL' };
    }
  });

  /** List open tabs (green) */
  app.get('/browser/tabs', async () => {
    try {
      const tabs = await listTabs();
      return { ok: true, data: { tabs } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Browser not available' };
    }
  });

  /** Open a new tab (yellow) */
  app.post('/browser/tabs', async (request, reply) => {
    const body = openTabBody.safeParse(request.body);
    if (!body.success) {
      reply.code(400).send({ ok: false, error: 'url is required' });
      return;
    }
    try {
      const tab = await openTab(body.data.url);
      return { ok: true, data: tab };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to open tab' };
    }
  });

  /** Close a tab (green) */
  app.delete('/browser/tabs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const closed = await closeTab(id);
      if (!closed) {
        reply.code(404).send({ ok: false, error: 'Tab not found' });
        return;
      }
      return { ok: true, data: { closed: true } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to close tab' };
    }
  });

  /** Navigate a tab (yellow) */
  app.post('/browser/tabs/:id/navigate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = navigateBody.safeParse(request.body);
    if (!body.success) {
      reply.code(400).send({ ok: false, error: 'url is required' });
      return;
    }
    try {
      const tab = await navigateTab(id, body.data.url);
      return { ok: true, data: tab };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to navigate' };
    }
  });

  /** Screenshot a page (green) */
  app.get('/browser/tabs/:id/screenshot', async (request) => {
    const { id } = request.params as { id: string };
    try {
      const image = await screenshotPage(id);
      return { ok: true, data: { image, format: 'png', encoding: 'base64' } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to screenshot' };
    }
  });

  /** Get page text content (green) */
  app.get('/browser/tabs/:id/content', async (request) => {
    const { id } = request.params as { id: string };
    try {
      const content = await getPageContent(id);
      return { ok: true, data: { content } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to get content' };
    }
  });

  /** Extract links from page (green) */
  app.get('/browser/tabs/:id/links', async (request) => {
    const { id } = request.params as { id: string };
    try {
      const links = await extractLinks(id);
      return { ok: true, data: { links } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to extract links' };
    }
  });

  /** Extract text from selector (green) */
  app.post('/browser/tabs/:id/text', async (request) => {
    const { id } = request.params as { id: string };
    const body = textBody.safeParse(request.body);
    try {
      const text = await extractText(id, body.success ? body.data.selector : undefined);
      return { ok: true, data: { text } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to extract text' };
    }
  });

  /** Click element (yellow) */
  app.post('/browser/tabs/:id/click', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = clickBody.safeParse(request.body);
    if (!body.success) {
      reply.code(400).send({ ok: false, error: 'selector is required' });
      return;
    }
    try {
      await clickElement(id, body.data.selector);
      return { ok: true, data: { clicked: true } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to click' };
    }
  });

  /** Type into element (yellow) */
  app.post('/browser/tabs/:id/type', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = typeBody.safeParse(request.body);
    if (!body.success) {
      reply.code(400).send({ ok: false, error: 'selector and text are required' });
      return;
    }
    try {
      await typeInElement(id, body.data.selector, body.data.text);
      return { ok: true, data: { typed: true } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to type' };
    }
  });

  /** Execute JavaScript in page (red) */
  app.post('/browser/tabs/:id/eval', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = evalBody.safeParse(request.body);
    if (!body.success) {
      reply.code(400).send({ ok: false, error: 'script is required' });
      return;
    }
    try {
      const result = await evaluateScript(id, body.data.script);
      return { ok: true, data: { result } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to evaluate script' };
    }
  });
}
