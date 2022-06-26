import { Color } from 'three';

function addWorldPosition( shader ) {

	if ( /varying\s+vec3\s+wPosition/.test( shader.vertexShader ) ) return;

	shader.vertexShader = `
			varying vec3 wPosition;
			${shader.vertexShader}
		`.replace(
		/#include <displacementmap_vertex>/,
		v =>
			`${v}
				wPosition = (modelMatrix * vec4( transformed, 1.0 )).xyz;
				`,
	);

	shader.fragmentShader = `
		varying vec3 wPosition;
		${shader.fragmentShader}
		`;

	return shader;

}

export function csgGridShaderMixin( shader ) {

	shader.uniforms = {
		...shader.uniforms,
		checkerboardColor: { value: new Color( 0x111111 ) }
	};

	addWorldPosition( shader );

	shader.defines = { CSG_GRID: 1 };

	shader.fragmentShader = shader.fragmentShader.replace(
		/#include <common>/,
		v =>
		/* glsl */`
			${v}

			uniform vec3 checkerboardColor;
			float getCheckerboard( vec2 p, float scale ) {

				p /= scale;
				p += vec2( 0.5 );

				vec2 line = mod( p, 2.0 ) - vec2( 1.0 );
				line = abs( line );

				vec2 pWidth = fwidth( line );
				vec2 value = smoothstep( 0.5 - pWidth / 2.0, 0.5 + pWidth / 2.0, line );
				float result = value.x * value.y + ( 1.0 - value.x ) * ( 1.0 - value.y );

				return result;

			}

			float getGrid( vec2 p, float scale, float thickness ) {

				p /= 0.5 * scale;

				vec2 stride = mod( p, 2.0 ) - vec2( 1.0 );
				stride = abs( stride );

				vec2 pWidth = fwidth( p );
				vec2 line = smoothstep( 1.0 - pWidth / 2.0, 1.0 + pWidth / 2.0, stride + thickness * pWidth );

				return max( line.x, line.y );

			}

			vec3 getFaceColor( vec2 p, vec3 color ) {

				float checkLarge = getCheckerboard( p, 1.0 );
				float checkSmall = abs( getCheckerboard( p, 0.1 ) );
				float lines = getGrid( p, 10.0, 1.0 );

				vec3 checkColor = mix(
					vec3( 0.7 ) * color,
					vec3( 1.0 ) * color,
					checkSmall * 0.4 + checkLarge * 0.6
				);

				vec3 gridColor = vec3( 1.0 );

				return mix( checkColor, gridColor, lines );

			}

			float angleBetween( vec3 a, vec3 b ) {

				return acos( abs( dot( a, b ) ) );

			}

			vec3 planeProject( vec3 norm, vec3 other ) {

				float d = dot( norm, other );
				return normalize( other - norm * d );

			}

			vec3 getBlendFactors( vec3 norm ) {

				vec3 xVec = vec3( 1.0, 0.0, 0.0 );
				vec3 yVec = vec3( 0.0, 1.0, 0.0 );
				vec3 zVec = vec3( 0.0, 0.0, 1.0 );

				vec3 projX = planeProject( xVec, norm );
				vec3 projY = planeProject( yVec, norm );
				vec3 projZ = planeProject( zVec, norm );

				float xAngle = max(
					angleBetween( xVec, projY ),
					angleBetween( xVec, projZ )
				);

				float yAngle = max(
					angleBetween( yVec, projX ),
					angleBetween( yVec, projZ )
				);

				float zAngle = max(
					angleBetween( zVec, projX ),
					angleBetween( zVec, projY )
				);

				return vec3( xAngle, yAngle, zAngle ) / ( 0.5 * PI );

			}
		` ).replace(
		/#include <normal_fragment_maps>/,
		v =>
		/* glsl */`${v}
				#if CSG_GRID
				{

					vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );

					float yCont = abs( dot( vec3( 0.0, 1.0, 0.0 ), worldNormal ) );
					float zCont = abs( dot( vec3( 0.0, 0.0, 1.0 ), worldNormal ) );
					float xCont = abs( dot( vec3( 1.0, 0.0, 0.0 ), worldNormal ) );

					vec3 factors = getBlendFactors( worldNormal );
					factors = smoothstep( vec3( 0.475 ), vec3( 0.525 ), vec3( 1.0 ) - factors );

					float weight = factors.x + factors.y + factors.z;
					factors /= weight;

					vec3 color =
						getFaceColor( wPosition.yz, diffuseColor.rgb ) * factors.x +
						getFaceColor( wPosition.xz, diffuseColor.rgb ) * factors.y +
						getFaceColor( wPosition.xy, diffuseColor.rgb ) * factors.z;

					diffuseColor.rgb = color;

				}
				#endif
				`,
	);

	return shader;

}
