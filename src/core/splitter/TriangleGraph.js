import { Triangle, Matrix4 } from 'three';

class GraphTriangle {

	constructor() {

		this.edges = [];
		this._triangle = new Triangle();

	}

}

class GraphConnection {

	constructor() {

		this.start = - 1;
		this.end = - 1;
		this.required = false;
		this.triangle1 = null;
		this.triangle2 = null;

	}

}

export class TriangleGraph {

	constructor() {

		this.points = [];
		this.connections = [];
		this.triangles = [];

		this.frame = new Matrix4();

	}

	initialize( tri ) {

		this.reset();

	}

	reset() {

		// TODO: use a pool of objects here
		this.points = [];
		this.connections = [];
		this.triangles = [];

	}

	splitBy( tri ) {

		// TODO
		// - find intersection edge
		// - transform tri or intersection edge into og tri frame w/ z up
		// - which triangles the points line up on (or which edges they may lie on) to split and insert
		// 	  - possibly split the main triangle edges
		// - triangulate the points
		// - swap so the required edges are present
		// - confirm on edges cross??
		// OR
		// - just clip into separate shapes? Use earcut to triangulate?

	}

	forEachTriangle( cb ) {


	}

}
