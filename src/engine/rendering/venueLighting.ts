import { MathUtils } from 'three';
import { isOutdoorVenue, type EnvironmentConfiguration } from '../../domain/environment';

/** Art-directed solar schedule, not a latitude/date ephemeris. Shared by sky,
 * key light, exposure and fixtures so dusk cannot fall into an unlit gap. */
export function resolveVenueLighting(configuration: EnvironmentConfiguration) {
  const intensity = MathUtils.clamp(configuration.lightIntensity, .35, 1.5);
  const progress = MathUtils.clamp((configuration.timeOfDay - 5.5) / 15, 0, 1);
  const arc = progress > 0 && progress < 1 ? Math.sin(progress * Math.PI) : 0;
  const elevation = MathUtils.lerp(-4, 82, Math.pow(arc, .65));
  const daylight = MathUtils.smoothstep(elevation, -3, 16);
  const golden = (1 - MathUtils.smoothstep(elevation, 46, 72)) * daylight;
  const cloud = configuration.weather === 'clear' ? 0 : configuration.weatherIntensity;
  const attenuation = MathUtils.lerp(1, configuration.weather === 'rain' ? .18 : .32, cloud);
  const outdoor = isOutdoorVenue(configuration.venue);
  return {
    outdoor, arc, elevation, daylight, golden,
    sunIntensity: outdoor ? MathUtils.lerp(.05375, 4.6 - golden * 1.0, daylight) * attenuation * intensity : 0,
    hemisphereIntensity: outdoor
      ? MathUtils.lerp(.28, .20 + golden * .18 + cloud * .24, daylight) * intensity
      : .56 * intensity,
    environmentIntensity: MathUtils.lerp(.3, .07 + golden * .02 + cloud * .08, daylight),
    fixtureScale: outdoor ? 1 - MathUtils.smoothstep(elevation, 16, 62) : 1,
    exposure: outdoor
      ? (.58 + daylight * .03 + golden * .055 + cloud * .04) * MathUtils.lerp(.9, 1.06, intensity / 1.5)
      : (configuration.lighting === 'indoor-bright' ? .68 : configuration.lighting === 'indoor-warm' ? .63 : .6)
        * MathUtils.lerp(.88, 1.08, intensity / 1.5),
  };
}
