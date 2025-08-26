import { Inject, Injectable, Module } from '../../../../src';
import { CONFIG_ASYNC_TOKEN, CONFIG_TOKEN } from '../config/config.module';

export const FEATURE_TOKEN = Symbol.for('FeatureToken');

@Injectable()
export class FeatureService {
  constructor(@Inject(CONFIG_TOKEN) private readonly cfg: any) { }

  info() {
    return { feature: 'on', config: this.cfg };
  }
}

@Module({
  providers: [],
  exports: [FEATURE_TOKEN],
})
export class FeatureModule { }

export class FeatureModuleFactory {
  static forFeature() {
    return (FeatureModule as any).forFeature({
      providers: [
        { provide: FEATURE_TOKEN, useClass: FeatureService },
      ],
      exports: [FEATURE_TOKEN],
    });
  }

  static forFeatureAsync() {
    return (FeatureModule as any).forFeatureAsync(async () => ({
      providers: [
        { provide: FEATURE_TOKEN, useFactory: (cfg: any) => new FeatureService(cfg), inject: [CONFIG_ASYNC_TOKEN] },
      ],
      exports: [FEATURE_TOKEN],
    }));
  }
}


