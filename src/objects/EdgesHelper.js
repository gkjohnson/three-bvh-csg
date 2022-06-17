import { LineSegments } from 'three';

export class EdgesHelper extends LineSegments {

	get color() {

		return this.material.color;

	}

	constructor( edges = [] ) {

		super();
		this.frustumCulled = false;
		this.setEdges( edges );

	}

	setEdges( edges ) {

		const { geometry } = this;
		const points = edges.flatMap( e => [ e.start, e.end ] );
		geometry.dispose();
		geometry.setFromPoints( points );

	}

}
