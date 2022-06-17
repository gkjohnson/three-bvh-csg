# three-bvh-csg

An _in progress_, flexible, memory compact, fast and dynamic CSG implementation on top of three-mesh-bvh.

## API

### Constants

```
ADDITION
SUBTRACTION
DIFFERENCE
INTERSECTION
```

### Brush

Instance of Mesh that affords disposing of cached data. Or just a function to dispose so a mesh can be used?

Brush will be needed for cached / interactive applications data.

### Operation

TODO

### Evaluator

TODO

## Gotchas
- All geometry is expected to have all attributes to be interpolated using the same type of array.

## References
- [Godot CSG](https://github.com/godotengine/godot/blob/master/modules/csg/csg.cpp)
- RealtimeCSG ([Overview](https://www.youtube.com/watch?v=uqaiUMuGlRc), [GCD Presentation](https://www.youtube.com/watch?v=Iqmg4gblreo))
