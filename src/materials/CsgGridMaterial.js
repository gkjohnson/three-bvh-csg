import { MeshPhongMaterial, Color } from 'three';
import { csgGridShaderMixin } from './shaderUtils.js';

export class CsgGridMaterial extends MeshPhongMaterial {

	constructor( params ) {

		super();
		this.checkerboardColor = new Color();
		this.setValues( params );

	}

	onBeforeCompile( shader ) {

		csgGridShaderMixin( shader );
		shader.uniforms.checkerboardColor.value = this.checkerboardColor;

	}


}
