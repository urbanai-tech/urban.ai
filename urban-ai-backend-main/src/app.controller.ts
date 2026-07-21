import { Controller, Get, InternalServerErrorException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { Roles } from './auth/roles.decorator';
import { RolesGuard } from './auth/roles.guard';

/**
 * AppController - public utility endpoints.
 */
@Controller()
export class AppController {
  /**
   * Configuração pública do ambiente - usada pelo frontend para decidir o
   * comportamento sem precisar bater env vars do build. Não inclui segredos.
   */
  @Get('public-config')
  publicConfig() {
    const configuredLaunchMode = process.env.LAUNCH_MODE;
    const launchMode =
      configuredLaunchMode === 'closed_beta' ||
      configuredLaunchMode === 'paid_beta' ||
      configuredLaunchMode === 'public' ||
      configuredLaunchMode === 'prelaunch'
        ? configuredLaunchMode
        : process.env.PRELAUNCH_MODE === 'true'
          ? 'prelaunch'
          : 'public';

    return {
      launchMode,
      prelaunchMode: launchMode === 'prelaunch',
      appEnv: process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development',
      version: process.env.npm_package_version ?? 'unknown',
    };
  }

  @Get('debug/sentry-test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  sentryTest() {
    throw new InternalServerErrorException(
      'Sentry test error - triggered by /debug/sentry-test',
    );
  }
}
