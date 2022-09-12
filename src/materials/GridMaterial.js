import { MeshPhongMaterial } from 'three';
import { csgGridShaderMixin } from './shaderUtils.js';

export class GridMaterial extends MeshPhongMaterial {

	get enableGrid() {

		return Boolean( this._enableGrid );

	}

	set enableGrid( v ) {

		if ( this._enableGrid !== v ) {

			this._enableGrid = v;
			this.needsUpdate = true;

		}

	}

	constructor( ...args ) {

		super( ...args );
		this.enableGrid = true;

	}

	onBeforeCompile( shader ) {

		csgGridShaderMixin( shader );
		shader.defines.CSG_GRID = Number( this.enableGrid );

	}

	customProgramCacheKey() {

		return this.enableGrid.toString();

	}

}
