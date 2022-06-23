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

export function TopoLineShaderMixin( shader ) {

	addWorldPosition( shader );

	shader.fragmentShader = /* glsl */`

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
				// vec2 value = smoothstep( 0.5 - pWidth / 2.0, 0.5 + pWidth * 2.0, stride );
				// float result = value.x * value.y + ( 1.0 - value.x ) * ( 1.0 - value.y );

				vec2 line = smoothstep( 1.0 - pWidth / 2.0, 1.0 + pWidth / 2.0, stride + thickness * pWidth );

				// return stride.x;
				return max( line.x, line.y );

			}

			vec3 getFaceColor( vec2 p ) {

				float checkLarge = getCheckerboard( p, 1.0 );
				float checkSmall = abs( checkLarge - getCheckerboard( p, 0.5 ) );
				float lines = getGrid( p, 10.0, 1.0 );

				vec3 c = mix( vec3( 1.0, 0.6, 0.0 ), vec3( 1.0 ), 0.25 );
				vec3 checkColor = mix(
					vec3( 0.85 ) * c,
					vec3( 1.0 ) * c,
					checkSmall * 0.25 + checkLarge * 0.75
				);

				vec3 gridColor = vec3( 1.0 );

				return mix( checkColor, gridColor, lines );

			}

			${shader.fragmentShader}
		`.replace(
		/#include <normal_fragment_maps>/,
		v =>
		/* glsl */`${v}
				{

					vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );

					float yCont = abs( dot( vec3( 0.0, 1.0, 0.0 ), worldNormal ) );
					float zCont = abs( dot( vec3( 0.0, 0.0, 1.0 ), worldNormal ) );
					float xCont = abs( dot( vec3( 1.0, 0.0, 0.0 ), worldNormal ) );


					vec3 color = vec3( 0.0 );
					if ( yCont > xCont && yCont > zCont ) {

						color = getFaceColor( wPosition.xz );

					} else if ( xCont > zCont ) {

						color = getFaceColor( wPosition.yz );

					} else {

						color = getFaceColor( wPosition.xy );

					}

					// float total = xCont + yCont + zCont;



					// yCont /= total;
					// zCont /= total;
					// xCont /= total;

					// xCont = step( 0.7, xCont );
					// yCont = 0.0;
					// zCont = 0.0;

					// vec3 color =
					// 	getFaceColor( wPosition.yz ) * xCont +
					// 	getFaceColor( wPosition.xz ) * yCont +
					// 	getFaceColor( wPosition.xy ) * zCont;

					gl_FragColor = vec4( color, 1.0 );
					// gl_FragColor.a = 1.0;



					return;







					// // If a face sits exactly on a topo line then bump the delta so we don't divide by zero
					// float yPosDelta = max( fwidth( wPosition.y ), 0.0001 );

					// // Calculate the fade distance
					// float fadeFactor = 1.0 - clamp( ( vViewPosition.z - topoFadeStart ) * ( 1.0 / topoFadeDist ), 0.0, 1.0 );

					// // Calculate if this is an emphasized line or not
					// float lineIndex = mod( wPosition.y + topoLineOffset, topoLineSpacing * float( topoLineEmphasisMod ) );
					// lineIndex -= topoLineSpacing;
					// lineIndex = abs( lineIndex );
					// lineIndex = step( lineIndex, topoLineSpacing * 0.5 );

					// // Compute the emphasis thickness
					// float emphasized = lineIndex == 0.0 ? 0.0 : 1.0;
					// float thickness = mix( 0.0, emphasized, fadeFactor );

					// // Compute the added thickness for when lines get close together so we don't get moire
					// float blend = smoothstep( topoLineSpacing * 0.5, topoLineSpacing, saturate( yPosDelta ) );
					// thickness += blend + topoLineThickness;

					// float lineFalloff = mod( wPosition.y + topoLineOffset, topoLineSpacing ) / topoLineSpacing;
					// lineFalloff = max( lineFalloff, 1.0 - lineFalloff ) * 2.0 - 1.0;

					// float topo = smoothstep(
					// 	1.0,
					// 	1.0 - yPosDelta * 2.0 / topoLineSpacing,
					// 	lineFalloff + yPosDelta * thickness / topoLineSpacing
					// );
					// topo = mix( 1.0, topo, max( fadeFactor, lineIndex )  );

					// diffuseColor = mix( diffuseColor, vec4( topoLineColor, 1.0 ), 1.0 - topo );

				}
				`,
	);

	return shader;

}
