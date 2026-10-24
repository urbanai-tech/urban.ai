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

  it('keeps the closed_beta default when nothing is configured (production sets LAUNCH_MODE explicitly)', () => {
    const config = new AppController().publicConfig();
    expect(config.launchMode).toBe('closed_beta');
    expect(config.prelaunchMode).toBe(false);
  });

  it('keeps the explicit prelaunch compatibility mode when configured', () => {
    process.env.LAUNCH_MODE = 'prelaunch';
    const config = new AppController().publicConfig();
    expect(config.launchMode).toBe('prelaunch');
    expect(config.prelaunchMode).toBe(true);
  });

  it('supports the legacy prelaunch flag without changing the closed_beta default', () => {
    process.env.PRELAUNCH_MODE = 'true';
    expect(new AppController().publicConfig().launchMode).toBe('prelaunch');
    process.env.PRELAUNCH_MODE = 'false';
    expect(new AppController().publicConfig().launchMode).toBe('closed_beta');
  });

  it('accepts public mode when configured explicitly', () => {
    process.env.LAUNCH_MODE = 'public';
    expect(new AppController().publicConfig().launchMode).toBe('public');
  });
});
