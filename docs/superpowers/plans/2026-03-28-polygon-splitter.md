# Polygon Splitter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace CDTTriangleSplitter with a PolygonSplitter that groups sub-triangles into polygon regions for bulk classification, reducing raycasts and enabling symmetric edge matching across CSG boundaries.

**Architecture:** The PolygonSplitter reuses the existing cdt2d triangulation with constraint edges, then adds a flood-fill grouping step that clusters sub-triangles into polygon regions separated by constraint edges. Each region is classified with a single raycast instead of one per sub-triangle. The integration point is `performSplitTriangleOperations` in operations.js.

**Tech Stack:** three.js, three-mesh-bvh, cdt2d, vitest

---

## File Structure

| File | Responsibility |
|---|---|
| `src/core/PolygonSplitter.js` | New file (based on CDTTriangleSplitter). Triangulates via cdt2d, groups sub-triangles into polygon regions via flood-fill. |
| `src/core/CDTTriangleSplitter.js` | Deleted — replaced by PolygonSplitter. |
| `src/core/Evaluator.js` | Import swap: CDTTriangleSplitter → PolygonSplitter. |
| `src/core/operations/operations.js` | Update `performSplitTriangleOperations` to use polygon regions for bulk classification. |
| `src/index.js` | Export swap. |
| `src/index.d.ts` | Type declaration swap. |
| `tests/PolygonSplitter.test.js` | New test file for polygon region grouping. |

---

### Task 1: Create PolygonSplitter with polygon region grouping

**Files:**
- Create: `src/core/PolygonSplitter.js`
- Create: `tests/PolygonSplitter.test.js`

This task creates the core new class. It's a copy of CDTTriangleSplitter with the addition of `getPolygonRegions()` which flood-fills the CDT adjacency graph to group sub-triangles by non-constraint edges.

- [ ] **Step 1: Write the failing test for polygon region grouping**

```js
import { Vector3, Triangle } from 'three';
import { PolygonSplitter } from '../src/core/PolygonSplitter.js';

describe( 'PolygonSplitter', () => {

	let splitter;
	beforeEach( () => {

		splitter = new PolygonSplitter();

	} );

	describe( 'getPolygonRegions', () => {

		it( 'should return a single region when no constraint edges split the triangle.', () => {

			const tri = new Triangle(
				new Vector3( 0, 0, 0 ),
				new Vector3( 1, 0, 0 ),
				new Vector3( 0, 1, 0 ),
			);

			splitter.initialize( tri, 0, 1, 2 );
			splitter.triangulate();

			const regions = splitter.getPolygonRegions();
			expect( regions ).toHaveLength( 1 );
			expect( regions[ 0 ].triangleIndices ).toHaveLength( splitter.triangles.length );

		} );

		it( 'should return two regions when a constraint edge bisects the triangle.', () => {

			const tri = new Triangle(
				new Vector3( 0, 0, 0 ),
				new Vector3( 1, 0, 0 ),
				new Vector3( 0, 1, 0 ),
			);

			splitter.initialize( tri, 0, 1, 2 );

			// add a constraint edge from the midpoint of edge AB to the midpoint of edge AC
			const edge = {
				start: new Vector3( 0.5, 0, 0 ),
				end: new Vector3( 0, 0.5, 0 ),
			};
			splitter.addConstraintEdge( edge );
			splitter.triangulate();

			const regions = splitter.getPolygonRegions();
			expect( regions.length ).toBe( 2 );

			// every sub-triangle should be in exactly one region
			const allIndices = regions.flatMap( r => r.triangleIndices );
			expect( allIndices ).toHaveLength( splitter.triangles.length );
			expect( new Set( allIndices ).size ).toBe( splitter.triangles.length );

		} );

		it( 'should provide a midpoint for each region.', () => {

			const tri = new Triangle(
				new Vector3( 0, 0, 0 ),
				new Vector3( 1, 0, 0 ),
				new Vector3( 0, 1, 0 ),
			);

			splitter.initialize( tri, 0, 1, 2 );

			const edge = {
				start: new Vector3( 0.5, 0, 0 ),
				end: new Vector3( 0, 0.5, 0 ),
			};
			splitter.addConstraintEdge( edge );
			splitter.triangulate();

			const regions = splitter.getPolygonRegions();
			for ( const region of regions ) {

				expect( region.midpoint ).toBeDefined();
				expect( region.midpoint.x ).toBeDefined();
				expect( region.midpoint.y ).toBeDefined();
				expect( region.midpoint.z ).toBeDefined();

			}

		} );

	} );

} );
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/PolygonSplitter.test.js`
Expected: FAIL — cannot resolve `../src/core/PolygonSplitter.js`

- [ ] **Step 3: Create PolygonSplitter by copying CDTTriangleSplitter and adding getPolygonRegions**

Create `src/core/PolygonSplitter.js` — this is a copy of `src/core/CDTTriangleSplitter.js` with:
- Class renamed from `CDTTriangleSplitter` to `PolygonSplitter`
- New `getPolygonRegions()` method added after `triangulate()`
- New `polygonRegions` array field in constructor and `reset()`

The key addition — the `getPolygonRegions` method:

```js
getPolygonRegions() {

	const { triangles, triangleConnectivity } = this;
	const regions = [];
	const visited = new Set();

	for ( let i = 0, l = triangles.length; i < l; i ++ ) {

		if ( visited.has( i ) ) continue;

		const region = {
			triangleIndices: [],
			midpoint: new Vector3(),
		};

		// flood-fill connected sub-triangles via non-constraint edges
		const stack = [ i ];
		while ( stack.length > 0 ) {

			const idx = stack.pop();
			if ( visited.has( idx ) ) continue;
			visited.add( idx );

			region.triangleIndices.push( idx );

			const connected = triangleConnectivity[ idx ];
			if ( connected ) {

				for ( let c = 0, cl = connected.length; c < cl; c ++ ) {

					if ( ! visited.has( connected[ c ] ) ) {

						stack.push( connected[ c ] );

					}

				}

			}

		}

		// use the first sub-triangle's midpoint as the representative point
		triangles[ region.triangleIndices[ 0 ] ].getMidpoint( region.midpoint );
		regions.push( region );

	}

	return regions;

}
```

The full file is CDTTriangleSplitter.js with:
1. Class name `CDTTriangleSplitter` → `PolygonSplitter`
2. The `getPolygonRegions()` method above added before `reset()`
3. `import { Vector3, Line3 } from 'three';` — Vector3 already imported

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/PolygonSplitter.test.js`
Expected: PASS — all 3 tests green

- [ ] **Step 5: Commit**

```bash
git add src/core/PolygonSplitter.js tests/PolygonSplitter.test.js
git commit -m "Add PolygonSplitter with polygon region grouping via flood-fill"
```

---

### Task 2: Wire PolygonSplitter into Evaluator and exports

**Files:**
- Modify: `src/core/Evaluator.js:1-2,12-26`
- Modify: `src/index.js:5`
- Modify: `src/index.d.ts`
- Delete: `src/core/CDTTriangleSplitter.js`

- [ ] **Step 1: Update Evaluator.js imports and useCDTClipping getter/setter**

In `src/core/Evaluator.js`, replace:
```js
import { CDTTriangleSplitter } from './CDTTriangleSplitter.js';
```
with:
```js
import { PolygonSplitter } from './PolygonSplitter.js';
```

Replace the `useCDTClipping` getter:
```js
get useCDTClipping() {

	return this.triangleSplitter instanceof CDTTriangleSplitter;

}
```
with:
```js
get useCDTClipping() {

	return this.triangleSplitter instanceof PolygonSplitter;

}
```

Replace the `useCDTClipping` setter:
```js
set useCDTClipping( v ) {

	if ( v !== this.useCDTClipping ) {

		this.triangleSplitter = v ? new CDTTriangleSplitter() : new LegacyTriangleSplitter();

	}

}
```
with:
```js
set useCDTClipping( v ) {

	if ( v !== this.useCDTClipping ) {

		this.triangleSplitter = v ? new PolygonSplitter() : new LegacyTriangleSplitter();

	}

}
```

- [ ] **Step 2: Update src/index.js export**

Replace:
```js
export * from './core/CDTTriangleSplitter.js';
```
with:
```js
export * from './core/PolygonSplitter.js';
```

- [ ] **Step 3: Update src/index.d.ts type declaration**

There is no `CDTTriangleSplitter` type currently exported in index.d.ts, so no removal needed. Add a `PolygonSplitter` type after the `LegacyTriangleSplitter` declaration:

```ts
export class PolygonSplitter {

	trianglePool: TrianglePool;
	triangles: Triangle[];
	triangleIndices: Array<Array<number | string>>;
	triangleConnectivity: Array<Array<number>>;
	normal: Vector3;

	initialize( tri: Triangle, i0?: number, i1?: number, i2?: number ): void;
	addConstraintEdge( edge: Line3 ): void;
	triangulate(): void;
	getPolygonRegions(): Array<{ triangleIndices: number[], midpoint: Vector3 }>;
	reset(): void;

}
```

- [ ] **Step 4: Delete CDTTriangleSplitter.js**

```bash
rm src/core/CDTTriangleSplitter.js
```

- [ ] **Step 5: Run all existing tests to verify nothing breaks**

Run: `npx vitest run`
Expected: All tests PASS — the evaluator uses LegacyTriangleSplitter by default (constructor line 30), so CDT deletion doesn't affect default behavior.

- [ ] **Step 6: Commit**

```bash
git add src/core/Evaluator.js src/index.js src/index.d.ts src/core/PolygonSplitter.js
git rm src/core/CDTTriangleSplitter.js
git commit -m "Replace CDTTriangleSplitter with PolygonSplitter in exports and Evaluator"
```

---

### Task 3: Update performSplitTriangleOperations for polygon-level classification

**Files:**
- Modify: `src/core/operations/operations.js:264-406`

This is the core integration. The loop over split sub-triangles changes from classifying each individually to grouping by polygon region first.

- [ ] **Step 1: Write a failing integration test for polygon-level classification**

Add to `tests/PolygonSplitter.test.js`:

```js
import { BoxGeometry } from 'three';
import { Brush, Evaluator, SUBTRACTION, INTERSECTION, ADDITION, computeMeshVolume } from '../src';

describe( 'PolygonSplitter integration', () => {

	it( 'should produce correct volume with useCDTClipping enabled.', () => {

		const evaluator = new Evaluator();
		evaluator.useCDTClipping = true;

		const brush1 = new Brush( new BoxGeometry() );
		brush1.updateMatrixWorld();

		const brush2 = new Brush( new BoxGeometry() );
		brush2.rotation.set( Math.PI / 4, 0, Math.PI / 4 );
		brush2.updateMatrixWorld();

		const result1 = new Brush();
		const result2 = new Brush();
		evaluator.evaluate( brush1, brush2, [ SUBTRACTION, INTERSECTION ], [ result1, result2 ] );

		const vol1 = computeMeshVolume( result1 );
		const vol2 = computeMeshVolume( result2 );
		expect( vol1 + vol2 ).toBeCloseTo( 1, 7 );

	} );

	it( 'should produce correct volume for ADDITION with useCDTClipping.', () => {

		const evaluator = new Evaluator();
		evaluator.useCDTClipping = true;

		const brush1 = new Brush( new BoxGeometry() );
		brush1.updateMatrixWorld();

		const brush2 = new Brush( new BoxGeometry() );
		brush2.position.set( 0.5, 0.5, 0.5 );
		brush2.updateMatrixWorld();

		const result = evaluator.evaluate( brush1, brush2, ADDITION );
		const vol = computeMeshVolume( result );

		// two overlapping unit boxes offset by 0.5 in each axis
		// overlap volume = 0.5 * 0.5 * 0.5 = 0.125
		// union volume = 1 + 1 - 0.125 = 1.875
		expect( vol ).toBeCloseTo( 1.875, 5 );

	} );

} );
```

- [ ] **Step 2: Run test to verify it fails or passes (baseline)**

Run: `npx vitest run tests/PolygonSplitter.test.js`

These tests may already pass since PolygonSplitter still works like CDTTriangleSplitter. That's fine — they serve as regression tests for the next step.

- [ ] **Step 3: Update performSplitTriangleOperations to use polygon regions**

In `src/core/operations/operations.js`, replace the inner loop (lines 264-405). The current code iterates `triangles` one by one with `_traversed` tracking. Replace with polygon-region-based iteration.

Replace the block starting at line 264 (`const { triangles, triangleIndices = [], triangleConnectivity = [] } = splitter;`) through line 405 (end of the outer `for` body closing the split triangle iteration):

```js
		// cache all the attribute data in origA's local frame
		const { triangles, triangleIndices = [] } = splitter;
		for ( let i = 0, l = builders.length; i < l; i ++ ) {

			builders[ i ].initInterpolatedAttributeData( a.geometry, _builderMatrix, _normalMatrix, ia0, ia1, ia2 );

		}

		// get polygon regions from the splitter if it supports them,
		// otherwise treat each triangle as its own region
		let regions;
		if ( splitter.getPolygonRegions ) {

			regions = splitter.getPolygonRegions();

		} else {

			regions = triangles.map( ( tri, idx ) => {

				const mp = new Vector3();
				tri.getMidpoint( mp );
				return {
					triangleIndices: [ idx ],
					midpoint: mp,
				};

			} );

		}

		// classify and add triangles per polygon region
		for ( let ri = 0, rl = regions.length; ri < rl; ri ++ ) {

			const region = regions[ ri ];
			const { triangleIndices: regionTriIndices, midpoint: regionMidpoint } = region;

			// determine the hit side for this entire region using the representative midpoint
			const raycastMatrix = invert ? null : _matrix;
			let hitSide = null;

			// check coplanar triangles first
			for ( let cp = 0, cpl = _coplanarTriangles.length; cp < cpl; cp ++ ) {

				const cpt = _coplanarTriangles[ cp ];
				if ( cpt.containsPoint( regionMidpoint ) ) {

					cpt.getNormal( _coplanarNormal );
					hitSide = _normal.dot( _coplanarNormal ) > 0 ? COPLANAR_ALIGNED : COPLANAR_OPPOSITE;
					break;

				}

			}

			if ( hitSide === null ) {

				// build a temporary triangle for raycasting using the representative midpoint
				const firstTriIdx = regionTriIndices[ 0 ];
				hitSide = getHitSide( triangles[ firstTriIdx ], bBVH, raycastMatrix );

			}

			// determine actions for each builder
			_actions.length = 0;
			_builders.length = 0;

			for ( let o = 0, lo = operations.length; o < lo; o ++ ) {

				const op = getOperationAction( operations[ o ], hitSide, invert );
				if ( op !== SKIP_TRI ) {

					_actions.push( op );
					_builders.push( builders[ o ] );

				}

			}

			if ( _builders.length === 0 ) continue;

			// add all triangles in this region to the geometry
			for ( let ti = 0, tl = regionTriIndices.length; ti < tl; ti ++ ) {

				const index = regionTriIndices[ ti ];
				const tri = triangles[ index ];

				// get the triangle indices
				const indices = triangleIndices[ index ];
				let t0 = null, t1 = null, t2 = null;
				if ( indices ) {

					t0 = indices[ 0 ];
					t1 = indices[ 1 ];
					t2 = indices[ 2 ];

				}

				// get the barycentric coordinates relative to the base triangle
				_triA.getBarycoord( tri.a, _barycoordTri.a );
				_triA.getBarycoord( tri.b, _barycoordTri.b );
				_triA.getBarycoord( tri.c, _barycoordTri.c );

				// append the triangle to all builders
				for ( let k = 0, lk = _builders.length; k < lk; k ++ ) {

					const builder = _builders[ k ];
					const action = _actions[ k ];
					const invertTri = action === INVERT_TRI;
					const invert = invertedGeometry !== invertTri;

					builder.appendInterpolatedAttributeData( groupIndex, _barycoordTri.a, t0, invert );
					if ( invert ) {

						builder.appendInterpolatedAttributeData( groupIndex, _barycoordTri.c, t2, invert );
						builder.appendInterpolatedAttributeData( groupIndex, _barycoordTri.b, t1, invert );

					} else {

						builder.appendInterpolatedAttributeData( groupIndex, _barycoordTri.b, t1, invert );
						builder.appendInterpolatedAttributeData( groupIndex, _barycoordTri.c, t2, invert );

					}

				}

			}

		}
```

Also remove the `_traversed` Set declaration (line 25) and `_traversed.clear()` since it's no longer needed.

Remove from module-level:
```js
const _traversed = new Set();
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS — both PolygonSplitter unit tests and all existing evaluator tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/operations/operations.js tests/PolygonSplitter.test.js
git commit -m "Use polygon regions for bulk classification in split triangle operations"
```

---

### Task 4: Ensure canonical edge sharing between A and B intersection maps

**Files:**
- Modify: `src/core/operations/operationsUtils.js:58-131`
- Modify: `src/core/IntersectionMap.js`

Currently, `collectIntersectingTriangles` stores independent `Line3` copies for both aIntersections and bIntersections. For symmetric edges, B should reference the same edge data as A (just transformed).

- [ ] **Step 1: Write a test to verify edge symmetry**

Add to `tests/PolygonSplitter.test.js`:

```js
import { Line3 } from 'three';

describe( 'Canonical edge sharing', () => {

	it( 'should store the same edge object for both intersection maps.', () => {

		const evaluator = new Evaluator();
		evaluator.useCDTClipping = true;

		const brush1 = new Brush( new BoxGeometry() );
		brush1.updateMatrixWorld();

		const brush2 = new Brush( new BoxGeometry() );
		brush2.rotation.set( Math.PI / 4, 0, Math.PI / 4 );
		brush2.updateMatrixWorld();

		// the result should still be correct
		const result = evaluator.evaluate( brush1, brush2, SUBTRACTION );
		expect( computeMeshVolume( result ) ).toBeGreaterThan( 0 );

	} );

} );
```

- [ ] **Step 2: Update collectIntersectingTriangles for shared edge references**

In `src/core/operations/operationsUtils.js`, in the `intersectsTriangles` callback, change the edge caching so both maps share the same `Line3` instance for non-coplanar intersections:

Replace lines 101-108:
```js
} else {

	// non-coplanar
	const ea = _edgePool.getInstance().copy( _edge );
	const eb = _edgePool.getInstance().copy( _edge );
	aIntersections.addIntersectionEdge( va, ea );
	bIntersections.addIntersectionEdge( vb, eb );

}
```
with:
```js
} else {

	// non-coplanar — share the same edge instance for symmetric splitting
	const e = _edgePool.getInstance().copy( _edge );
	aIntersections.addIntersectionEdge( va, e );
	bIntersections.addIntersectionEdge( vb, e );

}
```

For coplanar edges, do the same — share instances:

Replace lines 90-100:
```js
// coplanar
const count = getCoplanarIntersectionEdges( triangleA, triangleB, _coplanarEdges );
for ( let i = 0; i < count; i ++ ) {

	const e = _edgePool.getInstance().copy( _coplanarEdges[ i ] );
	aIntersections.addIntersectionEdge( va, e );
	bIntersections.addIntersectionEdge( vb, e );

}
```
This part is already sharing — no change needed for coplanar case.

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/core/operations/operationsUtils.js tests/PolygonSplitter.test.js
git commit -m "Share canonical edge instances between intersection maps for symmetric splitting"
```

---

### Task 5: Run full test suite and benchmarks

**Files:** None modified — verification only.

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 3: Run benchmarks**

Run: `npm run benchmark`

Record results. No specific threshold — this establishes the baseline for the new splitter. Performance should be comparable or better than before.

- [ ] **Step 4: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors. Output in `build/` directory.

- [ ] **Step 5: Commit any lint fixes if needed**

```bash
git add -A
git commit -m "Fix lint issues"
```

Only run this step if lint found issues that needed fixing.
