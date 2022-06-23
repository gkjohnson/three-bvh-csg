import { MeshPhongMaterial } from 'three';
import { TopoLineShaderMixin } from './shaderUtils.js';

export class PhongGridMaterial extends MeshPhongMaterial {

	onBeforeCompile( shader ) {

		TopoLineShaderMixin( shader );

	}


}
