# three-bvh-csg

[![lgtm code quality](https://img.shields.io/lgtm/grade/javascript/g/gkjohnson/three-bvh-csg.svg?style=flat-square&label=code-quality)](https://lgtm.com/projects/g/gkjohnson/three-bvh-csg/)
[![build](https://img.shields.io/github/workflow/status/gkjohnson/three-bvh-csg/Node.js%20CI?style=flat-square&label=build)](https://github.com/gkjohnson/three-bvh-csg/actions)
[![github](https://flat.badgen.net/badge/icon/github?icon=github&label)](https://github.com/gkjohnson/three-bvh-csg/)
[![twitter](https://flat.badgen.net/twitter/follow/garrettkjohnson)](https://twitter.com/garrettkjohnson)
[![sponsors](https://img.shields.io/github/sponsors/gkjohnson?style=flat-square&color=1da1f2)](https://github.com/sponsors/gkjohnson/)

An _in progress_, flexible, memory compact, fast and dynamic CSG implementation on top of three-mesh-bvh.

# Roadmap
- Material retention support
- Hierarchical operations
- Performance improvements

# Examples

[Simple CSG](https://gkjohnson.github.io/three-bvh-csg/examples/bundle/index.html)

# Use

```js
import { SUBTRACTION, Brush, Evaluator } from 'three-bvh-csg';
import { MeshStandardMaterial, Mesh, SphereGeometry, BoxGeometry } from 'three';

const csgEvaluator = new Evaluator();
const brush1 = new Brush( new SphereGeometry() );
const brush2 = new Brush( new BoxGeometry() );

const result = csgEvaluator.evaluate( brush1, brush2, SUBTRACTION );
const mesh = new Mesh( result, new MeshStandardMaterial() );

// render the mesh!
```

# API

## Constants

```
ADDITION
SUBTRACTION
DIFFERENCE
INTERSECTION
```

## Brush

_extends THREE.Mesh_

TODO

## Operation

_extends Brush_

TODO

## Evaluator

### .evaluate

TODO

### .evaluateHierarchy

TODO

## EvaluatorWorker

_extends Evaluator_

### .evaluate

TODO

### .evaluateHierarchy

TODO

# Gotchas
- All geometry is expected to have all attributes to be interpolated using the same type of array.
- Geometry on a Brush or an Operation should be unique and not be modified after being set.

# References
- [Godot CSG](https://github.com/godotengine/godot/blob/master/modules/csg/csg.cpp)
- RealtimeCSG ([Overview](https://www.youtube.com/watch?v=uqaiUMuGlRc), [GCD Presentation](https://www.youtube.com/watch?v=Iqmg4gblreo))
