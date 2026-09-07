import { Filter, UniformGroup } from "pixi.js";

export const CRT_CURVATURE = 0.045;
export const CRT_SCANLINE_STRENGTH = 0.11;
export const CRT_NOISE_STRENGTH = 0.025;

const CRT_VERTEX_SHADER = `
  in vec2 aPosition;
  out vec2 vTextureCoord;

  uniform vec4 uInputSize;
  uniform vec4 uOutputFrame;
  uniform vec4 uOutputTexture;

  void main() {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y)
      - uOutputTexture.z;
    gl_Position = vec4(position, 0.0, 1.0);
    vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
  }
`;

export const CRT_FRAGMENT_SHADER = `
  in vec2 vTextureCoord;
  out vec4 finalColor;

  uniform sampler2D uTexture;
  uniform float uTime;
  uniform float uCurvature;
  uniform float uScanlineStrength;
  uniform float uNoiseStrength;

  float randomNoise(vec2 coordinate) {
    return fract(sin(dot(coordinate, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 centered = vTextureCoord * 2.0 - 1.0;
    float radiusSquared = dot(centered, centered);
    float cornerScale = 1.0 + 2.0 * uCurvature;
    vec2 curvedUv = centered
      * ((1.0 + uCurvature * radiusSquared) / cornerScale)
      * 0.5
      + 0.5;

    if (curvedUv.x < 0.0 || curvedUv.x > 1.0 || curvedUv.y < 0.0 || curvedUv.y > 1.0) {
      finalColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }

    vec4 colour = texture(uTexture, curvedUv);
    float scanline = 1.0 - uScanlineStrength
      * (0.5 + 0.5 * sin(curvedUv.y * 540.0 * 3.14159265));
    float noise = randomNoise(
      curvedUv * vec2(960.0, 540.0) + vec2(uTime * 37.0, uTime * 19.0)
    ) - 0.5;
    vec2 edgeDistance = curvedUv * (1.0 - curvedUv);
    float vignette = pow(clamp(16.0 * edgeDistance.x * edgeDistance.y, 0.0, 1.0), 0.16);

    colour.rgb = colour.rgb * scanline * vignette + noise * uNoiseStrength;
    finalColor = vec4(max(colour.rgb, vec3(0.0)), colour.a);
  }
`;

const timeUniforms = {
	uTime: { value: 0, type: "f32" as const },
	uCurvature: { value: CRT_CURVATURE, type: "f32" as const },
	uScanlineStrength: { value: CRT_SCANLINE_STRENGTH, type: "f32" as const },
	uNoiseStrength: { value: CRT_NOISE_STRENGTH, type: "f32" as const },
};

export function advanceCrtTime(
	currentTime: number,
	deltaSeconds: number,
): number {
	if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return currentTime;
	return (currentTime + deltaSeconds) % 1_000;
}

export class CrtSceneFilter {
	public readonly filter: Filter;
	private readonly uniforms = new UniformGroup(timeUniforms);

	public constructor() {
		this.filter = Filter.from({
			gl: { vertex: CRT_VERTEX_SHADER, fragment: CRT_FRAGMENT_SHADER },
			resources: { crtUniforms: this.uniforms },
			resolution: 1,
			antialias: "off",
			padding: 0,
		});
	}

	public get time(): number {
		return this.uniforms.uniforms.uTime;
	}

	public update(deltaSeconds: number): void {
		this.uniforms.uniforms.uTime = advanceCrtTime(
			this.uniforms.uniforms.uTime,
			deltaSeconds,
		);
	}

	public destroy(): void {
		this.filter.destroy();
	}
}
