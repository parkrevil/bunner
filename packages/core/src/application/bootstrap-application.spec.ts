import { describe, expect, it } from 'bun:test';

import { createApplication } from './create-application';

describe('createApplication', () => {
  it('should create isolated containers per application', async () => {
    const app1 = await createApplication({ providers: [] }, { name: 'app1', logLevel: 10 });
    const app2 = await createApplication({ providers: [] }, { name: 'app2', logLevel: 10 });

    expect(app1.getContainer()).not.toBe(app2.getContainer());
  });

  it('should scan module objects and register providers', async () => {
    const app = await createApplication(
      {
        providers: [{ provide: 'BACKEND_URL', useValue: 'https://example.test/api' }],
      },
      { name: 'app3', logLevel: 10 },
    );

    await app.init();
    expect(app.getContainer().get<string>('BACKEND_URL')).toBe('https://example.test/api');
  });
});
