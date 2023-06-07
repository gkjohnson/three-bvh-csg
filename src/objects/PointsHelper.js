import { InstancedMesh, SphereGeometry, MeshBasicMaterial, Matrix4 } from 'three';

const _matrix = new Matrix4();
export class PointsHelper extends InstancedMesh {

	get color() {

		return this.material.color;

	}

	constructor( count = 1000, points = [] ) {

		super( new SphereGeometry( 0.025 ), new MeshBasicMaterial(), count );
		this.frustumCulled = false;
		this.setPoints( points );

	}

	setPoints( points ) {

		for ( let i = 0, l = points.length; i < l; i ++ ) {

			const point = points[ i ];
			_matrix.makeTranslation( point.x, point.y, point.z );
			this.setMatrixAt( i, _matrix );

		}

		this.count = points.length;

	}

}
