import { MeshPhongMaterial } from 'three';
import { csgGridShaderMixin } from './shaderUtils.js';

export class CsgGridMaterial extends MeshPhongMaterial {

	onBeforeCompile( shader ) {


		csgGridShaderMixin( shader );

	}


}
