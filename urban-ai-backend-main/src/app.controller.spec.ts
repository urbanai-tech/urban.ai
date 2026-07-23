import { AppController } from './app.controller';

describe('AppController publicConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.LAUNCH_MODE;
    delete process.env.PRELAUNCH_MODE;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('defaults to the public commercial mode', () => {
    const config = new AppController().publicConfig();
    expect(config.launchMode).toBe('public');
    expect(config.prelaunchMode).toBe(false);
  });

  it('keeps the explicit prelaunch compatibility mode when configured', () => {
    process.env.LAUNCH_MODE = 'prelaunch';
    const config = new AppController().publicConfig();
    expect(config.launchMode).toBe('prelaunch');
    expect(config.prelaunchMode).toBe(true);
  });

  it('supports the legacy prelaunch flag without changing the commercial default', () => {
    process.env.PRELAUNCH_MODE = 'true';
    expect(new AppController().publicConfig().launchMode).toBe('prelaunch');
    process.env.PRELAUNCH_MODE = 'false';
    expect(new AppController().publicConfig().launchMode).toBe('public');
  });
});
