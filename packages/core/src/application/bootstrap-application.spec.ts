import { describe, expect, it } from 'bun:test';

import { createApplication } from './create-application';

describe('bootstrap-application', () => {
  it('should create isolated containers when multiple apps are created', async () => {
    // Arrange
    const app1 = await createApplication({ providers: [] }, { name: 'app1', logLevel: 10 });
    const app2 = await createApplication({ providers: [] }, { name: 'app2', logLevel: 10 });
    // Act
    const firstContainer = app1.getContainer();
    const secondContainer = app2.getContainer();

    // Assert
    expect(firstContainer).not.toBe(secondContainer);
  });

  it('should scan module objects and register providers when initialized', async () => {
    // Arrange
    const app = await createApplication(
      {
        providers: [{ provide: 'BACKEND_URL', useValue: 'https://example.test/api' }],
      },
      { name: 'app3', logLevel: 10 },
    );

    // Act
    await app.init();

    // Assert
    const backendUrl = app.getContainer().get('BACKEND_URL');

    expect(backendUrl).toBe('https://example.test/api');
  });
});
